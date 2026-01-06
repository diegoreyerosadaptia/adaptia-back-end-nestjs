import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Organization } from './entities/organization.entity';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { Analysis } from 'src/analysis/entities/analysis.entity';
import { randomUUID } from 'crypto'
import { addHours } from 'date-fns'
import { User } from 'src/users/entities/user.entity';
import { EsgAnalysisService } from 'src/esg_analysis/esg_analysis.service';
import { Coupon } from 'src/cupones/entities/cupone.entity';
import { MailService } from 'src/analysis/mail.service';
import { Paginated } from 'src/types/common/paginated.type';

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
    private readonly mailService: MailService,
  ) {}

  
  async create(createOrganizationDto: CreateOrganizationDto) {
    try {
      const isAnonymous = !createOrganizationDto.ownerId

      const claimToken = isAnonymous ? randomUUID() : null
      const claimExpiresAt = isAnonymous ? addHours(new Date(), 48) : null

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
      // ===========================
      let couponToApply: Coupon | null = null
      let discountPercentage: number | null = null

      if (owner) {
        const existingOrgsCount = await this.organizationRepository.count({
          where: { owner: { id: owner.id } },
        })

        if (existingOrgsCount >= 1) {
          discountPercentage = Number(10)
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

      // ✅ ===========================
      // 3.1) Notificar a Diego
      // ===========================
      // No bloquees el flujo si el mail falla:
      this.mailService
        .sendOrganizationCreatedNotification({
          organizationName:
            org.company || org.name || createOrganizationDto.company || "Organización sin nombre",
          ownerEmail:
            owner?.email || (createOrganizationDto as any)?.email,
        })
        .catch((err) => {
          this.logger.warn(
            `No se pudo enviar mail de org creada: ${err?.message ?? err}`,
          )
        })

      // ===========================
      // 4) Crear análisis asociado
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

  


async findAll(userId: string, page = 1, limit = 15): Promise<Paginated<Organization>> {
  const user = await this.userRepository.findOne({
    where: { id: userId },
    select: { id: true, role: true },
  })
  if (!user) throw new NotFoundException("Usuario no encontrado")

  const pageNum = Math.max(1, page)
  const limitNum = Math.min(100, Math.max(1, limit))
  const skip = (pageNum - 1) * limitNum

  // Base QB (SIN mutarlo para count / ids)
  const base = this.organizationRepository
    .createQueryBuilder("o")
    .leftJoin("o.owner", "owner")
    .where("o.deletedAt IS NULL")

  if (user.role !== "ADMIN") {
    base.andWhere("owner.id = :userId", { userId })
  }

  // 1) total (clonado)
  const total = await base.clone().distinct(true).getCount()

  // 2) ids paginados (clonado, con offset/limit)
  const idsRaw = await base
    .clone()
    .select("o.id", "id")
    .orderBy("o.createdAt", "DESC")
    .offset(skip)
    .limit(limitNum)
    .getRawMany<{ id: string }>()

  const ids = idsRaw.map((r) => r.id)

  const totalPages = Math.max(1, Math.ceil(total / limitNum))

  if (ids.length === 0) {
    return {
      items: [],
      page: pageNum,
      limit: limitNum,
      total,
      totalPages,
      hasNext: false,
      hasPrev: pageNum > 1,
    }
  }

  // 3) Traer entidades + relaciones para esos ids
  const items = await this.organizationRepository.find({
    where: { id: In(ids) },
    relations: ["analysis", "owner", "esgAnalysis"],
    select: {
      id: true,
      name: true,
      lastName: true,
      email: true,
      company: true,
      title: true,
      industry: true,
      employees_number: true,
      phone: true,
      country: true,
      website: true,
      document: true,
      createdAt: true,
      updatedAt: true,
      deletedAt: true,
      // claimToken/claimExpiresAt/claimedAt NO
    },
  })

  // mantener el orden exacto de la página
  const map = new Map(items.map((o) => [o.id, o]))
  const ordered = ids.map((id) => map.get(id)).filter(Boolean) as Organization[]

  return {
    items: ordered,
    page: pageNum,
    limit: limitNum,
    total,
    totalPages,
    hasNext: pageNum < totalPages,
    hasPrev: pageNum > 1,
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

async applyCoupon(analysisId: string, coupon: string) {
  try {
    console.log(coupon)
    const analysis = await this.analysisRepository.findOne({
      where: { id: analysisId },
      relations: ['coupon'],
    })

    if (!analysis) {
      throw new NotFoundException('analysis not found')
    }

    const baseCoupon = await this.couponRepository.findOne({
      where: { name: coupon },
    })

    if (!baseCoupon) {
      throw new NotFoundException('coupon not found')
    }

    // 💡 asegurar que trabajamos con número
    const percentageNumber = Number(baseCoupon.percentage)

    analysis.coupon = baseCoupon
    analysis.discount_percentage = percentageNumber.toFixed(2) // ← string

    await this.analysisRepository.save(analysis)

    return {
      analysisId: analysis.id,
      coupon: {
        id: baseCoupon.id,
        name: baseCoupon.name,
        percentage: percentageNumber,
      },
      discount_percentage: percentageNumber,
    }
  } catch (error) {
    if (!(error instanceof NotFoundException)) {
      this.logger.error(error.message, error.stack)
    }
    throw error
  }
}

}
