import { PartialType } from '@nestjs/mapped-types';
import { CreateEsgAnalysisDto } from './create-esg_analysis.dto';

export class UpdateEsgAnalysisDto extends PartialType(CreateEsgAnalysisDto) {}
