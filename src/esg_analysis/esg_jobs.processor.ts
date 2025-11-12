// esg_jobs.processor.ts
import { Processor, Process } from '@nestjs/bull';
import type { Job } from 'bull';
import { EsgAnalysisService } from './esg_analysis.service';

@Processor('esg-analysis')
export class EsgJobProcessor {
  constructor(private readonly esgAnalysisService: EsgAnalysisService) {}

  @Process()
  async handle(job: Job) {
    console.log(`📥 Procesando job ${job.id} para ${job.data.organization_name}`);

    try {
      const result = await this.esgAnalysisService.runPythonEsgAnalysis(job.data);

      if (result.status === 'INCOMPLETE') {
        console.warn(`⚠️ Job ${job.id} completado parcialmente (estado: INCOMPLETE)`);
      } else if (result.status === 'FAILED') {
        console.error(`❌ Job ${job.id} falló en Python`);
      } else {
        console.log(`✅ Job ${job.id} completado exitosamente`);
      }

      return result;
    } catch (error) {
      console.error(`💥 Error crítico en job ${job.id}:`, error);
      throw error;
    }
  }
}
