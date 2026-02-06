import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Put,
  Delete,
  Query,
  UseInterceptors,
  UploadedFile,
  Res,
  HttpStatus,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { createReadStream, existsSync, unlinkSync } from 'fs';
import { join } from 'path';
import { UpdatesService } from './updates.service';
import { CreateUpdateDto } from './dto/create-update.dto';
import { CheckUpdateDto } from './dto/check-update.dto';
import { UpdateFileDto } from './dto/update-file.dto';
import { UpdateResponseDto } from './dto/update-response.dto';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { multerConfig } from 'src/config/multer.config';
import { Public } from 'src/common/decorators/public.decorator';

@ApiTags('updates')
@Controller('updates')
@Public()
export class UpdatesController {
  constructor(private readonly updatesService: UpdatesService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new update' })
  @ApiResponse({
    status: 201,
    description: 'Update created successfully',
  })
  async create(@Body() createUpdateDto: CreateUpdateDto) {
    return await this.updatesService.create(createUpdateDto);
  }

    @Post('upload')
    @ApiOperation({ summary: 'Create a new update with file upload' })
    @ApiConsumes('multipart/form-data')
    @UseInterceptors(FileInterceptor('file', multerConfig))
    async createWithFile(
    @UploadedFile(
        new ParseFilePipe({
        validators: [
            new MaxFileSizeValidator({ maxSize: 500 * 1024 * 1024 }), // 500MB
            //new FileTypeValidator({ fileType: /(apk|ipa|zip)$/ }),
        ],
        }),
    )
    file: Express.Multer.File,
    @Body() createUpdateDto: any,
    ) {
    try {
        console.log('=== UPLOAD REQUEST START ===');
        console.log('File received:', {
        filename: file.filename,
        originalname: file.originalname,
        size: file.size,
        mimetype: file.mimetype,
        });
        
        console.log('Body received:', createUpdateDto);
        
        // Ensure all required fields are present
        const requiredFields = ['version', 'buildNumber', 'platform', 'updateTitle', 'updateDescription'];
        for (const field of requiredFields) {
        if (!createUpdateDto[field]) {
            throw new BadRequestException(`Missing required field: ${field}`);
        }
        }

        // Parse boolean fields safely
        const parsedDto: CreateUpdateDto = {
        version: String(createUpdateDto.version),
        buildNumber: String(createUpdateDto.buildNumber),
        platform: createUpdateDto.platform,
        updateTitle: String(createUpdateDto.updateTitle),
        updateDescription: String(createUpdateDto.updateDescription),
        isMandatory: createUpdateDto.isMandatory === 'true' || createUpdateDto.isMandatory === true,
        isSilent: createUpdateDto.isSilent === 'true' || createUpdateDto.isSilent === true,
        redirectToStore: createUpdateDto.redirectToStore === 'true' || createUpdateDto.redirectToStore === true,
        isActive: createUpdateDto.isActive !== 'false', // Default to true
        releaseNotes: createUpdateDto.releaseNotes || '',
        minSupportedVersion: createUpdateDto.minSupportedVersion,
        };

        console.log('Parsed DTO:', parsedDto);
        
        const result = await this.updatesService.createWithFile(parsedDto, file);
        
        console.log('=== UPLOAD SUCCESS ===');
        return result;
    } catch (error) {
        console.error('=== UPLOAD ERROR ===');
        console.error('Error:', error);
        
        // If file was uploaded but there's an error, clean it up
        if (file?.path && existsSync(file.path)) {
        unlinkSync(file.path);
        }
        
        throw error;
    }
    }

  @Get()
  @ApiOperation({ summary: 'Get all updates' })
  @ApiResponse({
    status: 200,
    description: 'List of all updates',
  })
  async findAll() {
    return await this.updatesService.findAllWithInactive();
  }

  @Get('check')
  @ApiOperation({ summary: 'Check for updates' })
  @ApiResponse({
    status: 200,
    description: 'Update check response',
    type: UpdateResponseDto,
  })
  async checkForUpdate(@Query() checkUpdateDto: CheckUpdateDto) {
    return await this.updatesService.checkForUpdate(checkUpdateDto);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get update statistics' })
  async getStats() {
    return await this.updatesService.getStats();
  }

  @Get('search')
  @ApiOperation({ summary: 'Search updates' })
  async searchUpdates(@Query('q') query: string) {
    return await this.updatesService.searchUpdates(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get update by ID' })
  @ApiResponse({
    status: 200,
    description: 'Update details',
  })
  @ApiResponse({
    status: 404,
    description: 'Update not found',
  })
  async findOne(@Param('id') id: string) {
    return await this.updatesService.findOne(id);
  }

  @Get(':id/download')
  @ApiOperation({ summary: 'Download update file' })
  async downloadUpdate(
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    try {
      const { filePath, fileName } = await this.updatesService.getUpdateFile(id);
      
      if (!existsSync(filePath)) {
        return res.status(HttpStatus.NOT_FOUND).json({
          statusCode: HttpStatus.NOT_FOUND,
          message: 'File not found',
        });
      }

      res.set({
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Content-Length': (await import('fs')).statSync(filePath).size.toString(),
      });

      const fileStream = createReadStream(filePath);
      fileStream.pipe(res);
    } catch (error) {
      res.status(HttpStatus.NOT_FOUND).json({
        statusCode: HttpStatus.NOT_FOUND,
        message: error.message,
      });
    }
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update an update record' })
  async update(
    @Param('id') id: string,
    @Body() updateData: Partial<CreateUpdateDto>,
  ) {
    return await this.updatesService.update(id, updateData);
  }

  @Put(':id/toggle-active')
  @ApiOperation({ summary: 'Toggle update active status' })
  async toggleActive(@Param('id') id: string) {
    return await this.updatesService.toggleActive(id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete an update and its file' })
  @ApiResponse({
    status: 200,
    description: 'Update deleted successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Update not found',
  })
  async remove(@Param('id') id: string) {
    return await this.updatesService.remove(id);
  }
}