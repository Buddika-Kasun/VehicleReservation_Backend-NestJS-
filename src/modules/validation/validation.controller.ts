import { Controller, Get, HttpStatus, UseGuards } from "@nestjs/common";
import { 
  ApiInternalServerErrorResponse, 
  ApiOperation, 
  ApiResponse, 
  ApiTags 
} from "@nestjs/swagger";
import { Public } from "src/common/decorators/public.decorator";
import { ErrorResponseDto } from "src/common/dto/errorResponse.dto";
import { ValidationService } from "./validation.service";
import { JwtAuthGuard } from "src/common/guards/jwt-auth.guard";
import { RolesGuard } from "src/common/guards/roles.guard";
import { Roles } from "src/common/decorators/roles.decorator";
import { UserRole } from "src/database/entities/user.entity";

@Controller('validate')
@ApiTags('Validate API')
@ApiInternalServerErrorResponse({ 
  description: 'Internal server error.',
  type: ErrorResponseDto,
  example: ErrorResponseDto.example('Internal server error.', HttpStatus.INTERNAL_SERVER_ERROR)
})
@UseGuards(JwtAuthGuard, RolesGuard)
export class ValidationController {
  constructor(private validationService: ValidationService) {}

  @Get('haveCompany')
  @ApiOperation({ summary: 'Check if at least one company exists' })
  @ApiResponse({ 
    status: 200, 
    description: 'Returns true if a company exists, false otherwise.'
  })
  @Roles(UserRole.SYSADMIN)
  async haveCompany() {
    return await this.validationService.haveCompany();
  }

  @Get('haveCostCenter')
  @ApiOperation({ summary: 'Check if at least one cost center exists' })
  @ApiResponse({ 
    status: 200, 
    description: 'Returns true if a cost center exists, false otherwise.'
  })
  @Roles(UserRole.SYSADMIN)
  async haveCostCenter() {
    return await this.validationService.haveCostCenter();
  }

  @Get('haveDepartment')
  @ApiOperation({ summary: 'Check if at least one department exists' })
  @ApiResponse({ 
    status: 200, 
    description: 'Returns true if a department exists, false otherwise.'
  })
  @Roles(UserRole.SYSADMIN)
  async haveDepartment() {
    return await this.validationService.haveDepartment();
  }

  @Get('canRegisterUser')
  @ApiOperation({ summary: 'Check if system can register a new user' })
  @ApiResponse({ 
    status: 200, 
    description: 'Returns true if the system allows user registration, false otherwise.'
  })
  @Public()
  async canRegisterUser() {
    return await this.validationService.canRegisterUser();
  }
}
