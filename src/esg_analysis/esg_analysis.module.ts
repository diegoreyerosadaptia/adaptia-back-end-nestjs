import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';

import { EsgAnalysis } from './entities/esg_analysis.entity';
import { EsgAnalysisService } from './esg_analysis.service';
import { EsgJobsService } from './esg_job.service';
import { EsgJobProcessor } from './esg_jobs.processor';

import { EsgAnalysisController } from './esg_analysis.controller';
import { EsgJobsController } from './esg_jobs.controller';
import { Organization } from 'src/organizations/entities/organization.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([EsgAnalysis, Organization]),
    BullModule.registerQueue({
      name: 'esg-analysis',  // 👈 importante: mismo nombre que usás en InjectQueue
    }),
  ],
  providers: [
    EsgAnalysisService,
    EsgJobsService,
    EsgJobProcessor, // 👈 los processors también van como providers
  ],
  controllers: [
    EsgAnalysisController,
    EsgJobsController,
  ],
  exports: [EsgAnalysisService],
})
export class EsgAnalysisModule {}
