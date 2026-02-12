import { Controller, Post, Body, Res, HttpException, NotFoundException, Param, Put, Get, Query } from '@nestjs/common';
import { EsgAnalysisService } from './esg_analysis.service';


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
  
}  