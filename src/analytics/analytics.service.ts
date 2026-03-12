import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  async sendPurchase(params: {
    clientId: string;
    transactionId: string;
    value: number;
    currency: string;
    organizationId: string;
    organizationName?: string;
  }) {
    try {
      const measurementId = process.env.GA_MEASUREMENT_ID!;
      const apiSecret = process.env.GA_API_SECRET!;

      await fetch(
        `https://www.google-analytics.com/mp/collect?measurement_id=${measurementId}&api_secret=${apiSecret}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            client_id: params.clientId,
            events: [
              {
                name: 'payment_success',
                params: {
                  transaction_id: params.transactionId,
                  value: params.value,
                  currency: params.currency,
                  organization_id: params.organizationId,
                  organization_name: params.organizationName,
                  payment_provider: 'mercado_pago',
                },
              },
              {
                name: 'purchase',
                params: {
                  transaction_id: params.transactionId,
                  value: params.value,
                  currency: params.currency,
                  items: [
                    {
                      item_name: 'Analisis ESG Adaptia',
                      quantity: 1,
                      price: params.value,
                    },
                  ],
                },
              },
            ],
          }),
        },
      );
    } catch (error) {
      this.logger.error('Error enviando evento a GA4', error);
    }
  }
}