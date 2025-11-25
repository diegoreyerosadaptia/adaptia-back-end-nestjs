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
import { Analysis } from 'src/analysis/entities/analysis.entity';
import { GriContent } from './entities/gri_contents.entity';
import { AnalysisStatusGateway } from './analysis-status.gateway';

@Module({
  imports: [
    TypeOrmModule.forFeature([EsgAnalysis, Organization, Analysis, GriContent]),
    BullModule.registerQueue({
      name: 'esg-analysis',  // 👈 importante: mismo nombre que usás en InjectQueue
    }),
  ],
  providers: [
    EsgAnalysisService,
    EsgJobsService,
    EsgJobProcessor,
    AnalysisStatusGateway
  ],
  controllers: [
    EsgAnalysisController,
    EsgJobsController,
  ],
  exports: [EsgAnalysisService, EsgJobsService],
})
export class EsgAnalysisModule {}
