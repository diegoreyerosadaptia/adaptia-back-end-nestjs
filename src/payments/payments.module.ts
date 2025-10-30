import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from 'src/users/entities/user.entity';
import { PaymentsService } from './payments.service';
import { MercadopagoModule } from './mercadopago/mercadopago.module';
import { PaymentsMethodsModule } from './payments-methods/payments-methods.module';
import { Organization } from 'src/organizations/entities/organization.entity';
import { PaymentsController } from './payments.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Organization]),
    MercadopagoModule,
    PaymentsMethodsModule,
  ],
  controllers: [PaymentsController],
  providers: [PaymentsService],
})
export class PaymentsModule {}
