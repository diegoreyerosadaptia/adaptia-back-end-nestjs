import { Injectable, HttpException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { CreateEsgAnalysisDto } from './dto/create-esg_analysis.dto';
import { EsgAnalysis } from './entities/esg_analysis.entity';
import { Organization } from 'src/organizations/entities/organization.entity';
import { EsgAnalysisResult } from 'src/types/esg-analysis-result.type';
import { Analysis } from 'src/analysis/entities/analysis.entity';
import { GriContent } from './entities/gri_contents.entity';
import { AnalysisStatusGateway } from './analysis-status.gateway';

@Injectable()
export class EsgAnalysisService {
  constructor(
    @InjectRepository(EsgAnalysis)
    private readonly esgAnalysisRepository: Repository<EsgAnalysis>,
    @InjectRepository(Organization)
    private readonly organizationRepository: Repository<Organization>,
    @InjectRepository(Analysis)
    private readonly analysisRepository: Repository<Analysis>,
    @InjectRepository(GriContent)
    private readonly griRepo: Repository<GriContent>,
    private readonly statusGateway: AnalysisStatusGateway, // ⭐ agregado
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

        // PDF
        const pdfBuffer = result.pdf_base64
          ? Buffer.from(result.pdf_base64, 'base64')
          : null;

        if (pdfBuffer) {
          const fs = await import('fs/promises');
          const filePath = `./tmp/${result.filename}`;
          await fs.mkdir('./tmp', { recursive: true });
          await fs.writeFile(filePath, pdfBuffer);
          console.log(`📄 PDF guardado: ${filePath}`);
        }

        const org = await this.organizationRepository.findOne({
          where: { id: dto.organizationId },
          relations: ['analysis'],
        });
        if (!org) throw new NotFoundException('Organización no encontrada');

        // limpiar previos
        const previousEsg = await this.esgAnalysisRepository.find({ where: { organization: { id: org.id } } });
        if (previousEsg.length) {
          await this.esgAnalysisRepository.remove(previousEsg);
        }

        const esgRecord = this.esgAnalysisRepository.create({
          organization: org,
          analysisJson:
            result.analysis_json ||
            result.partial_results ||
            null,
        });
        await this.esgAnalysisRepository.save(esgRecord);

        const pythonStatus =
          result.status?.toUpperCase() || 'FAILED';

        // ⭐ Buscar el último análisis PROCESSING (tu estado actual)
        const lastPending = org.analysis
          ?.filter((a) => a.status === 'PROCESSING')
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];

        if (lastPending) {
          if (pythonStatus === 'COMPLETE') {
            lastPending.status = 'COMPLETED';
          } else if (pythonStatus === 'INCOMPLETE') {
            lastPending.status = 'INCOMPLETE';
          } else {
            lastPending.status = 'FAILED';
          }

          await this.analysisRepository.save(lastPending);

          console.log(`🎯 Análisis ${lastPending.id} marcado como ${lastPending.status}`);

          // ⭐⭐ WEBSOCKET ENVIADO AL FRONT
          this.statusGateway.sendStatusUpdate({
            analysisId: lastPending.id,
            orgId: org.id,
            status: lastPending.status,
            payment_status: lastPending.payment_status,
            shipping_status: lastPending.shipping_status,
          });
        }

        console.log(`✅ Finalizado con estado: ${pythonStatus}`);

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
        console.error(`❌ Error intento ${attempt}:`, error);

        try {
          // ❗ buscar PROCESSING (no PENDING!!)
          const failing = await this.analysisRepository.findOne({
            where: {
              organization: { id: dto.organizationId },
              status: 'PROCESSING',
            },
            order: { createdAt: 'DESC' },
          });

          if (failing) {
            failing.status = 'FAILED';
            await this.analysisRepository.save(failing);

            console.warn(`🚨 ${failing.id} → FAILED`);

            // ⭐ SOCKET también en el catch
            this.statusGateway.sendStatusUpdate({
              analysisId: failing.id,
              orgId: dto.organizationId || "",
              status: 'FAILED',
              payment_status: failing.payment_status,
              shipping_status: failing.shipping_status,
            });
          }
        } catch (innerErr) {
          console.error('⚠️ Error al marcar FAILED:', innerErr);
        }

        if (attempt < MAX_RETRIES) {
          console.warn('⏳ Reintentando...');
          await new Promise((r) => setTimeout(r, RETRY_DELAY));
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

  async getGriByTemas(temas: string[]) {
    const rows = await this.griRepo.find({
      where: { tema: In(temas) },
      order: { tema: 'ASC' },
    });

    return {
      gri: temas.map((t) => ({
        tema: t,
        contenidos: rows
          .filter((row) => row.tema === t)
          .map((item) => ({
            estandar_gri: item.estandar_gri,
            numero_contenido: item.numero_contenido,
            contenido: item.contenido,
            requerimiento: item.requerimiento,
          })),
      })),
    };
  }
}
