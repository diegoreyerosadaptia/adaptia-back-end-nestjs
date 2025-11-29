import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Analysis } from './entities/analysis.entity';
import { CreateAnalysisDto } from './dto/create-analysis.dto';
import { UpdateAnalysisDto } from './dto/update-analysis.dto';
import { MailService } from './mail.service';
import { generateEsgPdfNode } from 'src/utils/esg-pdf.util';
import { EsgAnalysis } from 'src/esg_analysis/entities/esg_analysis.entity';

@Injectable()
export class AnalysisService {
  private readonly logger = new Logger(AnalysisService.name);

  constructor(
    @InjectRepository(Analysis)
    private readonly analysisRepository: Repository<Analysis>,
    @InjectRepository(EsgAnalysis)
    private readonly esgAnalysisRepository: Repository<EsgAnalysis>,
    private readonly mailService: MailService,
  ) {}

  async create(createAnalysisDto: CreateAnalysisDto) {
    try {
      const analysis = this.analysisRepository.create(createAnalysisDto);

      return await this.analysisRepository.save(analysis);
    } catch (error) {
      this.logger.error(error.message, error.stack);
      throw error;
    }
  }

  async findAll() {
    try {
      return await this.analysisRepository.find({
        relations: ['organization']
      });
    } catch (error) {
      this.logger.error(error.message, error.stack);
      throw error;
    }
  }

  async findOne(id: string) {
    try {
      const analysis = await this.analysisRepository.findOne({
        where: { id },
        relations: ['organization'],
      });

      if (!analysis) {
        throw new NotFoundException('Analysis not found');
      }

      return analysis;
    } catch (error) {
      if (!(error instanceof NotFoundException)) {
        this.logger.error(error.message, error.stack);
      }
      throw error;
    }
  }

  async update(id: string, updateAnalysisDto: UpdateAnalysisDto) {
    try {
      const analysis = await this.analysisRepository.findOne({ where: { id } });

      if (!analysis) {
        throw new NotFoundException('Analysis not found');
      }

      const fieldsToUpdate = Object.entries(updateAnalysisDto).reduce(
        (acc, [key, value]) => {
          if (value !== undefined && value !== analysis[key]) {
            acc[key] = value;
          }
          return acc;
        },
        {} as Partial<UpdateAnalysisDto>,
      );

      const updatedAnalysis = this.analysisRepository.merge(
        analysis,
        fieldsToUpdate,
      );

      const result = await this.analysisRepository.save(updatedAnalysis);

      this.logger.log(`Analysis "${result.id}" updated successfully`);
      return result;
    } catch (error) {
      if (!(error instanceof NotFoundException || error instanceof BadRequestException)) {
        this.logger.error(error.message, error.stack);
      }
      throw error;
    }
  }

  async remove(id: string) {
    try {
      const analysis = await this.analysisRepository.findOne({ where: { id } });

      if (!analysis) {
        throw new NotFoundException('Analysis not found');
      }

      await this.analysisRepository.remove(analysis);
      return { message: 'Analysis removed successfully' };
    } catch (error) {
      if (!(error instanceof NotFoundException)) {
        this.logger.error(error.message, error.stack);
      }
      throw error;
    }
  }

  async updatePaymentStatus(id: string) {
    try {
      const analysis = await this.analysisRepository.findOne({ where: { id } });

      if (!analysis) {
        throw new NotFoundException('Analysis not found');
      }
      if(analysis.payment_status === 'COMPLETED'){
        analysis.payment_status = 'PENDING';
      }else{
        analysis.payment_status = 'COMPLETED';
      }

      await this.analysisRepository.save(analysis);

      return analysis;
    } catch (error) {
      if (!(error instanceof NotFoundException)) {
        this.logger.error(error.message, error.stack);
      }
      throw error;
    }
  }
  
// analysis.service.ts
async sendAnalysisUser(id: string, chartImgBase64?: string) {
  try {
    const analysis = await this.analysisRepository.findOne({
      where: { id },
      relations: ['organization', 'organization.owner'],
    })

    if (!analysis) {
      throw new NotFoundException('Analysis not found')
    }

    const org = analysis.organization
    const recipientEmail = org.email || org.owner?.email

    const esgAnalysis = await this.esgAnalysisRepository.findOne({
      where: { organization: { id: org.id } },
      order: { createdAt: 'DESC' },
    })

    if (!esgAnalysis) {
      throw new NotFoundException(
        `No se encontró ESGAnalysis para la organización ${org.id}`,
      )
    }

    const analysisData =
      typeof (esgAnalysis as any).analysisJson === 'string'
        ? JSON.parse((esgAnalysis as any).analysisJson)
        : (esgAnalysis as any).analysisJson

    const contextoData =
      analysisData?.find((a: any) => a?.response_content?.nombre_empresa)
        ?.response_content || {}

    const resumenData =
      analysisData?.find((a: any) => a?.response_content?.parrafo_1)
        ?.response_content || {}

    // 👇 aquí usamos el chartImgBase64
    const pdfBytes = await generateEsgPdfNode({
      contexto: contextoData,
      resumen: resumenData,
      portadaPath: 'Portada-Resumen-Ejecutivo-Adaptia.png',
      contraportadaPath: 'Contra-Portada-Resumen-Ejecutivo-Adaptia.png',
      chartImgBase64,   // <── importante
    })

    const pdfBase64 = Buffer.from(pdfBytes).toString('base64')

    if (recipientEmail) {
      await this.mailService.sendAnalysisEmail({
        to: recipientEmail,
        organizationName: org.company ?? org.name ?? 'tu organización',
        analysisId: org.id,
        attachment: {
          filename: `Resumen_Ejecutivo_Adaptia_${contextoData?.nombre_empresa ?? 'Empresa'}.pdf`,
          content: pdfBase64,
          contentType: 'application/pdf',
        },
      })
    } else {
      this.logger.warn(
        `No se encontró email de contacto para el análisis ${analysis.id} (org ${org?.id})`,
      )
    }

    analysis.shipping_status = 'SENT'
    await this.analysisRepository.save(analysis)

    return analysis
  } catch (error) {
    if (!(error instanceof NotFoundException)) {
      this.logger.error(error.message, error.stack)
    }
    throw error
  }
}


  }

