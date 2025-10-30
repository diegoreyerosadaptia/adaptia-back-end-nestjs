import { Module } from '@nestjs/common';
import { PaymentsMethodsService } from './payments-methods.service';
import { PaymentsMethodsController } from './payments-methods.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentMethod } from './entities/payments-method.entity';
import { User } from 'src/users/entities/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([PaymentMethod, User])],
  controllers: [PaymentsMethodsController],
  providers: [PaymentsMethodsService],
  exports: [PaymentsMethodsService],
})
export class PaymentsMethodsModule {}
