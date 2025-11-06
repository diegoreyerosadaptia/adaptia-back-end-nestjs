import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Organization } from '../organizations/entities/organization.entity';
import { CreateEsgAnalysisDto } from '../esg_analysis/dto/create-esg_analysis.dto';
import { Analysis } from 'src/analysis/entities/analysis.entity';

@Injectable()
export class EsgJobsService {
  constructor(
    @InjectQueue('esg-analysis') private readonly esgQueue: Queue,
    @InjectRepository(Analysis) private readonly analysisRepo: Repository<Analysis>,
    @InjectRepository(Organization) private readonly orgRepo: Repository<Organization>,
  ) {}

  async createJob(dto: CreateEsgAnalysisDto) {
    // 1️⃣ Buscar organización y su análisis más reciente
    const org = await this.orgRepo.findOne({
      where: { id: dto.organizationId },
      relations: ['analysis'],
    });

    if (!org) throw new NotFoundException('Organización no encontrada');

    const lastAnalysis = org.analysis?.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )[0];

    if (!lastAnalysis) {
      throw new NotFoundException('No se encontró ningún análisis para esta organización');
    }

    // 2️⃣ Cambiar el estado del análisis a "PENDING"
    lastAnalysis.status = 'PENDING';
    lastAnalysis.updatedAt = new Date();

    await this.analysisRepo.save(lastAnalysis);
    console.log(`📊 Análisis ${lastAnalysis.id} marcado como PENDING`);

    // 3️⃣ Encolar el job, pasando el ID del análisis
    const job = await this.esgQueue.add(
      { ...dto, analysisId: lastAnalysis.id },
      {
        attempts: 1,
        removeOnComplete: true,
        removeOnFail: false,
        timeout: 1000 * 60 * 40,
      },
    );

    console.log(`📝 Job encolado con ID: ${job.id} para análisis ${lastAnalysis.id}`);

    // 4️⃣ Devolver info al front
    return {
      jobId: job.id,
      analysisId: lastAnalysis.id,
      status: 'PENDING',
    };
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
