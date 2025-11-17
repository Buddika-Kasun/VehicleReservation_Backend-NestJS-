
import { Injectable, BadRequestException, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
import { Status, User, UserRole } from 'src/database/entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { Company } from 'src/database/entities/company.entity';
import { hash } from 'src/common/utils/hash.util';
import { ResponseService } from 'src/common/services/response.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { sanitizeUser, sanitizeUsers } from 'src/common/utils/sanitize-user.util';
import { RegisterResponseDto, UserData } from '../auth/dto/authResponse.dto';
import { Department } from 'src/database/entities/department.entity';
import { ApproveUserDto } from './dto/approve-user.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Company)
    private readonly companyRepo: Repository<Company>,
    private readonly responseService: ResponseService,
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
    if (role !== UserRole.DRIVER && role !== UserRole.SECURITY && !email) {
      missingFields.push('email');
    }

    if (missingFields.length > 0) {
      throw new BadRequestException(
        this.responseService.error(
          `The following fields are required: ${missingFields.join(', ')}`,
          400
        )
      );
      
    }
  }

  private async validateUniqueFields(dto: CreateUserDto): Promise<void> {
    const [existingUsername, existingEmail, existingPhone] = await Promise.all([
      this.userRepo.findOne({ where: { username: dto.username } }),
      this.userRepo.findOne({ where: { email: dto.email } }),
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
          409
        )
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
      department: { id: departmentId }
    });

    const savedUser = await this.userRepo.save(user);

    const sanitizedUser: UserData = sanitizeUser(savedUser);

    return this.responseService.created(
      'User registered successfully. Please wait for admin approval.',
      {
        user: sanitizedUser,
      }
    );
  }

  async approveUser(id: number, dto: ApproveUserDto) {
    const user = await this.userRepo.findOne({
      where: { id },
      relations: ['department'],
    });
    if (!user) {
      throw new NotFoundException(
        this.responseService.error(
          'User not found', 
          404
        )
      );
    }

    // Check if user is already approved
    if (user.isApproved === Status.APPROVED) {
      throw new BadRequestException(
        this.responseService.error(
          'User is already approved', 
          400
        )
      );
    }

    const departmentId = Number(dto.departmentId);

    user.isApproved = Status.APPROVED;
    user.isActive = true;
    user.department.id = departmentId;
    user.role = dto.role;

    const approvedUser = await this.userRepo.save(user);

    const sanitizedUser = sanitizeUser(approvedUser);

    return this.responseService.success(
      'User approved successfully',
      {
        user: sanitizedUser
      }
    );
  }

  async disapproveUser(id: number) {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException(
        this.responseService.error(
          'User not found', 
          404
        )
      );
    }

    user.isApproved = Status.REJECTED;

    const disapprovedUser = await this.userRepo.save(user);

    const sanitizedUser = sanitizeUser(disapprovedUser);

    return this.responseService.success(
      'User disapproved successfully',
      {
        user: sanitizedUser
      }
    );
  }

  async findAll() {
    const users = await this.userRepo.find({
      where: {
        role: Not(UserRole.SYSADMIN),
      },
      relations: ['company', 'department'],
    });

    const sanitizedUsers = sanitizeUsers(users);

    return this.responseService.success(
      'Users retrieved successfully',
      {
        users: sanitizedUsers,
        total: sanitizeUsers.length,
      }
    );
  }

  async findAllByDepartment(departmentId?: number) {
    const whereCondition = departmentId
      ? { department: { id: departmentId } }
      : {};

    const users = await this.userRepo.find({
      where: whereCondition,
      relations: ['company', 'department'],
      order: { createdAt: 'DESC' },
    });

    const minimalUsers = users.map(user => ({
      id: user.id,
      displayname: user.displayname,
    }));

    return this.responseService.success(
      'Users retrieved successfully',
      {
        users: minimalUsers,
        total: minimalUsers.length,
      },
    );
  }

  async findByEmail(email: string) {
    const user = await this.userRepo.findOne({ where: { email } });
    if (!user) {
      throw new NotFoundException(
        this.responseService.error('User not found', 404)
      );
    }

    return this.responseService.success(
      'User retrieved successfully',
      {
        user,
      }
    );
  }

  async findByUsername(username: string) {
    const user = await this.userRepo.findOne({ where: { username } });

    const sanitizedUser = sanitizeUser(user);

    if (!user) {
      throw new NotFoundException(
        this.responseService.error(
          'User not found', 
          404
        )
      );
    }

    return this.responseService.success(
      'User retrieved successfully',
      {
        user: sanitizedUser,
      }
    );
  }

  async findAuthByUsername(username: string) {
    const user = await this.userRepo.findOne({ where: { username }, relations: ['company'] });

    return user;
  }

  async findById(id: number) {
    const user = await this.userRepo.findOne({ where: { id } });

    const sanitizedUser = sanitizeUser(user);
    
    if (!user) {
      throw new NotFoundException(
        this.responseService.error(
          'User not found', 
          404
        )
      );
    }

    return this.responseService.success(
      'User retrieved successfully',
      {
        user: sanitizedUser,
      }
    );
  }

  async updateUser(id: number, dto: UpdateUserDto) {

    // Find the existing user
    const existingUser = await this.userRepo.findOne({ where: { id } });
    if (!existingUser) {
      throw new NotFoundException(
        this.responseService.error(
          'User not found.', 
          404
        )
      );
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

    return this.responseService.success(
      'User update successfully.',
      {
        user: sanitizedUser,
      }
    );

  }

  async deactivateUser(id: number) {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException(
        this.responseService.error(
          'User not found', 
          404
        )
      );
    }

    // Check if user is already deactivated
    if (!user.isActive) {
      throw new BadRequestException(
        this.responseService.error(
          'User is already deactivated',
          400
        )
      );
    }

    user.isActive = false;

    const deactivatedUser = await this.userRepo.save(user);

    const sanitizedUser = sanitizeUser(deactivatedUser);

    return this.responseService.success(
      'User deactivated successfully',
      {
        user: sanitizedUser
      }
    );
  }

  async activateUser(id: number) {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException(
        this.responseService.error(
          'User not found', 
          404
        )
      );
    }

    // Check if user is already active
    if (user.isActive) {
      throw new BadRequestException(
        this.responseService.error(
          'User is already active', 
          400
        )
      );
    }

    user.isActive = true;

    const activatedUser = await this.userRepo.save(user);

    const sanitizedUser = sanitizeUser(activatedUser);

    return this.responseService.success(
      'User activated successfully',
      {
        user: sanitizedUser
      }
    );
  }

  // Optional: Hard delete (permanent removal)
  async deleteUser(id: number) {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException(
        this.responseService.error(
          'User not found', 
          404
        )
      );
    }

    await this.userRepo.delete(id);

    return this.responseService.success(
      'User deleted permanently',
      {
        deletedUserId: id,
      }
    );
  }

  async updateProfilePicture(id: number, file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException(
        this.responseService.error(
          'No file uploaded', 
          400
        )
      );
    }

    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException(
        this.responseService.error(
          'User not found', 
          404
        )
      );
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

    return this.responseService.success(
      'Profile picture updated successfully',
      {
        user: sanitizedUser,
        profilePicture: {
          filename: file.filename,
          originalname: file.originalname,
          size: file.size,
          mimetype: file.mimetype,
          path: user.profilePicture,
        }
      }
    );
  }

  async removeProfilePicture(id: number) {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException(
        this.responseService.error(
          'User not found', 
          404
        )
      );
    }

    if (!user.profilePicture) {
      throw new BadRequestException(
        this.responseService.error(
          'No profile picture to remove', 
          400
        )
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

    return this.responseService.success(
      'Profile picture removed successfully',
      {
        user: sanitizedUser,
      }
    );
  }

}

