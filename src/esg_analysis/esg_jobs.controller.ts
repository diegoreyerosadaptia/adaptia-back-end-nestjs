// esg_jobs.controller.ts
import { Controller, Post, Body, Get, Param } from '@nestjs/common';
import { EsgJobsService } from './esg_job.service';
import { CreateEsgAnalysisDto } from './dto/create-esg_analysis.dto';

@Controller('esg-jobs')
export class EsgJobsController {
  constructor(private readonly jobsService: EsgJobsService) {}

  @Post()
  async createJob(@Body() dto: CreateEsgAnalysisDto) {
    const { jobId } = await this.jobsService.createJob(dto);
    return { message: '✅ Análisis ESG encolado', jobId };
  }

  @Get(':id/status')
  async getStatus(@Param('id') id: string) {
    return await this.jobsService.getJobStatus(id);
  }
}
