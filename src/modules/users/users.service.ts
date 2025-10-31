
import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole } from 'src/database/entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { Company } from 'src/database/entities/company.entity';
import { hash } from 'src/common/utils/hash.util';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Company)
    private readonly companyRepo: Repository<Company>,
  ) {}

  async validateRequiredFields(dto: CreateUserDto): Promise<void> {
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
        `The following fields are required: ${missingFields.join(', ')}`
      );
    }
  }

  async validateUniqueFields(dto: CreateUserDto): Promise<void> {
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
      
      throw new BadRequestException({
        message: `The following fields are already registered: ${errors.join(', ')}`,
        fields: errors,
      });
    }
  }

  async createUser(dto: CreateUserDto): Promise<User> {
    console.log("body : " + dto)
    
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

    // Create user (not approved yet)
    const user = this.userRepo.create({
      username: dto.username,
      displayname: dto.displayname,
      email: dto.email,
      phone: dto.phone,
      role: dto.role,
      passwordHash,
      isApproved: false,
      isActive: true,
    });

    return this.userRepo.save(user);
  }

  async approveUser(id: number): Promise<User> {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new BadRequestException('User not found.');

    user.isApproved = true;
    user.isActive = true;

    return this.userRepo.save(user);
  }

  async findAll(): Promise<User[]> {
    return this.userRepo.find({ relations: ['company'] });
  }

  async findByEmail(email: string): Promise<User> {
    const user = await this.userRepo.findOne({ where: { email } });
    if (!user) throw new BadRequestException('User not found.');

    return user;
  }

  async findByUsername(username: string): Promise<User> {
    const user = await this.userRepo.findOne({ where: { username } });
    if (!user) throw new BadRequestException('User not found.');

    return user;
  }

}

