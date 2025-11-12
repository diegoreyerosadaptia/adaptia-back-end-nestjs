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
import { randomUUID } from 'crypto'
import { addHours } from 'date-fns'
import { User } from 'src/users/entities/user.entity';
import { EsgAnalysisService } from 'src/esg_analysis/esg_analysis.service';

@Injectable()
export class OrganizationsService {
  private readonly logger = new Logger(OrganizationsService.name);

  constructor(
    @InjectRepository(Organization)
    private readonly organizationRepository: Repository<Organization>,
    @InjectRepository(Analysis)
    private readonly analysisRepository: Repository<Analysis>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly esgAnalysisService : EsgAnalysisService,
  ) {}

  
  async create(createOrganizationDto: CreateOrganizationDto) {
    try {
      const isAnonymous = !createOrganizationDto.ownerId
  
      // Sólo generamos campos de claim cuando NO hay ownerId (usuario aún no existe)
      const claimToken = isAnonymous ? randomUUID() : null
      const claimExpiresAt = isAnonymous ? addHours(new Date(), 48) : null
  
      // Sólo buscamos el usuario si vino ownerId
      let owner: User | null = null
      if (!isAnonymous) {
        owner = await this.userRepository.findOne({
          where: { id: createOrganizationDto.ownerId },
        })
        if (!owner) {
          throw new NotFoundException('user not found')
        }
      }
  
      // Creamos la organización:
      // - si hay owner => la relacionamos normal
      // - si no hay owner => seteamos claimToken/claimExpiresAt/claimedAt
      const org = this.organizationRepository.create({
        ...createOrganizationDto,
        ...(owner ? { owner } : {}), // relaciona con el user existente
        ...(isAnonymous
          ? { claimToken, claimExpiresAt, claimedAt: null }
          : {}), // sólo campos de claim si es anónima
      })
  
      await this.organizationRepository.save(org)
  
      // Crear análisis asociado automáticamente
      const analysis = this.analysisRepository.create({
        organization: org, // si tu Analysis usa FK directa, ajustá a organization_id
        status: 'PENDING',
        payment_status: 'PENDING',
      })
      await this.analysisRepository.save(analysis)
  
      // Devolver la organización con analysis
      const created = await this.organizationRepository.findOne({
        where: { id: org.id },
        relations: ['analysis'],
      })

      //await this.esgAnalysisService.runPythonEsgAnalysis({
      //  organizationId: org.id,
      //  organization_name: org.company,
      //  country: org.country,
      //  website: org.website
      //})
  
      // Sólo exponemos el claimToken cuando NO hay owner
      return {
        ...created,
        ...(isAnonymous ? { claimToken } : {}),
      }
    } catch (error) {
      this.logger.error(error.message, error.stack)
      throw error
    }
  }
  

  async findAll(userId: string) {
    try {
      // 1️⃣ Buscar el usuario para saber su rol
      const user = await this.userRepository.findOne({
        where: { id: userId },
      });
  
      if (!user) {
        throw new NotFoundException('Usuario no encontrado');
      }
  
      // 2️⃣ Si es ADMIN o SUPERADMIN, traer todas las organizaciones
      const whereCondition =
        user.role === 'ADMIN'
          ? {} // sin filtro: todas las organizaciones
          : { owner: { id: userId } }; // solo las del owner
  
      // 3️⃣ Buscar organizaciones con las relaciones necesarias
      return await this.organizationRepository.find({
        where: whereCondition,
        relations: ['analysis', 'owner', 'esgAnalysis'],
        order: { createdAt: 'DESC' },
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
        relations: ['analysis', 'esgAnalysis'],
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
