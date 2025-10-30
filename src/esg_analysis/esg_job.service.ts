// esg_job.service.ts
import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import { CreateEsgAnalysisDto } from '../esg_analysis/dto/create-esg_analysis.dto';

@Injectable()
export class EsgJobsService {
  constructor(@InjectQueue('esg-analysis') private readonly esgQueue: Queue) {}

  async createJob(dto: CreateEsgAnalysisDto) {
    const job = await this.esgQueue.add(dto, {
      attempts: 1,                // 👈 solo un intento por job
      removeOnComplete: true,     // 👈 limpia la cola al terminar
      removeOnFail: false,        // 👈 deja registro si falla
      timeout: 1000 * 60 * 40,    // ⏳ máx. 40 min de ejecución
    });

    console.log(`📝 Job encolado con ID: ${job.id}`);
    return { jobId: job.id };
  }

  async getJobStatus(id: string) {
    const job = await this.esgQueue.getJob(id);
    if (!job) return { status: 'not_found' };

    const state = await job.getState();
    const result = await job.finished().catch(() => null);

    return {
      status: state,
      progress: job.progress(),
      result,
      failedReason: job.failedReason || null,
    };
  }
}
