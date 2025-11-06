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
        console.log("🌍 Intentando conectar con:", `${process.env.PYTHON_API_URL}/api/esg/esg-analysis-with-pdf-api`);

        const response = await fetch(
          `${process.env.PYTHON_API_URL}/api/esg/esg-analysis-with-pdf-api`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              organization_name: dto.organization_name,
              country: dto.country,
              website: dto.website,
            }),
            signal: controller.signal,
          },
        );
  
        clearTimeout(hardTimeout);
        console.log(`📡 Python API status: ${response.status}`);
  
        const textResponse = await response.text();
        if (!response.ok) throw new Error(`Python API error: ${textResponse}`);
  
        const result = JSON.parse(textResponse);
  
        // ✅ Convertir el PDF base64 a buffer
        const pdfBuffer = result.pdf_base64
          ? Buffer.from(result.pdf_base64, 'base64')
          : null;
  
        // ✅ Guardar PDF localmente (opcional)
        if (pdfBuffer) {
          const filePath = `./tmp/${result.filename}`;
          const fs = await import('fs/promises');
          await fs.mkdir('./tmp', { recursive: true });
          await fs.writeFile(filePath, pdfBuffer);
          console.log(`📄 PDF guardado localmente en ${filePath}`);
        }
  
        const org = await this.organizationRepository.findOne({
          where: { id: dto.organizationId },
          relations: ['analysis'],
        });
        if (!org) throw new NotFoundException('Organización no encontrada');
  
        // 💾 Guardar registro ESG
        const esgRecord = this.esgAnalysisRepository.create({
          organization: org,
          analysisJson: result.analysis_json,
        });
        await this.esgAnalysisRepository.save(esgRecord);
  
        // ✅ Buscar último análisis PENDING y marcarlo COMPLETED
        if (org.analysis && org.analysis.length > 0) {
          const lastPending = org.analysis
            .filter(a => a.status === 'PENDING')
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
  
          if (lastPending) {
            lastPending.status = 'COMPLETED';
            await this.analysisRepository.save(lastPending);
            console.log(`🎯 Análisis ${lastPending.id} marcado como COMPLETED`);
          }
        }
  
        console.log(`✅ Análisis ESG completado para ${dto.organization_name}`);
  
        return {
          id: esgRecord.id,
          filename: result.filename,
          pdfBuffer,
          analysisJson: result.analysis_json,
        };
  
      } catch (error: any) {
        clearTimeout(hardTimeout);
        console.error(`❌ Error en intento ${attempt}:`, error);
  
        try {
          // Buscar último análisis PENDING de esa organización y marcarlo como FAILED
          const pendingAnalysis = await this.analysisRepository.findOne({
            where: {
              organization: { id: dto.organizationId },
              status: 'PENDING',
            },
            order: { createdAt: 'DESC' },
          });
  
          if (pendingAnalysis) {
            pendingAnalysis.status = 'FAILED';
            console.error(`Error en análisis ${pendingAnalysis.id}: ${error.message}`);
            await this.analysisRepository.save(pendingAnalysis);
            console.warn(
              `🚨 Análisis ${pendingAnalysis.id} de ${dto.organization_name} marcado como FAILED`
            );
          } else {
            console.warn(`⚠️ No se encontró análisis PENDING para ${dto.organization_name}`);
          }
        } catch (innerErr) {
          console.error('⚠️ Error al actualizar estado del análisis a FAILED:', innerErr);
        }
  
        if (attempt < MAX_RETRIES) {
          console.warn(`⏳ Reintentando en 1 minuto...`);
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
        } else {
          throw new HttpException('Error ejecutando análisis ESG', 500);
        }
      }
    }
  
    // ✅ Agregá este return/throw final para evitar el error de TypeScript
    throw new HttpException('Error inesperado en análisis ESG', 500);
  }
  
}
