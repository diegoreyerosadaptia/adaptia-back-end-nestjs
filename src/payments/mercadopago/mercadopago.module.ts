import { Module } from '@nestjs/common';
import { MercadoPagoController } from './mercadopago.controller';
import { MercadopagoService } from './mercadopago.service';

import { TypeOrmModule } from '@nestjs/typeorm';
import { Organization } from 'src/organizations/entities/organization.entity';
import { PaymentsMethodsModule } from '../payments-methods/payments-methods.module';
import { PaymentMethod } from '../payments-methods/entities/payments-method.entity';
import { EsgAnalysisModule } from 'src/esg_analysis/esg_analysis.module';


@Module({
  imports: [
    TypeOrmModule.forFeature([Organization, PaymentMethod, Organization])
    , PaymentsMethodsModule, EsgAnalysisModule
  ],
  controllers: [MercadoPagoController],
  providers: [MercadopagoService],
  exports: [MercadopagoService],
})
export class MercadopagoModule {}
