import { Injectable, HttpException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateEsgAnalysisDto } from './dto/create-esg_analysis.dto';
import { EsgAnalysis } from './entities/esg_analysis.entity';
import { Organization } from 'src/organizations/entities/organization.entity';
import { EsgAnalysisResult } from 'src/types/esg-analysis-result.type';
import { Analysis } from 'src/analysis/entities/analysis.entity';

@Injectable()
export class EsgAnalysisService {
  constructor(
    @InjectRepository(EsgAnalysis)
    private readonly esgAnalysisRepository: Repository<EsgAnalysis>,
    @InjectRepository(Organization)
    private readonly organizationRepository: Repository<Organization>,
    @InjectRepository(Analysis)
    private readonly analysisRepository: Repository<Analysis>,
  ) {}

  async runPythonEsgAnalysis(dto: CreateEsgAnalysisDto): Promise<EsgAnalysisResult> {
    const MAX_RETRIES = 1;
    const RETRY_DELAY = 60_000;
    const TIMEOUT_MS = 30 * 60 * 1000;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      console.log(`🚀 Intento ${attempt}/${MAX_RETRIES} para ${dto.organization_name}`);

      const controller = new AbortController();
      const hardTimeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

      try {
        console.log(
          '🌍 Intentando conectar con:',
          `${process.env.PYTHON_API_URL}/api/esg/esg-analysis-api`,
        );

        const response = await fetch(
          `${process.env.PYTHON_API_URL}/api/esg/esg-analysis-api`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              organization_name: dto.organization_name,
              country: dto.country,
              website: dto.website,
              industry: dto.industry,
              document: dto.document,
            }),
            signal: controller.signal,
          },
        );

        clearTimeout(hardTimeout);
        console.log(`📡 Python API status: ${response.status}`);

        const textResponse = await response.text();
        if (!response.ok) throw new Error(`Python API error: ${textResponse}`);

        const result = JSON.parse(textResponse);

        // ✅ Convertir el PDF base64 a buffer (si existe)
        const pdfBuffer = result.pdf_base64
          ? Buffer.from(result.pdf_base64, 'base64')
          : null;

        // ✅ Guardar PDF localmente (opcional)
        if (pdfBuffer) {
          const fs = await import('fs/promises');
          const filePath = `./tmp/${result.filename}`;
          await fs.mkdir('./tmp', { recursive: true });
          await fs.writeFile(filePath, pdfBuffer);
          console.log(`📄 PDF guardado localmente en ${filePath}`);
        }

        // ✅ Buscar organización
        const org = await this.organizationRepository.findOne({
          where: { id: dto.organizationId },
          relations: ['analysis'],
        });
        if (!org) throw new NotFoundException('Organización no encontrada');

        // ✅ Crear registro ESG siempre, aunque sea incompleto
        const esgRecord = this.esgAnalysisRepository.create({
          organization: org,
          analysisJson:
            result.analysis_json ||
            result.partial_results || // si viene como "partial_results"
            null,
        });
        await this.esgAnalysisRepository.save(esgRecord);

        // ✅ Determinar estado del análisis
        const pythonStatus: string =
          result.status?.toUpperCase() || 'FAILED'; // "COMPLETE" | "INCOMPLETE" | "FAILED"

        // Buscar el último análisis con estado PENDING
        const lastPending = org.analysis
          ?.filter((a) => a.status === 'PENDING')
          .sort(
            (a, b) =>
              b.createdAt.getTime() - a.createdAt.getTime(),
          )[0];

        if (lastPending) {
          // Si vino completo → COMPLETED
          // Si vino incompleto → INCOMPLETE
          // Si falló → FAILED
          if (pythonStatus === 'COMPLETE') {
            lastPending.status = 'COMPLETED';
          } else if (pythonStatus === 'INCOMPLETE') {
            lastPending.status = 'INCOMPLETE';
          } else {
            lastPending.status = 'FAILED';
          }

          await this.analysisRepository.save(lastPending);
          console.log(`🎯 Análisis ${lastPending.id} marcado como ${lastPending.status}`);
        }

        console.log(`✅ Análisis ESG finalizado con estado: ${pythonStatus}`);

        return {
          id: esgRecord.id,
          filename: result.filename,
          pdfBuffer,
          analysisJson:
            result.analysis_json ||
            result.partial_results ||
            null,
          failedPrompts: result.failed_prompts || [],
        };
      } catch (error: any) {
        clearTimeout(hardTimeout);
        console.error(`❌ Error en intento ${attempt}:`, error);

        try {
          // Buscar último análisis PENDING y marcarlo como FAILED
          const pendingAnalysis = await this.analysisRepository.findOne({
            where: {
              organization: { id: dto.organizationId },
              status: 'PENDING',
            },
            order: { createdAt: 'DESC' },
          });

          if (pendingAnalysis) {
            pendingAnalysis.status = 'FAILED';
            await this.analysisRepository.save(pendingAnalysis);
            console.warn(
              `🚨 Análisis ${pendingAnalysis.id} de ${dto.organization_name} marcado como FAILED`,
            );
          }
        } catch (innerErr) {
          console.error('⚠️ Error al actualizar estado del análisis a FAILED:', innerErr);
        }

        if (attempt < MAX_RETRIES) {
          console.warn(`⏳ Reintentando en 1 minuto...`);
          await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY));
        } else {
          throw new HttpException('Error ejecutando análisis ESG', 500);
        }
      }
    }

    throw new HttpException('Error inesperado en análisis ESG', 500);
  }

  async updateAnalysisJson(id: string, json: Record<string, any>) {
    const analysis = await this.esgAnalysisRepository.findOne({ where: { id } });
  
    if (!analysis) throw new NotFoundException('Análisis no encontrado');
  
    analysis.analysisJson = json;
    await this.esgAnalysisRepository.save(analysis);
  
    return analysis;
  }
  
}
