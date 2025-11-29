import { Module } from '@nestjs/common';
import { AnalysisService } from './analysis.service';
import { AnalysisController } from './analysis.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Analysis } from './entities/analysis.entity';
import { MailService } from './mail.service';
import { EsgAnalysis } from 'src/esg_analysis/entities/esg_analysis.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Analysis, EsgAnalysis])],
  controllers: [AnalysisController],
  providers: [AnalysisService, MailService],
  exports: [MailService]
})
export class AnalysisModule {}
