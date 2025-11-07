import {
  Injectable,
  BadRequestException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MercadoPagoConfig, Preference, Payment } from 'mercadopago';
import { DataSource, IsNull, Repository } from 'typeorm';
import { PreferenceCreateData } from 'mercadopago/dist/clients/preference/create/types';
import { ConfigService } from '@nestjs/config';
import { User } from 'src/users/entities/user.entity';
import { EMPLYEES_NUMBER, Organization } from 'src/organizations/entities/organization.entity';
import { PaymentsMethodsService } from '../payments-methods/payments-methods.service';
import { PaymentMethod } from '../payments-methods/entities/payments-method.entity';
import { EsgJobsService } from 'src/esg_analysis/esg_job.service';
import { Analysis } from 'src/analysis/entities/analysis.entity';

@Injectable()
export class MercadopagoService {
  private readonly logger = new Logger(MercadopagoService.name);
  private mercadopagoClient: MercadoPagoConfig;



  // 📌 Mapeo de precios predefinido
  private readonly PRICE_BY_EMPLOYEE_RANGE: Record<typeof EMPLYEES_NUMBER[number], number> = {
    '1-9': 0.01,
    '10-99': 400,
    '100-499': 800,
    '500-1000': 1200,
    '1000-4999': 1400,
    '5000-10000': 1600,
    '+10000': 2000,
  };

  constructor(
    @InjectRepository(Organization)
    private readonly organizationRepository: Repository<Organization>,
    @InjectRepository(Analysis)
    private readonly analysisRepository: Repository<Analysis>,
    @InjectRepository(PaymentMethod)
    private readonly paymentMethodRepository: Repository<PaymentMethod>,
    private readonly configService: ConfigService,
    private readonly dataSource: DataSource,
    private readonly paymentsMethodsService: PaymentsMethodsService,
    private readonly jobsService: EsgJobsService
  ) {
    this.mercadopagoClient = new MercadoPagoConfig({
      accessToken: this.configService.getOrThrow<string>(
        'MERCADOPAGO_ACCESS_TOKEN',
      ),
    });
  }

  // 🧠 Función auxiliar para obtener el precio
  private getPriceByEmployeeRange(range: typeof EMPLYEES_NUMBER[number]): number {
    return this.PRICE_BY_EMPLOYEE_RANGE[range] ?? 0;
  }
  

  // 💳 Crear preferencia de pago
  async createPreference(user: User, organization: Organization) {
    try {
      const employeeRange = organization.employees_number as typeof EMPLYEES_NUMBER[number];
      const price = this.getPriceByEmployeeRange(employeeRange);

      const title = `Plan Adaptia - ${organization.company}`;
      const description = `Análisis ESG para empresa (${employeeRange} empleados)`;

      const preferenceBody: PreferenceCreateData['body'] = {
        metadata: {
          user_id: user.id,
          organization_id: organization.id,
          employee_range: employeeRange,
        },
        items: [
          {
            id: organization.id,
            title,
            description,
            unit_price: price,
            quantity: 1,
            currency_id: 'USD',
          },
        ],
        payer: {
          name: user.firstName,
          surname: user.lastName,
          email: user.email,
        },
        back_urls: {
          success: this.configService.getOrThrow('FRONTEND_URL_SUCCESS_PAYMENT'),
          failure: this.configService.getOrThrow('FRONTEND_URL_FAILURE_PAYMENT'),
          pending: this.configService.getOrThrow('FRONTEND_URL_PENDING_PAYMENT'),
        },
        notification_url: `${this.configService.getOrThrow('HOST_URL')}/mercadopago/webhook`,
        auto_return: 'all',
        operation_type: 'regular_payment',
      };

      const preference = new Preference(this.mercadopagoClient);
      const result = await preference.create({ body: preferenceBody });

      return {
        id: result.id,
        init_point: result.init_point,
        sandbox: result.sandbox_init_point,
        price,
      };
    } catch (error) {
      this.logger.error(error.message, error.stack);
      throw error;
    }
  }
  

  async getPaymentDetails(paymentId: string) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const paymentService = new Payment(this.mercadopagoClient);
      this.logger.debug(`Trying to fetch payment: ${paymentId}`);
const paymentDetails = await paymentService.get({ id: paymentId });


      const userId = paymentDetails.metadata?.user_id;
      const orgId =
        paymentDetails?.additional_info?.items &&
        paymentDetails.additional_info.items.length > 0
          ? paymentDetails.additional_info.items[0].id
          : undefined;


      await queryRunner.commitTransaction();
      return { paymentDetails, userId, orgId };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(error.message, error.stack);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async receiveWebhook(payload: any) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    this.logger.log(`Processing webhook payload:`, payload);

    try {
      if (payload.type !== 'payment') {
        this.logger.warn(`Ignoring non-payment webhook: ${payload.type || payload.topic}`);
        return;
      }
      
      switch (payload.type) {
        case 'payment':
          const paymentId = payload.data.id;
          this.logger.log(
            `Processing payment webhook for payment ID: ${paymentId}`,
          );

          // Check for duplicate payment
          await this.checkDuplicatePayment(paymentId, queryRunner);

          if (payload.type === 'stop_delivery_op_wh') {
            this.logger.warn(
              `Received payment cancellation for payment ID: ${paymentId}`,
            );
            return await this.handlePaymentCancellation(
              payload.data.payment_id,
              queryRunner,
            );
          }

          const { paymentDetails, userId, orgId } =
            await this.getPaymentDetails(paymentId);

          this.logger.log(`Payment details retrieved:
            Payment ID: ${paymentId}
            User ID: ${userId}
            Org ID: ${orgId}
            Status: ${paymentDetails?.status}
          `);

          if (paymentDetails?.status === 'approved') {
            await this.processApprovedPayment(
              paymentDetails,
              userId,
              orgId || '',
              paymentId,
              queryRunner,
            );
          } else {
            this.logger.warn(
              `Payment not approved. Status: ${paymentDetails?.status}`,
            );
          }

          await queryRunner.commitTransaction();
          return {
            status: 204,
            message: `Event type ${payload.type} - Payment ${paymentId} processed`,
          };
        default:
          this.logger.warn(`Unhandled event type: ${payload.type}`);
          await queryRunner.rollbackTransaction();
          return {
            status: 204,
            message: `Event type ${payload.type} not implemented`,
          };
      }
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Error processing webhook: ${error.message}`, {
        error: error.stack,
        payload,
      });
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  private async checkDuplicatePayment(
    paymentId: string,
    queryRunner,
  ): Promise<void> {
    this.logger.debug(`Checking for duplicate payment: ${paymentId}`);
    const existingPayment = await queryRunner.manager.findOne(
      this.paymentMethodRepository.target,
      { where: { paymentId } },
    );

    if (existingPayment) {
      this.logger.warn(`Duplicate payment detected for ID ${paymentId}`);
      throw new BadRequestException('Pago ya procesado anteriormente');
    }
  }

  private async handlePaymentCancellation(paymentId: string, queryRunner) {
    const cancelResult = await this.cancelPayment(paymentId);
    if (!cancelResult) {
      throw new NotFoundException('Payment not found');
    }
    await queryRunner.rollbackTransaction();
    throw new NotFoundException('Payment cancelled successfully');
  }

  private async processApprovedPayment(
    paymentDetails: any,
    userId: string,
    orgId: string,
    paymentId: string,
    queryRunner,
  ): Promise<void> {
    this.logger.log(`Processing approved payment:
      Payment ID: ${paymentId}
      User ID: ${userId}
      Org ID: ${orgId}
    `);

    try {
      const savedPaymentMethod =
        await this.paymentsMethodsService.createMethodPayment(userId);
      savedPaymentMethod.details = paymentDetails as any;
      savedPaymentMethod.paymentId = paymentId;
      await queryRunner.manager.save(
        this.paymentMethodRepository.target,
        savedPaymentMethod,
      );
      this.logger.debug(`Payment method saved successfully`);


      this.logger.log(`Successfully processed payment and created user plan:
        Payment ID: ${paymentId}
      `);
      const org = await this.organizationRepository.findOne({
        where: { id: orgId },
        relations: ['analysis'],
      });
    
      if (!org) {
        throw new NotFoundException('Organización no encontrada');
      }
    
      // 🔹 Verificar que haya análisis
      if (!org.analysis || org.analysis.length === 0) {
        throw new NotFoundException('No se encontraron análisis asociados a la organización');
      }
    
      // 🔹 Tomar el último análisis
      const lastAnalysis = org.analysis[org.analysis.length - 1];
    
      // 🔹 Cambiar su estado de pago
      lastAnalysis.payment_status = 'COMPLETED';
    
      // 🔹 Guardar los cambios
      await this.dataSource.getRepository('Analysis').save(lastAnalysis);
    
      // 🔹 Crear el nuevo job
      await this.jobsService.createJob({
        organization_name: org.company,
        country: org.country,
        website: org.website,
        organizationId: org.id,
      });
    
      console.log(`✅ Estado de pago actualizado a COMPLETED para el análisis ${lastAnalysis.id}`);
      
    } catch (error) {
      this.logger.error(`Error processing approved payment: ${error.message}`, {
        error: error.stack,
        paymentId,
        userId,
        orgId,
      });
      throw error;
    }
  }

  private async cancelPayment(paymentId: string): Promise<boolean> {
    try {
      const paymentService = new Payment(this.mercadopagoClient);
      const response = await paymentService.cancel({ id: paymentId });

      if (response.status === 'cancelled') {
        this.logger.log(`Payment ${paymentId} cancelled successfully.`);
        return true;
      }
      return false;
    } catch (error) {
      this.logger.error(error.message, error.stack);
      throw error;
    }
  }

  async checkHealth() {
    try {
      const accessToken = this.configService.get('MERCADOPAGO_ACCESS_TOKEN');
      const webhookSecret = this.configService.get(
        'MERCADOPAGO_WEBHOOK_SECRET_KEY',
      );

      // Verificar que las configuraciones necesarias estén presentes
      const configStatus = {
        accessToken: !!accessToken,
        webhookSecret: !!webhookSecret,
        accessTokenLength: accessToken?.length || 0,
        webhookSecretLength: webhookSecret?.length || 0,
      };

      // Intentar hacer una llamada simple a la API de MercadoPago
      const paymentService = new Payment(this.mercadopagoClient);
      await paymentService.get({ id: '0' }).catch((error) => {
        // Es esperado que falle con 404, lo importante es que la API responda
        if (error.status !== 404) {
          throw error;
        }
      });

      return {
        status: 'ok',
        timestamp: new Date().toISOString(),
        config: configStatus,
        message:
          'MercadoPago service is properly configured and API is accessible',
      };
    } catch (error) {
      this.logger.error('Health check failed:', error);
      return {
        status: 'error',
        timestamp: new Date().toISOString(),
        error: error.message,
        details: error.status
          ? `API Error (${error.status})`
          : 'Configuration Error',
      };
    }
  }
}
