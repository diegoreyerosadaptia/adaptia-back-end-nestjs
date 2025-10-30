import { Controller, Post, Body, Res, HttpException } from '@nestjs/common';
import { EsgAnalysisService } from './esg_analysis.service';
import { CreateEsgAnalysisDto } from './dto/create-esg_analysis.dto';
import type { Response } from 'express';

@Controller('esg-analysis')
export class EsgAnalysisController {
  constructor(private readonly esgAnalysisService: EsgAnalysisService) {}

  @Post('generate')
  async generateEsgAnalysis(
    @Body() dto: CreateEsgAnalysisDto,
    @Res() res: Response,
  ) {
    try {
      const { filename, pdfBuffer, analysisJson } =
        await this.esgAnalysisService.runPythonEsgAnalysis(dto);

      res.set({
        'Content-Type': 'application/json',
      });

      res.send({
        filename,
        pdf: pdfBuffer ? pdfBuffer.toString('base64') : null,
        analysisJson,
      });
    } catch (error) {
      if (error instanceof HttpException) {
        return res
          .status(error.getStatus())
          .send({ message: error.message || 'Error en análisis ESG' });
      }
      return res.status(500).send({ message: 'Error interno en análisis ESG' });
    }
  }
}
