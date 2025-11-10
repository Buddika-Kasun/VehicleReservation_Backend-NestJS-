import { 
  Controller, 
  Post, 
  Body, 
  Get, 
  Param, 
  ParseIntPipe, 
  Query,
  UseGuards 
} from '@nestjs/common';
import { 
  ApiTags, 
  ApiOperation, 
  ApiResponse, 
  ApiBody, 
  ApiParam, 
  ApiBearerAuth,
  ApiQuery 
} from '@nestjs/swagger';
import { QrService } from './qr.service';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { GenerateQrDto, ScanQrDto } from './dto/qr-request.dto';
import { GetUser } from 'src/common/decorators/user.decorator';
import { PaginationQueryDto } from 'src/common/dto/pagination.dto';

@ApiTags('QR Code API')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('vehicle/qr')
export class QrController {
  constructor(private readonly qrService: QrService) {}

  @Post('generate')
  @ApiOperation({ 
    summary: 'FR-05.1: Generate QR code for vehicle',
    description: 'Generate QR code containing vehicle ID and last known odometer reading'
  })
  @ApiBody({ type: GenerateQrDto })
  @ApiResponse({ 
    status: 201, 
    description: 'QR code generated successfully'
  })
  @ApiResponse({ 
    status: 404, 
    description: 'Vehicle not found' 
  })
  async generateQrCode(@Body() generateQrDto: GenerateQrDto) {
    return this.qrService.generateVehicleQrCode(generateQrDto);
  }

  @Post('scan')
  @ApiOperation({ 
    summary: 'FR-05.2 & FR-05.3: Scan vehicle QR code', 
    description: 'Security personnel scan for departure/arrival with odometer recording. Automatically starts/completes trips.' 
  })
  @ApiBody({ type: ScanQrDto })
  @ApiResponse({ 
    status: 200, 
    description: 'QR code scanned successfully'
  })
  @ApiResponse({ 
    status: 400, 
    description: 'Invalid QR code format or invalid odometer reading' 
  })
  @ApiResponse({ 
    status: 404, 
    description: 'Vehicle not found' 
  })
  async scanQrCode(@Body() scanQrDto: ScanQrDto, @GetUser() user: any) {
    return this.qrService.processQrScan(scanQrDto, user.id);
  }

  @Get('odometer-history/:vehicleId')
  @ApiOperation({ 
    summary: 'Get vehicle odometer history',
    description: 'Get complete odometer reading history for a vehicle'
  })
  @ApiParam({ name: 'vehicleId', type: Number, description: 'Vehicle ID' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ 
    status: 200, 
    description: 'Odometer history retrieved successfully'
  })
  async getOdometerHistory(
    @Param('vehicleId', ParseIntPipe) vehicleId: number,
    @Query() paginationQueryDto: PaginationQueryDto
  ) {
    return this.qrService.getVehicleOdometerHistory(vehicleId, paginationQueryDto);
  }

  @Get('info/:vehicleId')
  @ApiOperation({ 
    summary: 'Get vehicle QR information',
    description: 'Get vehicle details and current trip status for QR code display'
  })
  @ApiParam({ name: 'vehicleId', type: Number, description: 'Vehicle ID' })
  @ApiResponse({ 
    status: 200, 
    description: 'Vehicle information retrieved successfully' 
  })
  async getVehicleInfo(@Param('vehicleId', ParseIntPipe) vehicleId: number) {
    return this.qrService.getVehicleInfo(vehicleId);
  }
}