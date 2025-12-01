import { Controller, Post, Body, ValidationPipe, UseGuards } from '@nestjs/common';
import { CalculateRouteDto } from './dto/calculate-route.dto';
import { RoutesService } from './routes.service';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';

@Controller('routes')
@UseGuards(JwtAuthGuard, RolesGuard)
//@ApiBearerAuth()
export class RoutesController {
  constructor(private readonly routesService: RoutesService) {}

  @Post('calculate')
  async calculateRoute(
    @Body(ValidationPipe) calculateRouteDto: CalculateRouteDto,
  ) {
    return this.routesService.calculateRoute(calculateRouteDto);
  }
}