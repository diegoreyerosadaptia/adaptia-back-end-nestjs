// src/cupones/cupones.service.ts
import {
  Injectable,
  Logger,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Coupon } from './entities/cupone.entity'
import { CreateCuponeDto } from './dto/create-cupone.dto'
import { UpdateCuponeDto } from './dto/update-cupone.dto'

// 🔁 Ajustá estos paths a los reales en tu proyecto
import { Organization } from 'src/organizations/entities/organization.entity'
import { Analysis } from 'src/analysis/entities/analysis.entity'

@Injectable()
export class CuponesService {
  private readonly logger = new Logger(CuponesService.name)

  constructor(
    @InjectRepository(Coupon)
    private readonly cuponRepository: Repository<Coupon>,

    @InjectRepository(Organization)
    private readonly organizationRepository: Repository<Organization>,

    @InjectRepository(Analysis)
    private readonly analysisRepository: Repository<Analysis>,
  ) {}

  async create(createCuponeDto: CreateCuponeDto): Promise<Coupon> {
    try {
      const cupon = this.cuponRepository.create(createCuponeDto)
      await this.cuponRepository.save(cupon)
      this.logger.log(`Cupón creado correctamente (id=${cupon.id})`)
      return cupon
    } catch (error) {
      this.logger.error(
        `Error al crear cupón. Payload: ${JSON.stringify(createCuponeDto)}`,
        error.stack,
      )
      throw new InternalServerErrorException('Error al crear el cupón')
    }
  }

  async findAll(): Promise<Coupon[]> {
    try {
      return await this.cuponRepository.find()
    } catch (error) {
      this.logger.error('Error al obtener los cupones', error.stack)
      throw new InternalServerErrorException(
        'Error al obtener la lista de cupones',
      )
    }
  }

  async findOne(id: string): Promise<Coupon> {
    try {
      const cupon = await this.cuponRepository.findOne({ where: { id } })

      if (!cupon) {
        this.logger.warn(`Cupón no encontrado (id=${id})`)
        throw new NotFoundException('Cupón no encontrado')
      }

      return cupon
    } catch (error) {
      if (error instanceof NotFoundException) throw error

      this.logger.error(`Error al buscar cupón (id=${id})`, error.stack)
      throw new InternalServerErrorException('Error al buscar el cupón')
    }
  }

  async update(id: string, updateCuponeDto: UpdateCuponeDto): Promise<Coupon> {
    try {
      const cupon = await this.cuponRepository.findOne({ where: { id } })

      if (!cupon) {
        this.logger.warn(`Cupón no encontrado para actualizar (id=${id})`)
        throw new NotFoundException('Cupón no encontrado')
      }

      const updated = Object.assign(cupon, updateCuponeDto)
      await this.cuponRepository.save(updated)

      this.logger.log(`Cupón actualizado correctamente (id=${id})`)
      return updated
    } catch (error) {
      if (error instanceof NotFoundException) throw error

      this.logger.error(
        `Error al actualizar cupón (id=${id}). Payload: ${JSON.stringify(
          updateCuponeDto,
        )}`,
        error.stack,
      )
      throw new InternalServerErrorException('Error al actualizar el cupón')
    }
  }

  async remove(id: string): Promise<void> {
    try {
      // 1) Poner en null todas las referencias en Analysis
      await this.analysisRepository
        .createQueryBuilder()
        .update(Analysis)
        .set({
          coupon: null,
          discount_percentage: null,
        })
        .where('coupon_id = :id', { id })
        .execute();

      // 2) Eliminar el cupón
      const result = await this.cuponRepository.delete(id);

      if (result.affected === 0) {
        this.logger.warn(`Cupón no encontrado para eliminar (id=${id})`);
        throw new NotFoundException('Cupón no encontrado');
      }

      this.logger.log(`Cupón eliminado correctamente (id=${id})`);
    } catch (error) {
      if (error instanceof NotFoundException) throw error;

      this.logger.error(
        `Error al eliminar cupón (id=${id})`,
        error.stack,
      );
      throw new InternalServerErrorException('Error al eliminar el cupón');
    }
  }

  // ============================================
  // ✅ Aplicar cupón a análisis de una organización
  // parámetros: idCupon, idOrg
  // ============================================
  async applyCouponToOrganization(
    couponId: string,
    organizationId: string,
  ): Promise<Analysis> {
    try {
      // 1) Buscar cupón
      const coupon = await this.cuponRepository.findOne({
        where: { id: couponId },
      })

      if (!coupon) {
        this.logger.warn(
          `Cupón no encontrado para aplicar (couponId=${couponId})`,
        )
        throw new NotFoundException('Cupón no encontrado')
      }

      // 2) Buscar organización con sus análisis
      const organization = await this.organizationRepository.findOne({
        where: { id: organizationId },
        relations: ['analysis'],
      })

      if (!organization) {
        this.logger.warn(
          `Organización no encontrada (organizationId=${organizationId})`,
        )
        throw new NotFoundException('Organización no encontrada')
      }

      if (!organization.analysis || organization.analysis.length === 0) {
        this.logger.warn(
          `La organización (id=${organizationId}) no tiene análisis para aplicar cupón`,
        )
        throw new NotFoundException(
          'La organización no tiene análisis para aplicar el cupón',
        )
      }

      // 3) Elegir el análisis a modificar:
      //    primero alguno con payment_status PENDING, si no, el primero
      const targetAnalysis =
        organization.analysis.find((a) => a.payment_status === 'PENDING') ??
        organization.analysis[0]

      if (!targetAnalysis) {
        this.logger.warn(
          `No se encontró análisis válido para aplicar cupón (organizationId=${organizationId})`,
        )
        throw new NotFoundException(
          'No se encontró análisis válido para aplicar cupón',
        )
      }

      // 4) Aplicar cupón y porcentaje de descuento al análisis
      targetAnalysis.coupon = coupon
      // discount_percentage es decimal, lo guardamos como string toString()
      // o Number(coupon.percentage).toFixed(2) si querés siempre 2 decimales
      // asumiendo que coupon.percentage es number
      ;(targetAnalysis as any).discount_percentage = coupon.percentage.toString()

      await this.analysisRepository.save(targetAnalysis)

      this.logger.log(
        `Cupón (id=${couponId}) aplicado al análisis (id=${targetAnalysis.id}) de la organización (id=${organizationId})`,
      )

      return targetAnalysis
    } catch (error) {
      if (error instanceof NotFoundException) throw error

      this.logger.error(
        `Error al aplicar cupón (couponId=${couponId}) a organización (organizationId=${organizationId})`,
        error.stack,
      )
      throw new InternalServerErrorException(
        'Error al aplicar el cupón a la organización',
      )
    }
  }
}
