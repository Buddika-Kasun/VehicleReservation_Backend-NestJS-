import { ApiProperty } from '@nestjs/swagger';

export class ProfilePictureDto {
  @ApiProperty({
    type: 'string',
    format: 'binary',
    description: 'Profile picture file (JPG, PNG, JPEG)'
  })
  file: any;
}