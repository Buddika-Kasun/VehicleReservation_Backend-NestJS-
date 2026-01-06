// src/modules/checklist/checklist.controller.ts
import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  ParseIntPipe,
  UseGuards,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { UserRole } from 'src/infra/database/entities/user.entity';
import { GetUser } from 'src/common/decorators/user.decorator';
import { ChecklistSubmitRequestDto } from './dto/checklist-request.dto';
import { ChecklistService } from './checklist.service';
import { ChecklistResponseDto } from './dto/checklist-response.dto';

@ApiTags('Checklist API')
@Controller('checklist')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class ChecklistController {
  constructor(private readonly checklistService: ChecklistService) {}

  @Get('vehicle/:vehicleId/date/:date')
  @Roles(
    UserRole.ADMIN,
    UserRole.SYSADMIN,
    UserRole.HR,
    UserRole.DRIVER,
    UserRole.SUPERVISOR,
    UserRole.SECURITY,
  )
  @ApiOperation({ summary: 'Get checklist by vehicle and date' })
  @ApiParam({ name: 'vehicleId', type: Number, description: 'Vehicle ID' })
  @ApiParam({
    name: 'date',
    type: String,
    description: 'Date in YYYY-MM-DD format',
  })
  @ApiResponse({
    status: 200,
    description: 'Checklist retrieved successfully',
    type: ChecklistResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Checklist not found' })
  async getChecklistByDate(
    @Param('vehicleId', ParseIntPipe) vehicleId: number,
    @Param('date') date: string,
  ) {
    return await this.checklistService.getChecklistByDate(vehicleId, date);
  }

  @Get('vehicle/:vehicleId/date/:date/exists')
  @Roles(
    UserRole.ADMIN,
    UserRole.SYSADMIN,
    UserRole.HR,
    UserRole.DRIVER,
    UserRole.SUPERVISOR,
    UserRole.SECURITY,
  )
  @ApiOperation({ summary: 'Check if checklist exists for date' })
  @ApiParam({ name: 'vehicleId', type: Number, description: 'Vehicle ID' })
  @ApiParam({
    name: 'date',
    type: String,
    description: 'Date in YYYY-MM-DD format',
  })
  @ApiResponse({
    status: 200,
    description: 'Checklist existence checked',
    schema: {
      type: 'object',
      properties: {
        exists: { type: 'boolean' },
      },
    },
  })
  async checkChecklistExists(
    @Param('vehicleId', ParseIntPipe) vehicleId: number,
    @Param('date') date: string,
  ) {
    const exists = await this.checklistService.checklistExists(
      vehicleId,
      date,
    );
    return { exists };
  }

  @Post('submit')
  @Roles(
    UserRole.ADMIN,
    UserRole.SYSADMIN,
    UserRole.DRIVER,
    UserRole.SUPERVISOR,
  )
  @ApiOperation({ summary: 'Submit a new checklist' })
  @ApiResponse({
    status: 201,
    description: 'Checklist submitted successfully',
    type: ChecklistResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 409, description: 'Checklist already exists for date' })
  async submitChecklist(
    @Body() checklistDto: ChecklistSubmitRequestDto,
    @GetUser() user: any,
  ) {
    // Verify user is the same as checkedById
    if (user.userId !== checklistDto.checkedById) {
      throw new HttpException(
        'User can only submit checklist for themselves',
        HttpStatus.FORBIDDEN,
      );
    }

    return await this.checklistService.submitChecklist(checklistDto);
  }

  @Get('vehicle/:vehicleId/history')
  @Roles(
    UserRole.ADMIN,
    UserRole.SYSADMIN,
    UserRole.HR,
    UserRole.SUPERVISOR,
  )
  @ApiOperation({ summary: 'Get checklist history for a vehicle' })
  @ApiParam({ name: 'vehicleId', type: Number, description: 'Vehicle ID' })
  @ApiQuery({
    name: 'startDate',
    required: false,
    type: String,
    description: 'Start date in YYYY-MM-DD format',
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    type: String,
    description: 'End date in YYYY-MM-DD format',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Items per page',
  })
  @ApiResponse({
    status: 200,
    description: 'Checklist history retrieved',
    type: [ChecklistResponseDto],
  })
  async getChecklistHistory(
    @Param('vehicleId', ParseIntPipe) vehicleId: number,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('page', new ParseIntPipe({ optional: true })) page: number = 1,
    @Query('limit', new ParseIntPipe({ optional: true })) limit: number = 10,
  ) {
    return await this.checklistService.getChecklistHistory(
      vehicleId,
      startDate,
      endDate,
      page,
      limit,
    );
  }

  @Get('user/:userId/history')
  @Roles(
    UserRole.ADMIN,
    UserRole.SYSADMIN,
    UserRole.HR,
    UserRole.DRIVER,
    UserRole.SUPERVISOR,
  )
  @ApiOperation({ summary: 'Get checklist history for a user' })
  @ApiParam({ name: 'userId', type: Number, description: 'User ID' })
  @ApiQuery({
    name: 'startDate',
    required: false,
    type: String,
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    type: String,
  })
  @ApiResponse({
    status: 200,
    description: 'User checklist history retrieved',
    type: [ChecklistResponseDto],
  })
  async getUserChecklistHistory(
    @Param('userId', ParseIntPipe) userId: number,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return await this.checklistService.getUserChecklistHistory(
      userId,
      startDate,
      endDate,
    );
  }
}