import { Controller, Get, Post, Param } from '@nestjs/common';
import { PaymentsMethodsService } from './payments-methods.service';

@Controller('payments-methods')
export class PaymentsMethodsController {
  constructor(
    private readonly paymentsMethodsService: PaymentsMethodsService,
  ) {}

  @Post('users/:userId')
  create(@Param('userId') userId: string) {
    return this.paymentsMethodsService.createMethodPayment(userId);
  }

  @Get(':methodId')
  findOne(@Param('methodId') methodId: string) {
    return this.paymentsMethodsService.finOne(methodId);
  }

  @Get('users/:userId')
  findOneMethodByUser(@Param(':userId') userId: string) {
    return this.paymentsMethodsService.findOneMethodByUser(userId);
  }
}
