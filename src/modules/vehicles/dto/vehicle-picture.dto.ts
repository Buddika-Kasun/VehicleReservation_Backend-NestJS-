
import { ApiProperty } from '@nestjs/swagger';

export class VehiclePictureDto {
  @ApiProperty({
    type: 'string',
    format: 'binary',
    description: 'Vehicle picture file (JPG, PNG, JPEG)',
  })
  file: any;
}