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
import { Coupon } from 'src/cupones/entities/cupone.entity';

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
    @InjectRepository(Coupon)
    private readonly couponRepository: Repository<Coupon>,
    private readonly esgAnalysisService : EsgAnalysisService,
  ) {}

  
  async create(createOrganizationDto: CreateOrganizationDto) {
    try {
      const isAnonymous = !createOrganizationDto.ownerId
  
      // Sólo generamos campos de claim cuando NO hay ownerId (usuario aún no existe)
      const claimToken = isAnonymous ? randomUUID() : null
      const claimExpiresAt = isAnonymous ? addHours(new Date(), 48) : null
  
      // ...
      let owner: User | null = null
      if (!isAnonymous) {
        owner = await this.userRepository.findOne({
          where: { id: createOrganizationDto.ownerId },
        })
        if (!owner) {
          throw new NotFoundException('user not found')
        }
      }

      // ===========================
      // 2) Descuento por nuevas organizaciones
      //    - 1ra org: sin descuento
      //    - 2da org: 10%
      //    - 3ra org: 20%
      //    - 4ta org: 30% ...
      // ===========================
      let couponToApply: Coupon | null = null
      let discountPercentage: number | null = null

      if (owner) {
        const existingOrgsCount = await this.organizationRepository.count({
          where: { owner: { id: owner.id } },
        })

        const orgNumber = existingOrgsCount + 1 // esta nueva

        if (orgNumber >= 2) {
          // 1️⃣ buscamos SIEMPRE el cupón base de 10%
          const baseCoupon = await this.couponRepository.findOne({
            where: { percentage: 10 }, // debe existir en BD
          })

          if (!baseCoupon) {
            this.logger.warn(`No se encontró cupón base 10% para user ${owner.id}`)
          } else {
            couponToApply = baseCoupon

            // 2️⃣ porcentaje final = 10% * (orgNumber - 1)
            // 2da org => 10 * 1 = 10
            // 3ra org => 10 * 2 = 20
            // 4ta org => 10 * 3 = 30
            discountPercentage = Number(baseCoupon.percentage) * (orgNumber - 1)
          }
        }
      }

      // ===========================
      // 3) Crear organización
      // ===========================
      const org = this.organizationRepository.create({
        ...createOrganizationDto,
        ...(owner ? { owner } : {}),
        ...(isAnonymous
          ? { claimToken, claimExpiresAt, claimedAt: null }
          : {}),
      })

      await this.organizationRepository.save(org)

      // ===========================
      // 4) Crear análisis asociado
      //    (con cupón + porcentaje multiplicado)
      // ===========================
      const analysis = this.analysisRepository.create({
        organization: org,
        status: 'PENDING',
        payment_status: 'PENDING',
        ...(couponToApply ? { coupon: couponToApply } : {}),
        ...(discountPercentage != null
          ? { discount_percentage: discountPercentage.toFixed(2) }
          : {}),
      })

      await this.analysisRepository.save(analysis)

      // ===========================
      // 5) Devolver la organización con analysis
      // ===========================
      const created = await this.organizationRepository.findOne({
        where: { id: org.id },
        relations: ['analysis'],
      })

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

async claimOrganization( userId: string, orgId: string, claimToken: string) {
  const org = await this.organizationRepository.findOne({
    where: { id: orgId, claimToken },
    relations: ['owner'],
  })

  if (!org) {
    throw new NotFoundException('Organización no encontrada o ya reclamada')
  }

  // Validar expiración
  if (org.claimExpiresAt && org.claimExpiresAt < new Date()) {
    throw new BadRequestException('El enlace de reclamación ha expirado')
  }

  const user = await this.userRepository.findOne({ where: { id: userId } })
  if (!user) {
    throw new NotFoundException('Usuario no encontrado')
  }

  // 👉 Aquí se hace la “magia”
  org.owner = user
  org.claimedAt = new Date()
  org.claimToken = null
  org.claimExpiresAt = null

  await this.organizationRepository.save(org)

  return org
}

}
