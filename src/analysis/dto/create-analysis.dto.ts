import { IsEnum, IsNotEmpty, IsOptional, IsUUID } from 'class-validator';
import { ANALYSIS_STATUS } from '../entities/analysis.entity';
import type { AnalysisStatus } from '../entities/analysis.entity';

export class CreateAnalysisDto {
  @IsNotEmpty()
  @IsUUID()
  organization_id: string;

  @IsOptional()
  @IsEnum(ANALYSIS_STATUS)
  status?: AnalysisStatus;
}
