import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, ILike, Not, Repository } from 'typeorm';
import { Status, User, UserRole } from 'src/infra/database/entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { Company } from 'src/infra/database/entities/company.entity';
import { hash } from 'src/common/utils/hash.util';
import { ResponseService } from 'src/common/services/response.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { sanitizeUser, sanitizeUsers } from 'src/common/utils/sanitize-user.util';
import { RegisterResponseDto, UserData } from '../auth/dto/authResponse.dto';
import { Department } from 'src/infra/database/entities/department.entity';
import { ApproveUserDto } from './dto/approve-user.dto';
import { authenticate } from 'passport';
import { EventBusService } from 'src/infra/redis/event-bus.service';
import { ApprovalConfigService } from '../approval/approvalConfig.service';
import { UserActivityLog } from 'src/infra/database/entities/user-log.entity';
import { platform } from 'os';
import { app } from 'firebase-admin';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(UserActivityLog)
    private readonly userLogRepo: Repository<UserActivityLog>,
    @InjectRepository(Company)
    private readonly companyRepo: Repository<Company>,
    private approvalConfigService: ApprovalConfigService,
    private readonly responseService: ResponseService,
    private readonly eventBus: EventBusService,
  ) {}

  private async validateRequiredFields(dto: CreateUserDto): Promise<void> {
    const { role, username, email, phone, displayname, password } = dto;
    const missingFields: string[] = [];

    // Check all required fields
    if (!username) missingFields.push('username');
    if (!phone) missingFields.push('phone number');
    if (!displayname) missingFields.push('display name');
    if (!password) missingFields.push('password');

    // Email is required for non-driver/security roles
    if (
      role !== UserRole.DRIVER &&
      role !== UserRole.SECURITY &&
      role !== UserRole.SUPERVISOR &&
      !email
    ) {
      missingFields.push('email');
    }

    if (missingFields.length > 0) {
      throw new BadRequestException(
        this.responseService.error(
          `The following fields are required: ${missingFields.join(', ')}`,
          400,
        ),
      );
    }
  }

  private async validateUniqueFields(dto: CreateUserDto): Promise<void> {
    const [existingUsername, existingEmail, existingPhone] = await Promise.all([
      this.userRepo.findOne({ where: { username: dto.username } }),
      !dto.email ? Promise.resolve(null) : this.userRepo.findOne({ where: { email: dto.email } }),
      this.userRepo.findOne({ where: { phone: dto.phone } }),
    ]);

    if (existingUsername || existingEmail || existingPhone) {
      const errors = [];

      if (existingUsername) errors.push('username');
      if (existingEmail) errors.push('email');
      if (existingPhone) errors.push('phone number');

      throw new ConflictException(
        this.responseService.error(
          `The following fields are already registered: ${errors.join(', ')}`,
          409,
        ),
      );
    }
  }

  async createUser(dto: CreateUserDto): Promise<RegisterResponseDto> {
    // Check required fields
    await this.validateRequiredFields(dto);

    // Check for unique constraints
    await this.validateUniqueFields(dto);

    // Validate company
    //const company = await this.companyRepo.findOne({ where: { id: dto.companyId } });
    //if (!company) throw new BadRequestException('Invalid company.');

    // Enforce email domain for non-driver/security users
    /*if (![UserRole.DRIVER, UserRole.SECURITY].includes(dto.role)) {
      const domain = dto.email.split('@')[1];
      if (!company.emailDomain || !domain.endsWith(company.emailDomain)) {
        throw new BadRequestException('Email domain not allowed for this company.');
      }
    }*/

    // Hash password
    const passwordHash = await hash(dto.password);

    const companies = await this.companyRepo.find({ where: { isActive: true } });
    const companyId = companies[0].id;

    const departmentId = Number(dto.departmentId);

    // Create user (not approved yet)
    const user = this.userRepo.create({
      username: dto.username,
      company: { id: companyId },
      displayname: dto.displayname,
      email: dto.email,
      phone: dto.phone,
      role: dto.role,
      passwordHash,
      isActive: true,
      isApproved: Status.PENDING,
      department: { id: departmentId },
    });

    const savedUser = await this.userRepo.save(user);

    const sanitizedUser: UserData = sanitizeUser(savedUser);

    const response = this.responseService.created(
      'User registered successfully. Please wait for admin approval.',
      {
        user: sanitizedUser,
      },
    );

    try {
      // Publish USER.CREATE event
      await this.eventBus.publish('USER', 'CREATE', {
        userId: savedUser.id,
        username: savedUser.displayname,
        email: savedUser.email,
        role: savedUser.role,
        companyId: savedUser.company?.id,
      });
    } catch (e) {
      console.error('Failed to send notifications', e);
    }

    return response;
  }

  async approveUser(id: number, dto: ApproveUserDto, reqUser: any) {
    const approveUser = await this.userRepo.findOne({ where: { id: reqUser.userId } });

    const user = await this.userRepo.findOne({
      where: { id },
      relations: ['department'],
    });
    if (!user) {
      throw new NotFoundException(this.responseService.error('User not found', 404));
    }

    // Check if user is already approved
    if (user.isApproved === Status.APPROVED) {
      throw new BadRequestException(this.responseService.error('User is already approved', 400));
    }

    const departmentId = Number(dto.departmentId);

    const oldStatus = user.isApproved;

    user.isApproved = Status.APPROVED;
    user.isActive = true;
    user.department.id = departmentId;
    user.role = dto.role;

    const approvedUser = await this.userRepo.save(user);

    const sanitizedUser = sanitizeUser(approvedUser);

    try {
      // Publish USER.APPROVE event
      await this.eventBus.publish('USER', 'APPROVE', {
        userId: user.id,
        userName: user.displayname,
        role: user.role,
        department: user.department?.name,
        approvedUser: approveUser,
      });
    } catch (e) {
      console.error('Failed to send notifications', e);
    }

    return this.responseService.success('User approved successfully', {
      user: sanitizedUser,
    });
  }

  async getUsersWithAuthLevelThree(): Promise<User[]> {
    return this.userRepo.find({
      where: {
        authenticationLevel: 3,
        isActive: true,
        role: Not(UserRole.SYSADMIN), // Exclude sysadmin if needed
      },
      relations: ['department', 'company'],
    });
  }

  /*
  async getApprovers(): Promise<User[]> {
    // Users who can approve: HR, ADMIN, SYSADMIN, and users with authLevel == 3
    return this.userRepo.find({
      where: [
        { role: UserRole.HR, isActive: true, isApproved: Status.APPROVED },
        { role: UserRole.ADMIN, isActive: true, isApproved: Status.APPROVED },
        { role: UserRole.SYSADMIN, isActive: true, isApproved: Status.APPROVED },
        { authenticationLevel: 3, isActive: true, isApproved: Status.APPROVED },
      ],
      relations: ['department', 'company'],
    });
  }
  */
  // Replace your getApprovers method in UsersService with this:

  async getApprovers(): Promise<User[]> {
    try {
      // Get users who can approve: HR, ADMIN, SYSADMIN, and users with authLevel == 3
      const approvers = await this.userRepo
        .createQueryBuilder('user')
        .where('user.isActive = :isActive', { isActive: true })
        .andWhere('user.isApproved = :approved', { approved: Status.APPROVED })
        .andWhere('(user.role IN (:...roles) OR user.authenticationLevel = :authLevel)', {
          roles: [UserRole.HR, UserRole.ADMIN, UserRole.SYSADMIN],
          authLevel: 3,
        })
        .leftJoinAndSelect('user.department', 'department')
        .leftJoinAndSelect('user.company', 'company')
        .getMany();

      /*
    this.logger.log(`Found ${approvers.length} approvers:`, approvers.map(a => ({
      id: a.id,
      username: a.username,
      role: a.role,
      authLevel: a.authenticationLevel,
    })));
    */

      return approvers;
    } catch (error) {
      //this.logger.error('Error fetching approvers:', error);
      throw error;
    }
  }

  async getTransportSupervisors(): Promise<User[]> {
    try {
      // Get users SUPERVISOR role
      const supervisors = await this.userRepo
        .createQueryBuilder('user')
        .where('user.isActive = :isActive', { isActive: true })
        .andWhere('user.isApproved = :approved', { approved: Status.APPROVED })
        .andWhere('(user.role = :role)', { role: UserRole.SUPERVISOR })
        .getMany();

      return supervisors;
    } catch (error) {
      //this.logger.error('Error fetching supervisors:', error);
      throw error;
    }
  }

  async getSafetyApprovers(): Promise<User[]> {
    try {
      // Get users SUPERVISOR role
      const safetyApprovers = await this.userRepo
        .createQueryBuilder('user')
        .where('user.isActive = :isActive', { isActive: true })
        .andWhere('user.isApproved = :approved', { approved: Status.APPROVED })
        .andWhere('(user.isSafetyApprover = :isSafetyApprover)', {
          isSafetyApprover: true,
        })
        .getMany();

      return safetyApprovers;
    } catch (error) {
      //this.logger.error('Error fetching safetyApprovers:', error);
      throw error;
    }
  }

  async getSysadmin(): Promise<User> {
    try {
      // Get users SYSADMIN role
      const sysadmin = await this.userRepo.findOne({
        where: {
          isActive: true,
          role: UserRole.SYSADMIN,
          username: 'sysadmin',
        },
      });

      console.log('Sysadmin: ', sysadmin);
      return sysadmin;
    } catch (error) {
      //this.logger.error('Error fetching sysadmin:', error);
      console.log('Error fetching sysadmin:', error);
      throw error;
    }
  }

  async getSecurities(): Promise<User[]> {
    try {
      // Get users SUPERVISOR role
      const securities = await this.userRepo
        .createQueryBuilder('user')
        .where('user.isActive = :isActive', { isActive: true })
        .andWhere('user.isApproved = :approved', { approved: Status.APPROVED })
        .andWhere('(user.role = :role)', { role: UserRole.SECURITY })
        .getMany();

      return securities;
    } catch (error) {
      //this.logger.error('Error fetching securities:', error);
      throw error;
    }
  }

  // Also add this helper method to check if a user is an approver
  async isApprover(userId: number): Promise<boolean> {
    try {
      const user = await this.userRepo.findOne({
        where: { id: userId, isActive: true, isApproved: Status.APPROVED },
      });

      if (!user) return false;

      return (
        [UserRole.HR, UserRole.ADMIN, UserRole.SYSADMIN].includes(user.role) ||
        user.authenticationLevel === 3
      );
    } catch (error) {
      //this.logger.error('Error checking if user is approver:', error);
      return false;
    }
  }

  async disapproveUser(id: number, reqUser: any) {
    const approveUser = await this.userRepo.findOne({ where: { id: reqUser.userId } });

    const user = await this.userRepo.findOne({ where: { id }, relations: ['department'] });
    if (!user) {
      throw new NotFoundException(this.responseService.error('User not found', 404));
    }

    user.isApproved = Status.REJECTED;

    const disapprovedUser = await this.userRepo.save(user);

    const sanitizedUser = sanitizeUser(disapprovedUser);

    try {
      // Publish USER.REJECTED event
      await this.eventBus.publish('USER', 'REJECT', {
        userId: user.id,
        userName: user.displayname,
        role: user.role,
        department: user.department?.name,
        approvedUser: approveUser,
      });
    } catch (e) {
      console.error('Failed to send notifications', e);
    }

    return this.responseService.success('User disapproved successfully', {
      user: sanitizedUser,
    });
  }

  async findAll() {
    const users = await this.userRepo.find({
      where: {
        role: Not(UserRole.SYSADMIN),
      },
      relations: ['company', 'department'],
      order: { id: 'DESC' },
    });

    const sanitizedUsers = await Promise.all(
      users.map(async (user) => {
        const sanitizedUser = sanitizeUser(user);

        const [canUserCreate, canTripApprove] = await Promise.all([
          this.canUserCreate(user),
          this.canTripApprove(user),
        ]);

        const userWithPermissions = {
          ...sanitizedUser,
          permissions: {
            canUserCreate,
            canTripApprove,
          },
        };

        return userWithPermissions;
      }),
    );

    return this.responseService.success('Users retrieved successfully', {
      users: sanitizedUsers,
      total: sanitizedUsers.length,
    });
  }

  async findAllByFiltration(body: any) {
    try {
      // Create base query builder with necessary joins
      const queryBuilder = this.userRepo
        .createQueryBuilder('user')
        .leftJoinAndSelect('user.company', 'company')
        .leftJoinAndSelect('user.department', 'department')
        .where('user.username != :username', { username: 'buddikakasun' });

      // Apply department filter if provided
      if (body.departmentId) {
        queryBuilder.andWhere('department.id = :departmentId', {
          departmentId: body.departmentId,
        });
      }

      // Map frontend role to enum
      if (body.role) {
        const roleMapping: Record<string, UserRole> = {
          'System Admin': UserRole.SYSADMIN,
          Employee: UserRole.EMPLOYEE,
          HOD: UserRole.ADMIN,
          HR: UserRole.HR,
          'Transport Supervisor': UserRole.SUPERVISOR,
          Security: UserRole.SECURITY,
          Driver: UserRole.DRIVER,
        };

        const userRole = roleMapping[body.role];
        if (userRole) {
          queryBuilder.andWhere('user.role = :filterRole', { filterRole: userRole });
        }
      }

      // Apply search filter if provided
      if (body.search && body.search.trim() !== '') {
        const searchTerm = `%${body.search.trim()}%`;

        queryBuilder.andWhere(
          new Brackets((qb) => {
            qb.where('user.displayname ILIKE :searchTerm', { searchTerm })
              .orWhere('user.email ILIKE :searchTerm', { searchTerm })
              .orWhere('user.username ILIKE :searchTerm', { searchTerm })
              .orWhere('CAST(user.id AS TEXT) ILIKE :searchTerm', { searchTerm });
          }),
        );
      }

      // Calculate pagination
      const page = parseInt(body.page) || 1;
      const limit = parseInt(body.limit) || 20;
      const skip = (page - 1) * limit;

      // Get total count
      const total = await queryBuilder.getCount();

      // Apply sorting based on sort parameter
      if (body.sort === 'asc') {
        queryBuilder.orderBy('user.displayname', 'ASC');
      } else if (body.sort === 'desc') {
        queryBuilder.orderBy('user.displayname', 'DESC');
      } else {
        // Default sort by ID descending
        queryBuilder.orderBy('user.id', 'DESC');
      }

      // Get paginated results
      const users = await queryBuilder.skip(skip).take(limit).getMany();

      // Process permissions for each user
      const sanitizedUsers = users.map((user) => ({
        id: user.id,
        displayname: user.displayname,
        role: user.role,
        departmentName: user.department?.name || null,
      }));

      const hasMore = skip + users.length < total;

      return {
        success: true,
        data: {
          users: sanitizedUsers,
          total,
          page: page,
          limit: limit,
          hasMore,
          sort: body.sort || 'desc',
        },
        statusCode: 200,
      };
    } catch (error) {
      console.error('Error in findAllByFiltration:', error);

      return {
        success: false,
        error: error.message || 'Failed to fetch users',
        statusCode: 500,
        data: {
          users: [],
          total: 0,
          page: parseInt(body.page) || 1,
          limit: parseInt(body.limit) || 20,
          hasMore: false,
        },
      };
    }
  }

  async findFullUserById(id: number) {
    const user = await this.userRepo.findOne({
      where: { id },
      relations: ['company', 'department'],
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const userLogs = await this.userLogRepo.findOne({
      where: { user: { id } },
    });

    const sanitizedUser = sanitizeUser(user);

    const [canUserCreate, canTripApprove] = await Promise.all([
      this.canUserCreate(user),
      this.canTripApprove(user),
    ]);

    const userData = {
      ...sanitizedUser,
      permissions: {
        canUserCreate,
        canTripApprove,
      },
      activityLogs: {
        lastLogin: userLogs?.lastLogin,
        lastAccess: userLogs?.lastAccess,
        device: userLogs?.deviceName,
        platform: userLogs?.platform,
        appVersion: userLogs?.appVersion,
        canLogin: userLogs?.isLogin,
      },
    };

    return {
      success: true,
      statusCode: 200,
      data: {
        user: userData,
      },
    };
  }

  async findAllByStatus(status?: string, page: number = 1, limit: number = 20) {
    // Calculate skip for pagination
    const skip = (page - 1) * limit;

    // Build where condition
    const whereCondition: any = {
      role: Not(UserRole.SYSADMIN),
    };

    // Add status filter if provided
    if (status && status.toLowerCase() !== 'all') {
      whereCondition.isApproved = status.toLowerCase();
    }

    // Execute query with pagination
    const [users, total] = await this.userRepo.findAndCount({
      where: whereCondition,
      relations: ['company', 'department'],
      order: { id: 'DESC' },
      take: limit,
      skip: skip,
    });

    const sanitizedUsers = sanitizeUsers(users);

    return this.responseService.success('Users retrieved successfully', {
      users: sanitizedUsers,
      total: total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / limit),
      hasNextPage: page * limit < total,
      hasPrevPage: page > 1,
    });
  }

  async findAllByDepartment(departmentId?: number) {
    const whereCondition = departmentId
      ? {
          department: { id: departmentId },
          role: Not(UserRole.SYSADMIN),
          isApproved: Status.APPROVED,
        }
      : {};

    const users = await this.userRepo.find({
      where: whereCondition,
      relations: ['company', 'department'],
      order: { createdAt: 'DESC' },
    });

    const minimalUsers = users.map((user) => ({
      id: user.id,
      displayname: user.displayname,
    }));

    return this.responseService.success('Users retrieved successfully', {
      users: minimalUsers,
      total: minimalUsers.length,
    });
  }

  async findAllHodUsers() {
    const whereCondition = { role: UserRole.ADMIN, isApproved: Status.APPROVED };

    const users = await this.userRepo.find({
      where: whereCondition,
      relations: ['company', 'department'],
      order: { createdAt: 'DESC' },
    });

    const minimalUsers = users.map((user) => ({
      id: user.id,
      displayname: user.displayname,
    }));

    return this.responseService.success('Users retrieved successfully', {
      users: minimalUsers,
      total: minimalUsers.length,
    });
  }

  async findAllByRole(roleName?: string) {
    // Create where condition properly
    const whereCondition: any = { isApproved: Status.APPROVED };

    if (roleName && roleName.trim() !== '') {
      // Validate role exists in enum
      const validRoles = Object.values(UserRole);
      if (!validRoles.includes(roleName as UserRole)) {
        throw new BadRequestException(`Invalid role: ${roleName}`);
      }
      whereCondition.role = roleName;
    }

    const users = await this.userRepo.find({
      where: whereCondition,
      order: { createdAt: 'DESC' },
    });

    const minimalUsers = users.map((user) => ({
      id: user.id,
      displayname: user.displayname,
      role: user.role, // Include role in response if needed
    }));

    return this.responseService.success('Users retrieved successfully', {
      users: minimalUsers,
      total: users.length, // Use original users length
    });
  }

  async findAllBySearching(search?: string) {
    // Create query builder
    const queryBuilder = this.userRepo
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.company', 'company')
      .leftJoinAndSelect('user.department', 'department')
      .where('user.role != :sysadminRole', { sysadminRole: UserRole.SYSADMIN })
      .andWhere('user.isApproved = :status', { status: Status.APPROVED })
      .orderBy('user.createdAt', 'DESC')
      .take(5); // limit

    // Add search conditions if search term is provided
    if (search && search.trim()) {
      const searchTerm = `%${search.trim()}%`;
      queryBuilder.andWhere(
        new Brackets((qb) => {
          qb.where('user.displayname ILIKE :search', { search: searchTerm })
            .orWhere('user.email ILIKE :search', { search: searchTerm })
            .orWhere('user.username ILIKE :search', { search: searchTerm });
        }),
      );
    }

    // Execute query
    const users = await queryBuilder.getMany();

    // Transform to minimal user data
    const minimalUsers = users.map((user) => ({
      id: user.id,
      displayname: user.displayname,
      role: user.role,
      phone: user.phone,
      departmentName: user.department?.name,
    }));

    return this.responseService.success('Users retrieved successfully', {
      users: minimalUsers,
      total: minimalUsers.length,
    });
  }

  async findAllByApprovalSearching(search?: string) {
    // Create query builder
    const queryBuilder = this.userRepo
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.company', 'company')
      .leftJoinAndSelect('user.department', 'department')
      //.where('user.role != :sysadminRole', { sysadminRole: UserRole.SYSADMIN })
      .where('user.role IN (:...roles)', {
        roles: [UserRole.ADMIN, UserRole.HR, UserRole.EMPLOYEE, UserRole.SUPERVISOR],
      })
      .andWhere('user.isApproved = :status', { status: Status.APPROVED })
      .andWhere('user.authenticationLevel = :authLevel', { authLevel: 0 }) // Add this line
      .orderBy('user.createdAt', 'DESC')
      .take(10); // limit

    // Add search conditions if search term is provided
    if (search && search.trim()) {
      const searchTerm = `%${search.trim()}%`;
      queryBuilder.andWhere(
        new Brackets((qb) => {
          qb.where('user.displayname ILIKE :search', { search: searchTerm })
            .orWhere('user.email ILIKE :search', { search: searchTerm })
            .orWhere('user.username ILIKE :search', { search: searchTerm });
        }),
      );
    }

    // Execute query
    const users = await queryBuilder.getMany();

    // Transform to minimal user data
    const minimalUsers = users.map((user) => ({
      id: user.id,
      displayname: user.displayname,
      role: user.role,
      departmentName: user.department?.name,
    }));

    return this.responseService.success('Users retrieved successfully', {
      users: minimalUsers,
      total: minimalUsers.length,
    });
  }

  async findAllByTripApprovalSearching(search?: string) {
    // Create query builder
    const queryBuilder = this.userRepo
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.company', 'company')
      .leftJoinAndSelect('user.department', 'department')
      //.where('user.role != :sysadminRole', { sysadminRole: UserRole.SYSADMIN })
      .where('user.role IN (:...roles)', {
        roles: [UserRole.ADMIN, UserRole.HR, UserRole.EMPLOYEE, UserRole.SUPERVISOR],
      })
      .andWhere('user.isApproved = :status', { status: Status.APPROVED })
      .andWhere('user.isTripApprover = :tripApproverStatus', { tripApproverStatus: false }) // Add this line
      .orderBy('user.createdAt', 'DESC')
      .take(10); // limit

    // Add search conditions if search term is provided
    if (search && search.trim()) {
      const searchTerm = `%${search.trim()}%`;
      queryBuilder.andWhere(
        new Brackets((qb) => {
          qb.where('user.displayname ILIKE :search', { search: searchTerm })
            .orWhere('user.email ILIKE :search', { search: searchTerm })
            .orWhere('user.username ILIKE :search', { search: searchTerm });
        }),
      );
    }

    // Execute query
    const users = await queryBuilder.getMany();

    // Transform to minimal user data
    const minimalUsers = users.map((user) => ({
      id: user.id,
      displayname: user.displayname,
      role: user.role,
      departmentName: user.department?.name,
    }));

    return this.responseService.success('Users retrieved successfully', {
      users: minimalUsers,
      total: minimalUsers.length,
    });
  }

  async findAllBySafetyApprovalSearching(search?: string) {
    // Create query builder
    const queryBuilder = this.userRepo
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.company', 'company')
      .leftJoinAndSelect('user.department', 'department')
      //.where('user.role != :sysadminRole', { sysadminRole: UserRole.SYSADMIN })
      .where('user.role IN (:...roles)', {
        roles: [UserRole.ADMIN, UserRole.HR, UserRole.EMPLOYEE, UserRole.SUPERVISOR],
      })
      .andWhere('user.isApproved = :status', { status: Status.APPROVED })
      .andWhere('user.isSafetyApprover = :safetyApproverStatus', { safetyApproverStatus: false }) // Add this line
      .orderBy('user.createdAt', 'DESC')
      .take(10); // limit

    // Add search conditions if search term is provided
    if (search && search.trim()) {
      const searchTerm = `%${search.trim()}%`;
      queryBuilder.andWhere(
        new Brackets((qb) => {
          qb.where('user.displayname ILIKE :search', { search: searchTerm })
            .orWhere('user.email ILIKE :search', { search: searchTerm })
            .orWhere('user.username ILIKE :search', { search: searchTerm });
        }),
      );
    }

    // Execute query
    const users = await queryBuilder.getMany();

    // Transform to minimal user data
    const minimalUsers = users.map((user) => ({
      id: user.id,
      displayname: user.displayname,
      role: user.role,
      departmentName: user.department?.name,
    }));

    return this.responseService.success('Users retrieved successfully', {
      users: minimalUsers,
      total: minimalUsers.length,
    });
  }

  async setUserApprove(id: number, state: boolean, reqUser: User) {
    const user = await this.userRepo.findOne({
      where: { id: id },
    });

    if (!user) {
      throw new NotFoundException(this.responseService.error('User not found', 404));
    }

    const oldAuthLevel = user.authenticationLevel;

    if (state === true) {
      user.authenticationLevel = 3;
    } else {
      user.authenticationLevel = 0;
    }

    const savedUser = await this.userRepo.save(user);

    const minimalUser = {
      id: savedUser.id,
      displayName: savedUser.displayname,
      authenticationLevel: savedUser.authenticationLevel,
    };

    return this.responseService.success('User approved successfully', {
      user: minimalUser,
    });
  }

  async setTripsApproveUser(id: number, state: boolean, reqUser: User) {
    const user = await this.userRepo.findOne({
      where: { id: id },
    });

    if (!user) {
      throw new NotFoundException(this.responseService.error('User not found', 404));
    }

    const isTripApprover = user.isTripApprover;

    user.isTripApprover = state;

    const savedUser = await this.userRepo.save(user);

    const minimalUser = {
      id: savedUser.id,
      displayName: savedUser.displayname,
      isTripApprover: savedUser.isTripApprover,
    };

    return this.responseService.success('User approved successfully', {
      user: minimalUser,
    });
  }

  async setSafetyApproveUser(id: number, state: boolean, reqUser: User) {
    const user = await this.userRepo.findOne({
      where: { id: id },
    });

    if (!user) {
      throw new NotFoundException(this.responseService.error('User not found', 404));
    }

    user.isSafetyApprover = state;

    const savedUser = await this.userRepo.save(user);

    const minimalUser = {
      id: savedUser.id,
      displayName: savedUser.displayname,
      isSafetyApprover: savedUser.isSafetyApprover,
    };

    return this.responseService.success('User approved successfully', {
      user: minimalUser,
    });
  }

  async findAllByApproval() {
    const users = await this.userRepo.find({
      where: { authenticationLevel: 3, role: Not(UserRole.SYSADMIN) },
      relations: ['company', 'department'],
      order: { id: 'DESC' },
    });

    const minimalUsers = users.map((user) => ({
      id: user.id,
      displayname: user.displayname,
      role: user.role,
      departmentName: user.department.name,
    }));

    return this.responseService.success('Users retrieved successfully', {
      users: minimalUsers,
      total: minimalUsers.length,
    });
  }

  async findAllByTripApproval() {
    const users = await this.userRepo.find({
      where: { isTripApprover: true },
      relations: ['company', 'department'],
      order: { id: 'DESC' },
    });

    const minimalUsers = users.map((user) => ({
      id: user.id,
      displayname: user.displayname,
      role: user.role,
      departmentName: user.department.name,
    }));

    return this.responseService.success('Users retrieved successfully', {
      users: minimalUsers,
      total: minimalUsers.length,
    });
  }

  async findAllBySafetyApproval() {
    const users = await this.userRepo.find({
      where: { isSafetyApprover: true },
      relations: ['company', 'department'],
      order: { id: 'DESC' },
    });

    const minimalUsers = users.map((user) => ({
      id: user.id,
      displayname: user.displayname,
      role: user.role,
      departmentName: user.department.name,
    }));

    return this.responseService.success('Users retrieved successfully', {
      users: minimalUsers,
      total: minimalUsers.length,
    });
  }

  async checkTripCreationEligibility(userId: number): Promise<any> {
    // Get current user with department
    const currentUser = await this.userRepo.findOne({
      where: { id: userId },
      relations: ['department', 'department.head'], // 'head' instead of 'hod' based on your code
    });

    if (!currentUser) {
      return this.responseService.error('User not found', null);
    }

    if (!currentUser.department) {
      return this.responseService.error('User does not belong to any department', null);
    }

    // Check for HOD in the same department
    const hodExists = currentUser.department.head;

    if (!hodExists) {
      return this.responseService.error('This department does not have a HOD assigned');
    }

    // Check for at least one Supervisor in the SAME DEPARTMENT
    const supervisors = await this.userRepo.find({
      where: {
        role: UserRole.SUPERVISOR,
        isApproved: Status.APPROVED,
      },
    });

    const supervisorExists = supervisors.length > 0;

    if (!supervisorExists) {
      return this.responseService.error('No approved supervisors found');
    }

    const canCreateTrip = !!(hodExists && supervisorExists);

    return this.responseService.success('You can create trips', {
      canCreateTrip: true,
      department: {
        id: currentUser.department.id,
        name: currentUser.department.name,
        hodName: hodExists.displayname || 'HOD',
      },
      supervisorCount: 1, // or query actual count
    });
  }

  async findByEmail(email: string) {
    const user = await this.userRepo.findOne({ where: { email, role: Not(UserRole.SYSADMIN) } });
    if (!user) {
      throw new NotFoundException(this.responseService.error('User not found', 404));
    }

    return this.responseService.success('User retrieved successfully', {
      user,
    });
  }

  async findByUsername(username: string) {
    const user = await this.userRepo.findOne({ where: { username } });

    const sanitizedUser = sanitizeUser(user);

    if (!user) {
      throw new NotFoundException(this.responseService.error('User not found', 404));
    }

    return this.responseService.success('User retrieved successfully', {
      user: sanitizedUser,
    });
  }

  async findByUsernameAndMobile(username: string, mobile: string) {
    const user = await this.userRepo.findOne({
      where: {
        username: username,
        phone: mobile,
      },
    });

    return user;
  }

  async updatePassword(userId: number, newPasswordHash: string) {
    const result = await this.userRepo.update(
      { id: userId },
      {
        passwordHash: newPasswordHash,
        updatedAt: new Date(),
      },
    );

    if (result.affected === 0) {
      throw new NotFoundException(this.responseService.error('User not found', 404));
    }

    return this.responseService.success('Password updated successfully');
  }

  async findAuthByUsername(username: string) {
    const user = await this.userRepo.findOne({
      where: { username },
      relations: ['company', 'department'],
    });

    return user;
  }

  async findById(id: number) {
    const user = await this.userRepo.findOne({ where: { id } });

    const sanitizedUser = sanitizeUser(user);

    if (!user) {
      throw new NotFoundException(this.responseService.error('User not found', 404));
    }

    return this.responseService.success('User retrieved successfully', {
      user: sanitizedUser,
    });
  }

  private async canUserCreate(user: any): Promise<boolean> {
    // Your existing logic, make it async if needed
    const allowedRoles = [UserRole.HR, UserRole.SYSADMIN];
    if (allowedRoles.includes(user.role)) return true;
    if (user.role === UserRole.EMPLOYEE && user.authenticationLevel === 3) return true;
    return false;
  }

  private async canTripApprove(user: any): Promise<boolean> {
    const approvalConfig = await this.approvalConfigService.findMenuApprovalForAuth(user.id);
    return (
      user.role === UserRole.SYSADMIN ||
      user.isTripApprover === true ||
      approvalConfig?.secondaryUserId === user.id ||
      approvalConfig?.safetyUserId === user.id ||
      approvalConfig?.hodId === user.id
    );
  }

  private async canSafetyApprove(user: any): Promise<boolean> {
    const approvalConfig = await this.approvalConfigService.findMenuApprovalForAuth(user.id);
    return (
      user.role === UserRole.SYSADMIN ||
      user.isSafetyApprover === true ||
      approvalConfig?.safetyUserId === user.id
    );
  }

  async initialUserData(id: number) {
    const user = await this.userRepo.findOne({ where: { id } });

    if (user) {
      const sanitizedUser: UserData = sanitizeUser(user);

      const [canUserCreate, canTripApprove, canSafetyApprove] = await Promise.all([
        this.canUserCreate(user),
        this.canTripApprove(user),
        this.canSafetyApprove(user),
      ]);

      const userWithPermissions = {
        ...sanitizedUser,
        permissions: {
          canUserCreate,
          canTripApprove,
          canSafetyApprove,
        },
      };

      return this.responseService.success('User data retrieved successfully', {
        user: userWithPermissions,
      });
    } else {
      this.responseService.error('User not found', 404);
    }
  }

  async updateUser(id: number, dto: UpdateUserDto) {
    // Find the existing user
    const existingUser = await this.userRepo.findOne({ where: { id } });
    if (!existingUser) {
      throw new NotFoundException(this.responseService.error('User not found.', 404));
    }
    // Check required fields
    await this.validateRequiredFields(dto);

    // Check for unique constraints
    await this.validateUniqueFields(dto);

    // Prepare update data (only update provided fields)
    const updateData: Partial<User> = {};

    if (dto.username !== undefined) updateData.username = dto.username;
    if (dto.displayname !== undefined) updateData.displayname = dto.displayname;
    if (dto.email !== undefined) updateData.email = dto.email;
    if (dto.phone !== undefined) updateData.phone = dto.phone;
    if (dto.role !== undefined) updateData.role = dto.role;
    if (dto.isActive !== undefined) updateData.isActive = dto.isActive;

    // Update password if provided
    if (dto.password) {
      updateData.passwordHash = await hash(dto.password);
    }

    // Update the user
    await this.userRepo.update(id, updateData);

    // Fetch the updated user
    const updatedUser = await this.userRepo.findOne({ where: { id } });

    const sanitizedUser = sanitizeUser(updatedUser);

    return this.responseService.success('User update successfully.', {
      user: sanitizedUser,
    });
  }

  async deactivateUser(id: number) {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException(this.responseService.error('User not found', 404));
    }

    // Check if user is already deactivated
    if (!user.isActive) {
      throw new BadRequestException(this.responseService.error('User is already deactivated', 400));
    }

    user.isActive = false;

    const deactivatedUser = await this.userRepo.save(user);

    const sanitizedUser = sanitizeUser(deactivatedUser);

    return this.responseService.success('User deactivated successfully', {
      user: sanitizedUser,
    });
  }

  async activateUser(id: number) {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException(this.responseService.error('User not found', 404));
    }

    // Check if user is already active
    if (user.isActive) {
      throw new BadRequestException(this.responseService.error('User is already active', 400));
    }

    user.isActive = true;

    const activatedUser = await this.userRepo.save(user);

    const sanitizedUser = sanitizeUser(activatedUser);

    return this.responseService.success('User activated successfully', {
      user: sanitizedUser,
    });
  }

  // Optional: Hard delete (permanent removal)
  async deleteUser(id: number) {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException(this.responseService.error('User not found', 404));
    }

    await this.userRepo.delete(id);

    return this.responseService.success('User deleted permanently', {
      deletedUserId: id,
    });
  }

  async updateProfilePicture(id: number, file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException(this.responseService.error('No file uploaded', 400));
    }

    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException(this.responseService.error('User not found', 404));
    }

    // Delete old profile picture if exists
    if (user.profilePicture) {
      const fs = require('fs');
      const path = require('path');
      const oldFilePath = path.join(process.cwd(), user.profilePicture);

      if (fs.existsSync(oldFilePath)) {
        fs.unlinkSync(oldFilePath);
      }
    }

    // Update user with new profile picture path
    user.profilePicture = `uploads/profiles/${file.filename}`;
    const updatedUser = await this.userRepo.save(user);

    const sanitizedUser = sanitizeUser(updatedUser);

    return this.responseService.success('Profile picture updated successfully', {
      user: sanitizedUser,
      profilePicture: {
        filename: file.filename,
        originalname: file.originalname,
        size: file.size,
        mimetype: file.mimetype,
        path: user.profilePicture,
      },
    });
  }

  async removeProfilePicture(id: number) {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException(this.responseService.error('User not found', 404));
    }

    if (!user.profilePicture) {
      throw new BadRequestException(
        this.responseService.error('No profile picture to remove', 400),
      );
    }

    // Delete file from storage
    const fs = require('fs');
    const path = require('path');
    const filePath = path.join(process.cwd(), user.profilePicture);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    // Remove profile picture from user
    user.profilePicture = null;
    const updatedUser = await this.userRepo.save(user);

    const sanitizedUser = sanitizeUser(updatedUser);

    return this.responseService.success('Profile picture removed successfully', {
      user: sanitizedUser,
    });
  }
}
