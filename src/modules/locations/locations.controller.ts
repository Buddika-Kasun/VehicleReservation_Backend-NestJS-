import { Controller, Get, Query, ValidationPipe, UseGuards } from '@nestjs/common';
import { LocationsService } from './locations.service';
import { LocationSearchDto } from './dto/location-search.dto';
import { ReverseGeocodeDto } from './dto/reverse-geocode.dto'
import { RolesGuard } from 'src/common/guards/roles.guard';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { ApiBearerAuth } from '@nestjs/swagger';

@Controller('locations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
export class LocationsController {
  constructor(private readonly locationsService: LocationsService) {}

  @Get('search')
  async searchLocations(
    @Query(ValidationPipe) searchDto: LocationSearchDto,
  ) {
    const locations = await this.locationsService.searchLocations(searchDto.q);

    // Return proper JSON object instead of raw array
    return {
      success: true,
      data: locations,
      message: 'Locations retrieved successfully',
      count: locations.length
    };
  }

  // Add reverse geocode endpoint
  @Get('reverse')
    async reverseGeocode(
        @Query(ValidationPipe) reverseGeocodeDto: ReverseGeocodeDto,
    ) {
        const location = await this.locationsService.reverseGeocode(
            reverseGeocodeDto.lat,
            reverseGeocodeDto.lon,
        );

        return {
            success: true,
            data: location,
            message: 'Location retrieved successfully',
        };
    }
  
}