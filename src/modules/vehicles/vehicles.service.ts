import { Injectable, NotFoundException, BadRequestException, ConflictException, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Vehicle } from '../../database/entities/vehicle.entity';
import { Company } from '../../database/entities/company.entity';
import { User } from '../../database/entities/user.entity';
import { ResponseService } from '../../common/services/response.service';
import { AssignDriverDto, CreateVehicleDto, UpdateVehicleDto } from './dto/vehicle-request.dto';
import { CostConfiguration } from 'src/database/entities/cost-configuration.entity';
import * as QRCode from 'qrcode';
import { OdometerLog } from 'src/database/entities/odometer-log.entity';

@Injectable()
export class VehicleService {
  constructor(
    @InjectRepository(Vehicle)
    private readonly vehicleRepository: Repository<Vehicle>,
    @InjectRepository(Company)
    private readonly companyRepository: Repository<Company>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(CostConfiguration)
    private readonly costConfigurationRepository: Repository<CostConfiguration>,
    private readonly responseService: ResponseService,
  ) {}

  private async generateQRCodeBase64(data: any): Promise<string> {
    try {
      const jsonString = JSON.stringify(data);
      return await QRCode.toDataURL(jsonString, {
        width: 300,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });
    } catch (error) {
      throw new InternalServerErrorException(
        this.responseService.error(
          'Failed to generate QR code',
          500
        )
      );
    }
  }

  // FR-03.1: Add vehicles
  async createVehicle(createVehicleDto: CreateVehicleDto) {
    // Check if registration number already exists
    const existingVehicle = await this.vehicleRepository.findOne({
      where: { regNo: createVehicleDto.regNo }
    });

    if (existingVehicle) {
      throw new ConflictException(
        this.responseService.error(
          'Vehicle with this registration number already exists.',
          409
        )
      );
    }

    const companies = await this.companyRepository.find({ where: {isActive: true}});
    const company = companies[0];

    if (!company) {
      throw new NotFoundException(
        this.responseService.error(
          'Company not found.',
          404
        )
      );
    }

    let assignedDriverPrimary: User | null = null;
    if (createVehicleDto.assignedDriverPrimaryId) {
      assignedDriverPrimary = await this.userRepository.findOne({
        where: { id: createVehicleDto.assignedDriverPrimaryId }
      });

      if (!assignedDriverPrimary) {
        throw new NotFoundException(
          this.responseService.error(
            'Primary driver not found.',
            404
          )
        );
      }
    }

    let assignedDriverSecondary: User | null = null;
    if (createVehicleDto.assignedDriverSecondaryId) {
      assignedDriverSecondary = await this.userRepository.findOne({
        where: { id: createVehicleDto.assignedDriverSecondaryId }
      });

      if (!assignedDriverSecondary) {
        throw new NotFoundException(
          this.responseService.error(
            'Secondary driver not found.',
            404
          )
        );
      }
    }

    let vehicleType: CostConfiguration | null = null;
    if (createVehicleDto.vehicleTypeId) {
      vehicleType = await this.costConfigurationRepository.findOne({
        where: { id: createVehicleDto.vehicleTypeId }
      });

      if (!vehicleType) {
        throw new NotFoundException(
          this.responseService.error(
            'Vehicle type not found.',
            404
          )
        );
      }
    }

    const vehicle = this.vehicleRepository.create({
      ...createVehicleDto,
      company,
      assignedDriverPrimary,
      assignedDriverSecondary,
      vehicleType,
      seatingAvailability: createVehicleDto.seatingCapacity,
    });

    const savedVehicle = await this.vehicleRepository.save(vehicle);

    // Prepare QR code data
    const qrCodeData = {
      vehicleId: savedVehicle.id,
      model: savedVehicle.model,
      regNo: savedVehicle.regNo,
      OdometerLastReading: savedVehicle.odometerLastReading,
      createdAt: savedVehicle.createdAt.toISOString(),
      updatedAt: savedVehicle.updatedAt.toISOString(),
      type: savedVehicle.vehicleType,
      action: 'view-details'
    };

    // Format as readable text instead of JSON
  const qrCodeText = `
VEHICLE INFORMATION
──────────────────
ID: ${savedVehicle.id}
Model: ${savedVehicle.model}
Register No: ${savedVehicle.regNo}
Type: ${savedVehicle.vehicleType.vehicleType}
Last Odometer: ${savedVehicle.odometerLastReading}
Created: ${savedVehicle.createdAt.toLocaleDateString()}
Updated: ${savedVehicle.updatedAt.toLocaleDateString()}
──────────────────
Scan Date: ${new Date().toLocaleDateString()}
  `.trim();

    // Generate QR code
    const qrCodeBase64 = await this.generateQRCodeBase64(qrCodeText);

    // Update vehicle with QR code and data
    savedVehicle.qrCode = qrCodeBase64;
    //savedVehicle.qrCodeData = qrCodeData;

    const savedVehicleQr = await this.vehicleRepository.save(savedVehicle);

    return this.responseService.created(
      'Vehicle created successfully.',
      {
        vehicle: savedVehicleQr
      }
    );
  }

  // Get all vehicles with filtering and pagination
  async getAllVehicles(
    page = 1,
    limit = 10,
    companyId?: number,
    isActive?: boolean,
    search?: string
  ) {
    const skip = (page - 1) * limit;
    const query = this.vehicleRepository
      .createQueryBuilder('vehicle')
      .leftJoinAndSelect('vehicle.company', 'company')
      .leftJoinAndSelect('vehicle.vehicleType', 'vehicleType')
      .leftJoinAndSelect('vehicle.assignedDriverPrimary', 'assignedDriverPrimary')
      .leftJoinAndSelect('vehicle.assignedDriverSecondary', 'assignedDriverSecondary');

    if (companyId) {
      query.andWhere('vehicle.companyId = :companyId', { companyId });
    }

    if (isActive !== undefined) {
      query.andWhere('vehicle.isActive = :isActive', { isActive });
    }

    if (search) {
      query.andWhere('(vehicle.regNo LIKE :search OR vehicle.model LIKE :search)', {
        search: `%${search}%`
      });
    }

    const [vehicles, total] = await query
      .skip(skip)
      .take(limit)
      .orderBy('vehicle.createdAt', 'DESC')
      .getManyAndCount();

    return this.responseService.success(
      'Vehicles retrieved successfully.',
      {
        vehicles,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      }
    );
  }

  // Get vehicle by ID
  async getVehicle(id: number) {
    const vehicle = await this.vehicleRepository.findOne({
      where: { id },
      relations: [
        'company',
        'assignedDriverPrimary',
        'assignedDriverSecondary',
        'trips',
        'odometerLogs'
      ]
    });

    if (!vehicle) {
      throw new NotFoundException(
        this.responseService.error(
          'Vehicle not found.',
          404
        )
      );
    }

    return this.responseService.success(
      'Vehicle retrieved successfully.',
      {
        vehicle
      }
    );
  }

  // FR-03.2: Edit vehicle details
  async updateVehicle(id: number, updateVehicleDto: UpdateVehicleDto) {
    const vehicle = await this.vehicleRepository.findOne({
      where: { id },
      relations: ['company', 'assignedDriverPrimary', 'assignedDriverSecondary']
    });

    if (!vehicle) {
      throw new NotFoundException(
        this.responseService.error(
          'Vehicle not found.',
          404
        )
      );
    }

    // Check if registration number is being changed and if new one already exists
    if (updateVehicleDto.regNo && updateVehicleDto.regNo !== vehicle.regNo) {
      const existingVehicle = await this.vehicleRepository.findOne({
        where: { regNo: updateVehicleDto.regNo }
      });

      if (existingVehicle) {
        throw new ConflictException(
          this.responseService.error(
            'Vehicle with this registration number already exists.',
            409
          )
        );
      }
    }

    // Update primary driver if changed
    if (updateVehicleDto.assignedDriverPrimaryId !== undefined) {
      if (updateVehicleDto.assignedDriverPrimaryId === null) {
        vehicle.assignedDriverPrimary = null;
      } else if (updateVehicleDto.assignedDriverPrimaryId !== vehicle.assignedDriverPrimary?.id) {
        const driver = await this.userRepository.findOne({
          where: { id: updateVehicleDto.assignedDriverPrimaryId }
        });

        if (!driver) {
          throw new NotFoundException(
            this.responseService.error(
              'Primary driver not found.',
              404
            )
          );
        }
        vehicle.assignedDriverPrimary = driver;
      }
    }

    // Update secondary driver if changed
    if (updateVehicleDto.assignedDriverSecondaryId !== undefined) {
      if (updateVehicleDto.assignedDriverSecondaryId === null) {
        vehicle.assignedDriverSecondary = null;
      } else if (updateVehicleDto.assignedDriverSecondaryId !== vehicle.assignedDriverSecondary?.id) {
        const driver = await this.userRepository.findOne({
          where: { id: updateVehicleDto.assignedDriverSecondaryId }
        });

        if (!driver) {
          throw new NotFoundException(
            this.responseService.error(
              'Secondary driver not found.',
              404
            )
          );
        }
        vehicle.assignedDriverSecondary = driver;
      }
    }

    Object.assign(vehicle, updateVehicleDto);
    const updatedVehicle = await this.vehicleRepository.save(vehicle);

    return this.responseService.success(
      'Vehicle updated successfully.',
      {
        vehicle: updatedVehicle
      }
    );
  }

  // FR-03.2: Delete vehicle
  async deleteVehicle(id: number) {
    const vehicle = await this.vehicleRepository.findOne({
      where: { id },
      relations: ['trips']
    });

    if (!vehicle) {
      throw new NotFoundException(
        this.responseService.error(
          'Vehicle not found.',
          404
        )
      );
    }

    // Check if vehicle has trips
    if (vehicle.trips && vehicle.trips.length > 0) {
      throw new BadRequestException(
        this.responseService.error(
          'Cannot delete vehicle with associated trips.',
          400
        )
      );
    }

    await this.vehicleRepository.remove(vehicle);

    return this.responseService.success(
      'Vehicle deleted successfully.',
      {
        deletedVehicleId: id
      }
    );
  }

  // FR-03.3: Assign drivers to vehicles
  async assignDrivers(assignDriverDto: AssignDriverDto) {
    const vehicle = await this.vehicleRepository.findOne({
      where: { id: assignDriverDto.vehicleId },
      relations: ['assignedDriverPrimary', 'assignedDriverSecondary']
    });

    if (!vehicle) {
      throw new NotFoundException(
        this.responseService.error(
          'Vehicle not found.',
          404
        )
      );
    }

    if (assignDriverDto.primaryDriverId !== undefined) {
      if (assignDriverDto.primaryDriverId === null) {
        vehicle.assignedDriverPrimary = null;
      } else {
        const primaryDriver = await this.userRepository.findOne({
          where: { id: assignDriverDto.primaryDriverId }
        });

        if (!primaryDriver) {
          throw new NotFoundException(
            this.responseService.error(
              'Primary driver not found.',
              404
            )
          );
        }
        vehicle.assignedDriverPrimary = primaryDriver;
      }
    }

    if (assignDriverDto.secondaryDriverId !== undefined) {
      if (assignDriverDto.secondaryDriverId === null) {
        vehicle.assignedDriverSecondary = null;
      } else {
        const secondaryDriver = await this.userRepository.findOne({
          where: { id: assignDriverDto.secondaryDriverId }
        });

        if (!secondaryDriver) {
          throw new NotFoundException(
            this.responseService.error(
              'Secondary driver not found.',
              404
            )
          );
        }
        vehicle.assignedDriverSecondary = secondaryDriver;
      }
    }

    const updatedVehicle = await this.vehicleRepository.save(vehicle);

    return this.responseService.success(
      'Drivers assigned successfully.',
      {
        vehicle: updatedVehicle
      }
    );
  }

  // Toggle vehicle status
  async toggleVehicleStatus(id: number) {
    const vehicle = await this.vehicleRepository.findOne({ where: { id } });

    if (!vehicle) {
      throw new NotFoundException(
        this.responseService.error(
          'Vehicle not found.',
          404
        )
      );
    }

    vehicle.isActive = !vehicle.isActive;
    const updatedVehicle = await this.vehicleRepository.save(vehicle);

    return this.responseService.success(
      `Vehicle ${updatedVehicle.isActive ? 'activated' : 'deactivated'} successfully.`,
      {
        vehicle: updatedVehicle
      }
    );
  }

  // Update odometer reading
  async updateOdometer(id: number, odometerReading: number) {
    const vehicle = await this.vehicleRepository.findOne({ where: { id } });

    if (!vehicle) {
      throw new NotFoundException(
        this.responseService.error(
          'Vehicle not found.',
          404
        )
      );
    }

    if (odometerReading < vehicle.odometerLastReading) {
      throw new BadRequestException(
        this.responseService.error(
          'New odometer reading cannot be less than the current reading.',
          400
        )
      );
    }

    vehicle.odometerLastReading = odometerReading;
    const updatedVehicle = await this.vehicleRepository.save(vehicle);

    return this.responseService.success(
      'Odometer reading updated successfully.',
      {
        vehicle: updatedVehicle
      }
    );
  }

  // Get vehicles by company
  async getCompanyVehicles(companyId: number, isActive?: boolean) {
    const whereCondition: any = { company: { id: companyId } };
    
    if (isActive !== undefined) {
      whereCondition.isActive = isActive;
    }

    const vehicles = await this.vehicleRepository.find({
      where: whereCondition,
      relations: ['assignedDriverPrimary', 'assignedDriverSecondary'],
      order: { regNo: 'ASC' }
    });

    return this.responseService.success(
      'Company vehicles retrieved successfully.',
      {
        vehicles,
        total: vehicles.length
      }
    );
  }

  // Get available vehicles (without assigned drivers)
  async getAvailableVehicles(companyId?: number) {
    const query = this.vehicleRepository
      .createQueryBuilder('vehicle')
      .leftJoinAndSelect('vehicle.company', 'company')
      .leftJoinAndSelect('vehicle.assignedDriverPrimary', 'assignedDriverPrimary')
      .where('vehicle.isActive = :isActive', { isActive: true })
      .andWhere('vehicle.assignedDriverPrimary IS NULL');

    if (companyId) {
      query.andWhere('vehicle.companyId = :companyId', { companyId });
    }

    const vehicles = await query
      .orderBy('vehicle.regNo', 'ASC')
      .getMany();

    return this.responseService.success(
      'Available vehicles retrieved successfully.',
      {
        vehicles,
        total: vehicles.length
      }
    );
  }

  // Get vehicles by driver
  async getDriverVehicles(driverId: number) {
    const vehicles = await this.vehicleRepository.find({
      where: [
        { assignedDriverPrimary: { id: driverId } },
        { assignedDriverSecondary: { id: driverId } }
      ],
      relations: ['company', 'assignedDriverPrimary', 'assignedDriverSecondary'],
      order: { regNo: 'ASC' }
    });

    // Separate primary and secondary vehicles
    const primaryVehicles = vehicles.filter(vehicle => 
      vehicle.assignedDriverPrimary?.id === driverId
    );

    const secondaryVehicles = vehicles.filter(vehicle => 
      vehicle.assignedDriverSecondary?.id === driverId
    );

    return this.responseService.success(
      'Driver vehicles retrieved successfully.',
      {
        primaryVehicles,
        secondaryVehicles,
        total: vehicles.length,
        primaryTotal: primaryVehicles.length,
        secondaryTotal: secondaryVehicles.length
      }
    );
  }

  async updateVehiclePicture(id: number, file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException(
        this.responseService.error(
          'No file uploaded', 
          400
        )
      );
    }

    const vehicle = await this.vehicleRepository.findOne({ where: { id } });
    if (!vehicle) {
      throw new NotFoundException(
        this.responseService.error(
          'Vehicle not found', 
          404
        )
      );
    }

    // Delete old vehicle picture if exists
    if (vehicle.vehicleImage) {
      const fs = require('fs');
      const path = require('path');
      const oldFilePath = path.join(process.cwd(), vehicle.vehicleImage);
      
      if (fs.existsSync(oldFilePath)) {
        fs.unlinkSync(oldFilePath);
      }
    }

    // Update vehicle with new picture path
    vehicle.vehicleImage = `uploads/vehicles/${file.filename}`;
    const updatedVehicle = await this.vehicleRepository.save(vehicle);

    return this.responseService.success(
      'Vehicle picture updated successfully',
      {
        vehicle: updatedVehicle,
        picture: {
          filename: file.filename,
          originalname: file.originalname,
          size: file.size,
          mimetype: file.mimetype,
          path: vehicle.vehicleImage,
        }
      }
    );
  }

  // Optional: Get vehicle picture
  async getVehiclePicture(id: number) {
    const vehicle = await this.vehicleRepository.findOne({ where: { id } });
    if (!vehicle) {
      throw new NotFoundException('Vehicle not found');
    }
    return vehicle.vehicleImage;
  }

}