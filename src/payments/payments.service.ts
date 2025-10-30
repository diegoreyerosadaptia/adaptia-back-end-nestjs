import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from 'src/users/entities/user.entity';
import { MercadopagoService } from './mercadopago/mercadopago.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { Organization } from 'src/organizations/entities/organization.entity';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Organization)
    private readonly organizationRepository: Repository<Organization>,
    private readonly mercadopagoService: MercadopagoService,
  ) {}

  async createPreference(createPaymentDto: CreatePaymentDto): Promise<{
    checkoutUrl: string;
    sandboxUrl?: string;
  }> {
    try {
      const user = await this.userRepository.findOne({
        where: { id: createPaymentDto.userId },
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      const organization = await this.organizationRepository.findOne({
        where: { id: createPaymentDto.organizationId },
      });

      if (!organization) {
        throw new NotFoundException('organization not found');
      }

      const mercadoPagoResponse =
        await this.mercadopagoService.createPreference(user, organization);

      return {
        checkoutUrl: mercadoPagoResponse.init_point || '',
        sandboxUrl: mercadoPagoResponse.sandbox,
      };

    } catch (error) {
      if (!(error instanceof NotFoundException)) {
        this.logger.error(error.message, error.stack);
      }
      throw error;
    }
  }
}
