import { ApiProperty } from '@nestjs/swagger';

export class UpdateResponseDto {
  @ApiProperty()
  updateAvailable: boolean;

  @ApiProperty({ required: false })
  updateType?: string;

  @ApiProperty({ required: false })
  data?: any;

  @ApiProperty({ required: false })
  message?: string;
}