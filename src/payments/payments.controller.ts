import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { AuthOrTokenAuthGuard } from 'src/utils/guards/auth-or-token.guard';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('create-preference')

  async createPreference(@Body() createPaymentDto: CreatePaymentDto) {
    return this.paymentsService.createPreference(createPaymentDto);
  }
}
