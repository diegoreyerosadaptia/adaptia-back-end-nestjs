import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Organization } from './entities/organization.entity';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { Analysis } from 'src/analysis/entities/analysis.entity';

@Injectable()
export class OrganizationsService {
  private readonly logger = new Logger(OrganizationsService.name);

  constructor(
    @InjectRepository(Organization)
    private readonly organizationRepository: Repository<Organization>,
    @InjectRepository(Analysis)
    private readonly analysisRepository: Repository<Analysis>,
  ) {}

  async create(createOrganizationDto: CreateOrganizationDto) {
    try {
      // 1. Crear la organización
      const org = this.organizationRepository.create(createOrganizationDto);

      await this.organizationRepository.save(org);

      // 2. Crear análisis asociado automáticamente
      const analysis = this.analysisRepository.create({
        organization_id: org.id,
        status: 'PENDING',
        payment_status: 'PENDING',
      });

      await this.analysisRepository.save(analysis);

      // 3. Devolver la organización creada
      return this.organizationRepository.findOne({
        where: { id: org.id },
        relations: ['analysis'],
      });
    } catch (error) {
      this.logger.error(error.message, error.stack);
      throw error;
    }
  }

  async findAll() {
    try {
      return await this.organizationRepository.find({
        relations: ['analysis']
      });
    } catch (error) {
      this.logger.error(error.message, error.stack);
      throw error;
    }
  }

  async findOne(id: string) {
    try {
      const org = await this.organizationRepository.findOne({
        where: { id },
        relations: ['analysis'],
      });

      if (!org) {
        throw new NotFoundException('Organization not found');
      }

      return org;
    } catch (error) {
      if (!(error instanceof NotFoundException)) {
        this.logger.error(error.message, error.stack);
      }
      throw error;
    }
  }

  async update(id: string, updateOrganizationDto: UpdateOrganizationDto) {
    try {
      const org = await this.organizationRepository.findOne({ where: { id } });

      if (!org) {
        throw new NotFoundException('Organization not found');
      }

      const fieldsToUpdate = Object.entries(updateOrganizationDto).reduce(
        (acc, [key, value]) => {
          if (value !== undefined && value !== org[key]) {
            acc[key] = value;
          }
          return acc;
        },
        {} as Partial<UpdateOrganizationDto>,
      );

      const updatedOrg = this.organizationRepository.merge(org, fieldsToUpdate);
      const result = await this.organizationRepository.save(updatedOrg);

      this.logger.log(`Organization "${result.name}" updated successfully`);
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
      const org = await this.organizationRepository.findOne({ where: { id } });

      if (!org) {
        throw new NotFoundException('Organization not found');
      }

      await this.organizationRepository.remove(org);

      return { message: 'Organization removed successfully' };
    } catch (error) {
      if (!(error instanceof NotFoundException)) {
        this.logger.error(error.message, error.stack);
      }
      throw error;
    }
  }
}
