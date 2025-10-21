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

@Injectable()
export class AnalysisService {
  private readonly logger = new Logger(AnalysisService.name);

  constructor(
    @InjectRepository(Analysis)
    private readonly analysisRepository: Repository<Analysis>,
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
}
