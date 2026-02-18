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
import { SasbListContent } from './entities/sasb_list_contents.entity';
import { OdsList } from './entities/ods_list.entity';
import { OdsOptionsResponse } from './dto/ods-list.dto';

type ColKey = "tema" | "ods" | "meta_ods" | "indicador_ods"
const DEFAULT_HIDDEN_COLS: Record<ColKey, boolean> = {
  tema: false,
  ods: false,
  meta_ods: false,
  indicador_ods: false,
}

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
    @InjectRepository(SasbListContent)
    private readonly sasbRepo: Repository<SasbListContent>,
    @InjectRepository(OdsList)
    private readonly odsListRepo: Repository<OdsList>,
    private readonly statusGateway: AnalysisStatusGateway,
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

  async getSasb(industria: string, esgAnalysisId: string) {
    // 1) Buscar análisis
    const analysis = await this.esgAnalysisRepository.findOne({
      where: { id: esgAnalysisId },
    })
  
    if (!analysis) {
      throw new NotFoundException("ESG analysis not found")
    }
  
    const analysisJsonRaw = (analysis as any).analysisJson
  
    if (!analysisJsonRaw) {
      throw new NotFoundException("Analysis JSON not found on analysis record")
    }
  
    // 2) Normalizar a array (clon profundo)
    const analysisArray = Array.isArray(analysisJsonRaw)
      ? JSON.parse(JSON.stringify(analysisJsonRaw))
      : JSON.parse(JSON.stringify(analysisJsonRaw))
  
    // 3) Traer SASB desde BD para la industria seleccionada
    const rows = await this.sasbRepo.find({
      where: { industria },
      order: { tema: "ASC" },
    })
  
    /* ============================
       ✅ PROMPT 8 - reemplazar y deduplicar
    ============================= */
    const p8Indexes: number[] = []
    analysisArray.forEach((a: any, idx: number) => {
      if (typeof a?.name === "string" && a.name.includes("Prompt 8")) {
        p8Indexes.push(idx)
      }
    })
  
    if (p8Indexes.length > 0) {
      const keepIdx = p8Indexes[0]
      const p8 = analysisArray[keepIdx]
  
      // ✅ REEMPLAZO TOTAL del response_content
      analysisArray[keepIdx] = {
        ...p8,
        response_content: {
          industria_sasb: industria,
          match_type: "manual",
          score_seleccionado: 999,
        },
      }
  
      // ✅ Eliminar duplicados restantes
      for (let i = p8Indexes.length - 1; i > 0; i--) {
        analysisArray.splice(p8Indexes[i], 1)
      }
    }
  
    /* ============================
       ✅ PROMPT 9 - reemplazar y deduplicar
    ============================= */
    const p9Indexes: number[] = []
    analysisArray.forEach((a: any, idx: number) => {
      if (typeof a?.name === "string" && a.name.includes("Prompt 9")) {
        p9Indexes.push(idx)
      }
    })
  
    if (p9Indexes.length > 0) {
      const keepIdx = p9Indexes[0]
      const p9 = analysisArray[keepIdx]
  
      // ✅ REEMPLAZO TOTAL del response_content
      analysisArray[keepIdx] = {
        ...p9,
        response_content: {
          tabla_sasb: rows,
        },
      }
  
      // ✅ Eliminar duplicados restantes
      for (let i = p9Indexes.length - 1; i > 0; i--) {
        analysisArray.splice(p9Indexes[i], 1)
      }
    }
  
    // 6) Persistir JSON actualizado
    ;(analysis as any).analysisJson = analysisArray
    await this.esgAnalysisRepository.save(analysis)
  
    // 7) Mantener tu comportamiento original
    return rows
  }
  

    private getObjectiveCodeFromOds(odsText?: string | null) {
    if (!odsText) return null
    const m = odsText.match(/Objetivo\s+(\d+)/i)
    return m?.[1] ?? null
  }

  // Meta: "1.1 De aquí..." => "1.1"
  private getMetaCode(metaText?: string | null) {
    if (!metaText) return null
    const m = metaText.match(/^(\d+\.\d+)/)
    return m?.[1] ?? null
  }

  // Indicador: "1.1.1 Proporción..." => "1.1.1"
  private getIndicadorCode(indText?: string | null) {
    if (!indText) return null
    const m = indText.match(/^(\d+\.\d+\.\d+)/)
    return m?.[1] ?? null
  }

  async getOptions(params: { objective?: string; meta?: string }): Promise<OdsOptionsResponse> {
    const { objective, meta } = params

    // 1) Objectives: DISTINCT ods
    const odsRows = await this.odsListRepo
      .createQueryBuilder("o")
      .select(["o.ods"])
      .where("o.ods is not null")
      .distinct(true)
      .getMany()

    const objectives = odsRows
      .map((r) => {
        const code = this.getObjectiveCodeFromOds(r.ods)
        return code ? { code, label: r.ods } : null
      })
      .filter(Boolean) as { code: string; label: string }[]

    // ordenar por número (1..17)
    objectives.sort((a, b) => Number(a.code) - Number(b.code))

    // 2) Metas filtradas por objective: meta ILIKE '1.%'
    let metas: { code: string; label: string }[] = []
    if (objective) {
      const metaRows = await this.odsListRepo
        .createQueryBuilder("o")
        .select(["o.meta"])
        .where("o.meta is not null")
        .andWhere("o.meta ILIKE :pref", { pref: `${objective}.%` })
        .distinct(true)
        .getMany()

      const seen = new Set<string>()
      metas = metaRows
        .map((r) => {
          const code = this.getMetaCode(r.meta)
          if (!code) return null
          if (seen.has(code)) return null
          seen.add(code)
          return { code, label: r.meta }
        })
        .filter(Boolean) as { code: string; label: string }[]

      metas.sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }))
    }

    // 3) Indicadores filtrados por meta: indicador ILIKE '1.1.%'
    let indicadores: { code: string; label: string }[] = []
    if (meta) {
      const indRows = await this.odsListRepo
        .createQueryBuilder("o")
        .select(["o.indicador"])
        .where("o.indicador is not null")
        .andWhere("o.indicador ILIKE :pref", { pref: `${meta}.%` })
        .distinct(true)
        .getMany()

      const seen = new Set<string>()
      indicadores = indRows
        .map((r) => {
          const code = this.getIndicadorCode(r.indicador)
          if (!code) return null
          if (seen.has(code)) return null
          seen.add(code)
          return { code, label: r.indicador }
        })
        .filter(Boolean) as { code: string; label: string }[]

      indicadores.sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }))
    }

    return { objectives, metas, indicadores }
  }



  private findOdsSectionIndex(arr: any[]) {
    return arr.findIndex(
      (a: any) =>
        typeof a?.name === "string" &&
        (a.name.includes("Prompt 6") || a.name.includes("ODS")),
    )
  }

  /**
   * ✅ Asegura la estructura en analysisJson.
   * - Si falta table_settings.hiddenCols, lo agrega con defaults.
   * - Devuelve: { json, changed, hiddenCols }
   */
  private ensureOdsHiddenCols(analysisJsonRaw: any) {
    // tu JSON normalmente es array. Aseguramos array + clon profundo.
    const json = Array.isArray(analysisJsonRaw)
      ? JSON.parse(JSON.stringify(analysisJsonRaw))
      : JSON.parse(JSON.stringify(analysisJsonRaw))

    const idx = this.findOdsSectionIndex(json)
    if (idx === -1) {
      return { json, changed: false, hiddenCols: DEFAULT_HIDDEN_COLS }
    }

    const section = json[idx]
    section.response_content = section.response_content ?? {}
    section.response_content.table_settings = section.response_content.table_settings ?? {}

    const current = section.response_content.table_settings.hiddenCols

    if (!current || typeof current !== "object") {
      section.response_content.table_settings.hiddenCols = { ...DEFAULT_HIDDEN_COLS }
      return { json, changed: true, hiddenCols: section.response_content.table_settings.hiddenCols }
    }

    // merge por si faltan keys
    section.response_content.table_settings.hiddenCols = {
      ...DEFAULT_HIDDEN_COLS,
      ...current,
    }

    // changed si faltaba alguna key
    const changed =
      Object.keys(DEFAULT_HIDDEN_COLS).some((k) => typeof current[k] !== "boolean")

    return { json, changed, hiddenCols: section.response_content.table_settings.hiddenCols }
  }

  async getEsgAnalysisById(id: string) {
  const analysis = await this.esgAnalysisRepository.findOne({ where: { id } })
  if (!analysis) throw new NotFoundException("Análisis no encontrado")

  const { json, changed } = this.ensureOdsHiddenCols((analysis as any).analysisJson)

  // ✅ lazy backfill: si el análisis viejo no tenía la estructura, lo guardamos
  if (changed) {
    ;(analysis as any).analysisJson = json
    await this.esgAnalysisRepository.save(analysis)
  }

  return analysis
}

async setOdsHiddenCols(esgAnalysisId: string, hiddenCols: Partial<Record<ColKey, boolean>>) {
  const analysis = await this.esgAnalysisRepository.findOne({ where: { id: esgAnalysisId } })
  if (!analysis) throw new NotFoundException("Análisis no encontrado")

  const { json } = this.ensureOdsHiddenCols((analysis as any).analysisJson)

  const idx = this.findOdsSectionIndex(json)
  if (idx === -1) throw new NotFoundException("Sección ODS no encontrada en analysisJson")

  const section = json[idx]
  section.response_content.table_settings.hiddenCols = {
    ...DEFAULT_HIDDEN_COLS,
    ...section.response_content.table_settings.hiddenCols,
    ...hiddenCols, // ✅ aplica cambios
  }

  ;(analysis as any).analysisJson = json
  await this.esgAnalysisRepository.save(analysis)

  return section.response_content.table_settings.hiddenCols
}


}

