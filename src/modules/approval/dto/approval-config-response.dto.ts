import { ApiProperty } from '@nestjs/swagger';
import { ApprovalConfig } from 'src/database/entities/approval-configuration.entity';

export class ApprovalConfigResponseDto {
  @ApiProperty()
  message: string;

  @ApiProperty({ type: () => ApprovalConfig })
  approvalConfig: ApprovalConfig;
}

export class ApprovalConfigListResponseDto {
  @ApiProperty()
  message: string;

  @ApiProperty({ type: () => [ApprovalConfig] })
  approvalConfigs: ApprovalConfig[];

  @ApiProperty()
  pagination: any;
}
