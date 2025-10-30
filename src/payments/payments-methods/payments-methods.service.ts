import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaymentMethod } from './entities/payments-method.entity';
import { User } from 'src/users/entities/user.entity';

@Injectable()
export class PaymentsMethodsService {
  private readonly logger = new Logger(PaymentsMethodsService.name);

  constructor(
    @InjectRepository(PaymentMethod)
    private readonly paymentMethodRepository: Repository<PaymentMethod>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async createMethodPayment(userId: string) {
    try {
      const method = this.paymentMethodRepository.create();

      if (userId) {
        const user = await this.userRepository.findOne({
          where: { id: userId },
        });
        if (!user) {
          throw new NotFoundException('User not found');
        }
        method.user = user;
      }

      method.details = JSON.parse(JSON.stringify({}));
      method.paymentId = '';

      const savedMethod = await this.paymentMethodRepository.save(method);
      return savedMethod;
    } catch (error) {
      if (!(error instanceof NotFoundException)) {
        this.logger.error(error.message, error.stack);
      }
      throw error;
    }
  }

  async finOne(methodId: string) {
    try {
      const method = await this.paymentMethodRepository.findOne({
        where: { id: methodId },
      });
      if (!method) {
        throw new BadRequestException('method not found');
      }
      return method;
    } catch (error) {
      if (!(error instanceof NotFoundException)) {
        this.logger.error(error.message, error.stack);
      }
      throw error;
    }
  }

  async findOneMethodByUser(userId: string) {
    try {
      const user = await this.userRepository.findOne({
        where: { id: userId },
        relations: ['paymentMethod'],
      });
      if (!user) {
        throw new BadRequestException('user not found');
      }
      return user;
    } catch (error) {
      if (!(error instanceof NotFoundException)) {
        this.logger.error(error.message, error.stack);
      }
      throw error;
    }
  }
}
