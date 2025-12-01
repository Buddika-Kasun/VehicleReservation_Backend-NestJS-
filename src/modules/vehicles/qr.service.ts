// src/vehicles/qr.service.ts
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as QRCode from 'qrcode';
import { Vehicle } from 'src/database/entities/vehicle.entity';
import { Trip, TripStatus } from 'src/database/entities/trip.entity';
import { OdometerLog } from 'src/database/entities/odometer-log.entity';
import { User } from 'src/database/entities/user.entity';
import { ResponseService } from 'src/common/services/response.service';
import { GenerateQrDto, ScanQrDto } from './dto/qr-request.dto';
import { PaginationQueryDto } from 'src/common/dto/pagination.dto';

@Injectable()
export class QrService {
  constructor(
    @InjectRepository(Vehicle)
    private readonly vehicleRepo: Repository<Vehicle>,
    @InjectRepository(Trip)
    private readonly tripRepo: Repository<Trip>,
    @InjectRepository(OdometerLog)
    private readonly odometerLogRepo: Repository<OdometerLog>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly responseService: ResponseService,
  ) {}

  // FR-05.1: Generate QR code for vehicle
  async generateVehicleQrCode(generateQrDto: GenerateQrDto) {
    const vehicle = await this.vehicleRepo.findOne({ 
      where: { id: generateQrDto.vehicleId },
      select: ['id', 'regNo', 'model', 'odometerLastReading']
    });
    
    if (!vehicle) {
      throw new NotFoundException(this.responseService.error('Vehicle not found', 404));
    }

    // QR data contains vehicle ID and last odometer for verification
    const qrData = `vehicle:${vehicle.id}:odometer:${vehicle.odometerLastReading}`;
    
    try {
      const qrCodeDataUrl = await QRCode.toDataURL(qrData, {
        width: 300,
        margin: 2,
        color: { dark: '#000000', light: '#FFFFFF' }
      });

      const result = {
        qrCodeDataUrl,
        vehicleId: vehicle.id,
        vehicleRegNo: vehicle.regNo,
        vehicleModel: vehicle.model,
        odometerLastReading: vehicle.odometerLastReading,
        timestamp: new Date()
      };

      return this.responseService.success('QR code generated successfully', result);
    } catch (error) {
      throw new BadRequestException(this.responseService.error('Failed to generate QR code', 400));
    }
  }

  // FR-05.2 & FR-05.3: Scan QR code and process trip
  async processQrScan(scanQrDto: ScanQrDto, scannedByUserId: number) {
    // Parse QR data: vehicle:{id}:odometer:{lastReading}
    const parts = scanQrDto.qrData.split(':');
    
    if (parts.length < 4 || parts[0] !== 'vehicle') {
      throw new BadRequestException(this.responseService.error('Invalid QR code format', 400));
    }

    const vehicleId = parseInt(parts[1]);
    const lastOdometerFromQr = parseFloat(parts[3]);

    // Validate vehicle
    const vehicle = await this.vehicleRepo.findOne({ 
      where: { id: vehicleId },
      select: ['id', 'regNo', 'model', 'odometerLastReading', 'vehicleType', 'fuelType', 'seatingCapacity']
    });
    
    if (!vehicle) {
      throw new NotFoundException(this.responseService.error('Vehicle not found', 404));
    }

    // Verify QR data matches current vehicle state
    if (lastOdometerFromQr !== vehicle.odometerLastReading) {
      throw new BadRequestException(
        this.responseService.error('QR code data is outdated', 400)
      );
    }

    // Validate odometer reading
    if (scanQrDto.odometerReading < vehicle.odometerLastReading) {
      throw new BadRequestException(
        this.responseService.error(
          `Odometer reading (${scanQrDto.odometerReading}) cannot be less than last reading (${vehicle.odometerLastReading})`, 
          400
        )
      );
    }

    const scannedBy = await this.userRepo.findOne({ 
      where: { id: scannedByUserId },
      select: ['id', 'displayname', 'email']
    });

    if (!scannedBy) {
      throw new NotFoundException(this.responseService.error('User not found', 404));
    }

    // Find relevant trip
    const activeTrip = await this.findActiveTripForVehicle(vehicleId);
    const approvedTrip = await this.findApprovedTripForVehicle(vehicleId);
    const trip = activeTrip || approvedTrip;

    let scanType: 'entry' | 'exit' = 'entry';
    let tripUpdate = null;

    if (trip) {
      // Determine if this is start (exit) or end (entry) of trip
      const isStart = !trip.startOdometer;
      scanType = isStart ? 'exit' : 'entry';

      // Update trip
      tripUpdate = await this.updateTripOdometer(
        trip.id, 
        scanQrDto.odometerReading, 
        isStart,
        !isStart ? scanQrDto.actualPassengers : undefined
      );
    } else {
      // No trip - determine scan type based on vehicle status
      const lastTrip = await this.getLastTripForVehicle(vehicleId);
      scanType = lastTrip && lastTrip.status === TripStatus.COMPLETED ? 'entry' : 'exit';
    }

    // Update vehicle odometer
    await this.vehicleRepo.update(vehicleId, {
      odometerLastReading: scanQrDto.odometerReading,
      updatedAt: new Date()
    });

    // Create odometer log
    await this.createOdometerLog(
      vehicleId,
      trip?.id,
      scanQrDto.odometerReading,
      scanType === 'exit',
      scannedBy,
      scanQrDto.notes
    );

    const result = {
      success: true,
      vehicle: {
        id: vehicle.id,
        regNo: vehicle.regNo,
        model: vehicle.model,
        vehicleType: vehicle.vehicleType,
        fuelType: vehicle.fuelType,
        seatingCapacity: vehicle.seatingCapacity,
        odometerLastReading: scanQrDto.odometerReading
      },
      odometerReading: scanQrDto.odometerReading,
      scanType,
      timestamp: new Date(),
      tripUpdate: tripUpdate ? {
        tripId: tripUpdate.id,
        status: tripUpdate.status,
        startOdometer: tripUpdate.startOdometer,
        endOdometer: tripUpdate.endOdometer,
        mileage: tripUpdate.mileage,
        cost: tripUpdate.cost
      } : null,
      recordedBy: {
        id: scannedBy.id,
        name: scannedBy.displayname,
        email: scannedBy.email
      }
    };

    const message = this.generateScanMessage(scanType, !!tripUpdate);
    return this.responseService.success(message, result);
  }

  // Get vehicle odometer history
  async getVehicleOdometerHistory(vehicleId: number, paginationQueryDto: PaginationQueryDto) {
    const vehicle = await this.vehicleRepo.findOne({ 
      where: { id: vehicleId },
      select: ['id', 'regNo']
    });

    if (!vehicle) {
      throw new NotFoundException(this.responseService.error('Vehicle not found', 404));
    }

    const [odometerLogs, total] = await this.odometerLogRepo.findAndCount({
      where: { vehicle: { id: vehicleId } },
      relations: ['trip', 'recordedBy'],
      order: { timestamp: 'DESC' },
      skip: (paginationQueryDto.page - 1) * paginationQueryDto.limit,
      take: paginationQueryDto.limit,
    });

    const totalPages = Math.ceil(total / paginationQueryDto.limit);

    const pagination = {
      page: paginationQueryDto.page,
      limit: paginationQueryDto.limit,
      total,
      totalPages
    };

    return this.responseService.success(
      'Vehicle odometer history retrieved successfully',
      {
          odometerLogs,
          pagination
      }
    );
  }

  // Get vehicle info with current status
  async getVehicleInfo(vehicleId: number) {
    const vehicle = await this.vehicleRepo.findOne({ 
      where: { id: vehicleId },
      relations: ['assignedDriverPrimary', 'assignedDriverSecondary'],
      select: [
        'id', 'regNo', 'model', 'fuelType', 'seatingCapacity', 
        'vehicleImage', 'odometerLastReading', 'vehicleType',
        'assignedDriverPrimary', 'assignedDriverSecondary', 'isActive'
      ]
    });

    if (!vehicle) {
      throw new NotFoundException(this.responseService.error('Vehicle not found', 404));
    }

    // Get current trip status
    const activeTrip = await this.findActiveTripForVehicle(vehicleId);
    const currentStatus = activeTrip ? 'on_trip' : 'available';

    const vehicleInfo = {
      id: vehicle.id,
      regNo: vehicle.regNo,
      model: vehicle.model,
      fuelType: vehicle.fuelType,
      seatingCapacity: vehicle.seatingCapacity,
      vehicleImage: vehicle.vehicleImage,
      odometerLastReading: vehicle.odometerLastReading,
      vehicleType: vehicle.vehicleType,
      isActive: vehicle.isActive,
      assignedDriverPrimary: vehicle.assignedDriverPrimary ? {
        id: vehicle.assignedDriverPrimary.id,
        name: vehicle.assignedDriverPrimary.displayname
      } : null,
      assignedDriverSecondary: vehicle.assignedDriverSecondary ? {
        id: vehicle.assignedDriverSecondary.id,
        name: vehicle.assignedDriverSecondary.displayname
      } : null,
      currentStatus,
      activeTrip: activeTrip ? {
        id: activeTrip.id,
        //origin: activeTrip.origin,
        //destination: activeTrip.destination,
        startDate: activeTrip.startDate,
        status: activeTrip.status
      } : null
    };

    return this.responseService.success(
      'Vehicle information retrieved successfully',
      vehicleInfo
    );
  }

  // Helper methods
  private async findActiveTripForVehicle(vehicleId: number): Promise<Trip | null> {
    return this.tripRepo.findOne({
      where: {
        vehicle: { id: vehicleId },
        status: TripStatus.ONGOING,
      },
      relations: ['vehicle'],
    });
  }

  private async findApprovedTripForVehicle(vehicleId: number): Promise<Trip | null> {
    return this.tripRepo.findOne({
      where: {
        vehicle: { id: vehicleId },
        status: TripStatus.APPROVED,
        startOdometer: null,
      },
      relations: ['vehicle'],
      order: { startDate: 'DESC' },
    });
  }

  private async getLastTripForVehicle(vehicleId: number): Promise<Trip | null> {
    return this.tripRepo.findOne({
      where: { vehicle: { id: vehicleId } },
      order: { startDate: 'DESC' },
    });
  }

  private async updateTripOdometer(
    tripId: number, 
    odometerReading: number, 
    isStart: boolean,
    actualPassengers?: number
  ) {
    const trip = await this.tripRepo.findOne({ where: { id: tripId } });
    if (!trip) throw new Error('Trip not found');

    if (isStart) {
      trip.startOdometer = odometerReading;
      trip.status = TripStatus.ONGOING;
    } else {
      trip.endOdometer = odometerReading;
      // Update passenger count if provided
      if (actualPassengers !== undefined) {
        //trip.passengers = actualPassengers;
      }
      
      if (trip.startOdometer) {
        trip.mileage = Number((odometerReading - trip.startOdometer).toFixed(2));
      }
      
      trip.status = TripStatus.COMPLETED;
      //trip.endDate = new Date();
      //trip.endTime = new Date().toTimeString().split(' ')[0];
      
      trip.cost = await this.calculateTripCost(trip);
    }

    return this.tripRepo.save(trip);
  }

  private async calculateTripCost(trip: Trip): Promise<number> {
    const baseRate = 50;
    const mileageRate = 2;
    const passengerRate = 5;
    //const cost = baseRate + (trip.mileage || 0) * mileageRate + (trip.passengers || 1) * passengerRate;
    //return Number(cost.toFixed(2));
    return Number(2);
  }

  private async createOdometerLog(
    vehicleId: number,
    tripId: number | undefined,
    reading: number,
    isStart: boolean,
    recordedBy: User,
    notes?: string
  ) {
    const logData: any = {
      vehicle: { id: vehicleId },
      [isStart ? 'startReading' : 'endReading']: reading,
      recordedBy,
      timestamp: new Date()
    };

    if (tripId) {
      logData.trip = { id: tripId };
    }

    if (notes) {
      // Store notes in a way that fits your OdometerLog entity
      // If you need to store notes, you might need to add a notes field to OdometerLog
    }

    const log = this.odometerLogRepo.create(logData);
    return this.odometerLogRepo.save(log);
  }

  private generateScanMessage(scanType: 'entry' | 'exit', hasTrip: boolean): string {
    if (hasTrip) {
      return scanType === 'exit' 
        ? 'Vehicle exit recorded - Trip started' 
        : 'Vehicle entry recorded - Trip completed';
    }
    return scanType === 'exit' 
      ? 'Vehicle exit recorded' 
      : 'Vehicle entry recorded';
  }
}