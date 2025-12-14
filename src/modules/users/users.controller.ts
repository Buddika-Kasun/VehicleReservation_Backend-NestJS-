
import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Put, Query, Search, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { GetUser } from 'src/common/decorators/user.decorator';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiInternalServerErrorResponse, ApiOperation, ApiParam, ApiResponse, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { UpdateUserDto } from './dto/update-user.dto';
import { ProfilePictureDto } from './dto/profile-picture.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { multerConfig } from 'src/config/multer.config';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { User, UserRole } from 'src/database/entities/user.entity';
import { ApproveUserDto } from './dto/approve-user.dto';

@Controller('user')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiTags('User API')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ 
  description: 
  `
      Unauthorized - Invalid or missing JWT token
  `
})
@ApiInternalServerErrorResponse({ 
  description: 
  `
      Internal server error.
  `
})
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post('create')
  @ApiOperation({ summary: 'Create user' })
  @ApiResponse({ 
    status: 400, 
    description: 
    `
      The following fields are required: {missingFields}.
      The following fields are already registered: {Fields}.
    `
  })
  @ApiResponse({ 
    status: 201, 
    description: 
    `
      User registered successfully. Please wait for admin approval.
    `
  })
  async create(@Body() dto: CreateUserDto) {
    return this.usersService.createUser(dto);
  }

  @Put('approve/:id')
  @ApiOperation({ summary: 'Approve user' })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiResponse({ 
    status: 404, 
    description: 
    `
      User not found.
    `
  })
  @ApiResponse({ 
    status: 400, 
    description: 
    `
      User already approved.
    `
  })
  @ApiResponse({ 
    status: 200, 
    description: 
    `
      User approved successfully.
    `
  })
  @ApiResponse({ 
    status: 403, 
    description: 
    `
      Forbidden - Insufficient permissions
    ` 
  })
  @Roles(UserRole.HR, UserRole.ADMIN, UserRole.SYSADMIN)
  async approve(
    @Param('id', ParseIntPipe) id: number,
    @GetUser() reqUser: User,
    @Body() dto: ApproveUserDto
  ) {
    return this.usersService.approveUser(id, dto, reqUser);
  }

  @Put('reject/:id')
  @ApiOperation({ summary: 'Disapprove user' })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiResponse({ 
    status: 404, 
    description: 
    `
      User not found.
    `
  })
  @ApiResponse({ 
    status: 200, 
    description: 
    `
      User disapproved successfully.
    `
  })
  @Roles(UserRole.HR, UserRole.ADMIN, UserRole.SYSADMIN)
  async disapprove(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.disapproveUser(id);
  }

  @Get('get-all')
  @ApiOperation({ summary: 'Get all users' })
  @ApiResponse({ 
    status: 200, 
    description: 
    `
      Users retrieved successfully.
    `
  })
  async getAll() {
    return this.usersService.findAll();
  }

  @Post('get-all-by-status')
  async getUsersByStatus(
    @Body() body: { status?: string; page?: number; limit?: number }
  ) {
    const { status, page = 1, limit = 20 } = body;
    
    return this.usersService.findAllByStatus(status, page, limit);
  }

  @Get('get-all-by-department/:id')
  @ApiOperation({ summary: 'Get all users by department' })
  @ApiResponse({ 
    status: 200, 
    description: 
    `
      Users retrieved successfully.
    `
  })
  async getAllByDepartment(
    @Param('id', ParseIntPipe) depId: number,
  ) {
    return this.usersService.findAllByDepartment(depId);
  }

  @Get('get-all-by-role/:role')
  @ApiOperation({ summary: 'Get all users by department' })
  @ApiResponse({ 
    status: 200, 
    description: 
    `
      Users retrieved successfully.
    `
  })
  async getAllByRole(
    @Param('role') role: string,
  ) {
    return this.usersService.findAllByRole(role);
  }

  @Get('search')
  @ApiOperation({ summary: 'Search users' })
  @ApiResponse({
    status: 200,
    description: 'Users retrieved successfully.',
  })
  async getAllBySearching(
    @Query('query') search: string,
  ) {
    return this.usersService.findAllBySearching(search);
  }

  @Get('get-user-by-approval')
  @ApiOperation({ summary: 'Search users' })
  @ApiResponse({
    status: 200,
    description: 'Users retrieved successfully.',
  })
  async getAllByApproval() {
    return this.usersService.findAllByApproval();
  }

  @Get('search-approval')
  @ApiOperation({ summary: 'Search users' })
  @ApiResponse({
    status: 200,
    description: 'Users retrieved successfully.',
  })
  async getAllByApprovalSearching(
    @Query('query') search: string,
  ) {
    return this.usersService.findAllByApprovalSearching(search);
  }

  @Put('set-approval/:id')
  @ApiOperation({ summary: 'Set approval' })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiResponse({
    status: 200,
    description: 'User approve change successfully.',
  })
  async setApproveUser(
    @Param('id', ParseIntPipe) id: number,
    @GetUser() reqUser: User,
    @Body('state') state: boolean,
  ) {
    return this.usersService.setUserApprove(id, state, reqUser);
  }


  @Get('profile')
  @ApiOperation({ summary: 'Get user profile' })
  @ApiResponse({ 
    status: 404, 
    description: 
    `
      User not found.
    `
  })
  @ApiResponse({ 
    status: 200, 
    description: 
    `
      User retrieved successfully.
    `
  })
  async getProfile(@GetUser() user) {
    return this.usersService.findById(user.id);
  }

  @Patch('update/:id')
  @ApiOperation({ summary: 'Update user' })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiBody({
    description: 'User details',
    type: UpdateUserDto,
  })
  @ApiResponse({ 
    status: 404, 
    description: 
    `
      User not found.
    `
  })
  @ApiResponse({ 
    status: 400, 
    description: 
    `
      The following fields are required: {missingFields}.
      The following fields are already registered: {Fields}.
    `
  })
  @ApiResponse({ 
    status: 200, 
    description: 
    `
      User update successfully.
    `
  })
  async updateUser(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateUserDto: UpdateUserDto
  ) {
    return this.usersService.updateUser(id, updateUserDto);
  }

  @Patch('deactivate/:id')
  @ApiOperation({ summary: 'Deactivate user (soft delete)' })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiResponse({ 
    status: 200, 
    description: 
    `
      User deactivated successfully
    ` 
  })
  @ApiResponse({ 
    status: 404, 
    description: 
    `
      User not found
    `
  })
  @ApiResponse({ 
    status: 400, 
    description: 
    `
      User already deactivated
    `
  })
  async deactivateUser(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.deactivateUser(id);
  }

  @Patch('activate/:id')
  @ApiOperation({ summary: 'Activate deactivated user' })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiResponse({ 
    status: 200, 
    description: 
    `
      User activated successfully
    `
  })
  @ApiResponse({ 
    status: 404, 
    description: 
    `
      User not found
    `
  })
  @ApiResponse({ 
    status: 400, 
    description: 
    `
      User already active
    `
  })
  @Roles(UserRole.HR, UserRole.ADMIN)
  async activateUser(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.activateUser(id);
  }

  @Delete('hard-delete/:id')
  @ApiOperation({ summary: 'Permanently delete user' })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiResponse({ 
    status: 200, 
    description: 
    `
      User deleted permanently
    `
  })
  @ApiResponse({ 
    status: 404, 
    description: 
    `
      User not found
    `
  })
  @Roles(UserRole.HR, UserRole.ADMIN)
  async deleteUser(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.deleteUser(id);
  }

  @Patch('toggle-active/:id')
  @ApiOperation({ summary: 'Toggle user active status' })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiResponse({ 
    status: 200, 
    description: 
    `
      User status toggled successfully
    `
  })
  @ApiResponse({ 
    status: 404, 
    description: 
    `
      User not found
    `
  })
  @Roles(UserRole.HR, UserRole.ADMIN)
  async toggleActiveStatus(@Param('id', ParseIntPipe) id: number) {
    const user = await this.usersService.findById(id);
    if (user.data.user.isActive) {
      return this.usersService.deactivateUser(id);
    } else {
      return this.usersService.activateUser(id);
    }
  }

  @Post('profile/picture-upload')
  @ApiOperation({ summary: 'Upload profile picture' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Profile picture file',
    type: ProfilePictureDto,
  })
  @ApiResponse({ 
    status: 200, 
    description: 
    `
      Profile picture uploaded successfully
    `
  })
  @ApiResponse({ 
    status: 400, 
    description: 
    `
      No file uploaded or invalid file type
    `
  })
  @ApiResponse({ 
    status: 404, 
    description: 
    `
      User not found
    `
  })
  @UseInterceptors(FileInterceptor('file', multerConfig))
  async uploadProfilePicture(
    @GetUser() user: User,
    @UploadedFile() file: Express.Multer.File
  ) {
    return this.usersService.updateProfilePicture(user.id, file);
  }

  @Patch('profile/picture-update')
  @ApiOperation({ summary: 'Update profile picture' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Profile picture file',
    type: ProfilePictureDto,
  })
  @ApiResponse({ 
    status: 200, 
    description: 
    `
      Profile picture updated successfully
    `
  })
  @ApiResponse({ 
    status: 400, 
    description: 
    `
      No file uploaded or invalid file type
    `
  })
  @ApiResponse({ 
    status: 404, 
    description: 
    `
      User not found
    `
  })
  @UseInterceptors(FileInterceptor('file', multerConfig))
  async updateProfilePicture(
    @GetUser() user: User,
    @UploadedFile() file: Express.Multer.File
  ) {
    return this.usersService.updateProfilePicture(user.id, file);
  }

  @Delete('profile/picture-remove')
  @ApiOperation({ summary: 'Remove profile picture' })
  @ApiResponse({ 
    status: 200, 
    description: 
    `
      Profile picture removed successfully
    `
  })
  @ApiResponse({ 
    status: 400, 
    description: 
    `
      No profile picture to remove
    `
  })
  @ApiResponse({ 
    status: 404, 
    description: 
    `
      User not found
    `
  })
  async removeProfilePicture(@GetUser() user) {
    return this.usersService.removeProfilePicture(user.id);
  }

  // Admin endpoint to manage other users' profile pictures
  @Post('profile/picture-admin-change/:id')
  @ApiOperation({ summary: 'Upload profile picture for user (Admin)' })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Profile picture file',
    type: ProfilePictureDto,
  })
  @ApiResponse({ 
    status: 200, 
    description: 
    `
      Profile picture updated successfully
    `
  })
  @ApiResponse({ 
    status: 400, 
    description: 
    `
      No file uploaded or invalid file type
    `
  })
  @ApiResponse({ 
    status: 404, 
    description: 
    `
      User not found
    `
  })
  @Roles(UserRole.HR, UserRole.ADMIN)
  @UseInterceptors(FileInterceptor('file', multerConfig))
  async uploadUserProfilePicture(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: Express.Multer.File
  ) {
    return this.usersService.updateProfilePicture(id, file);
  }

}
