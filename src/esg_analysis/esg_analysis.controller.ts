import { Controller, Post, Body, Res, HttpException, NotFoundException, Param, Put, Get, Query, Patch, BadRequestException } from '@nestjs/common';
import { EsgAnalysisService } from './esg_analysis.service';

type ColKey = "tema" | "ods" | "meta_ods" | "indicador_ods"
type HiddenColsDto = Partial<Record<ColKey, boolean>>

@Controller('esg-analysis')
export class EsgAnalysisController {
  constructor(private readonly esgAnalysisService: EsgAnalysisService) {}

  @Put(':id/json')
  async updateAnalysisJson(
    @Param('id') id: string,
    @Body() json: any
  ) {
    const updated = await this.esgAnalysisService.updateAnalysisJson(id, json)
    return { message: '✅ JSON actualizado correctamente', updated }
  }

  @Post('gri/by-topics')
  async getByTopics(@Body() body: any) {
    return this.esgAnalysisService.getGriByTemas(body.temas);
  }

  @Post('sasb')
  async getSasb(@Body() body: any) {
    return this.esgAnalysisService.getSasb(body.industria, body.esgAnalysisId);
  }
  
  @Get("ods-list/options")
  getOptions(
    @Query("objective") objective?: string,
    @Query("meta") meta?: string,
  ) {
    return this.esgAnalysisService.getOptions({ objective, meta })
  }
  

    // ✅ 1) Traer análisis por id (incluye lazy backfill)
  @Get(":id")
  async getById(@Param("id") id: string) {
    return this.esgAnalysisService.getEsgAnalysisById(id)
  }

  // ✅ 2) Guardar hiddenCols ODS (solo ADMIN en tu auth real)
  // Recomendado: PATCH porque es parcial
  @Patch(":id/ods-hidden-cols")
  async setOdsHiddenCols(
    @Param("id") id: string,
    @Body() body: HiddenColsDto,
  ) {
    if (!body || typeof body !== "object") {
      throw new BadRequestException("Body inválido")
    }

    // ✅ Validación de keys y boolean
    const allowed: ColKey[] = ["tema", "ods", "meta_ods", "indicador_ods"]
    for (const k of Object.keys(body)) {
      if (!allowed.includes(k as ColKey)) {
        throw new BadRequestException(`Columna inválida: ${k}`)
      }
      const v = (body as any)[k]
      if (typeof v !== "boolean") {
        throw new BadRequestException(`Valor inválido para ${k}: debe ser boolean`)
      }
    }

    return this.esgAnalysisService.setOdsHiddenCols(id, body)
  }
}  