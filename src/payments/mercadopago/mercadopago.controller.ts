import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { MercadopagoService } from './mercadopago.service';
import { MercadopagoSignatureGuard } from './guard/mercadopago-signature.guard';

@Controller('mercadopago')
export class MercadoPagoController {
  constructor(private readonly mercadopagoService: MercadopagoService) {}

  @Post('webhook')
  @UseGuards(MercadopagoSignatureGuard)
  async receiveWebhook(@Body() payload: any) {
    console.log('🔔 Webhook recibido');
    return await this.mercadopagoService.receiveWebhook(payload);
  }

  @Post('health')
  async checkHealth() {
    return await this.mercadopagoService.checkHealth();
  }
}
