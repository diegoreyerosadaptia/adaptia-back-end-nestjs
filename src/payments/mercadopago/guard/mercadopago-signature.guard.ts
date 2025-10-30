import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import * as crypto from 'crypto';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class MercadopagoSignatureGuard implements CanActivate {
  private readonly logger = new Logger(MercadopagoSignatureGuard.name);
  private readonly mercadopagoWebhookSecret: string;

  constructor(private readonly configService: ConfigService) {
    this.mercadopagoWebhookSecret = this.configService.getOrThrow(
      'MERCADOPAGO_WEBHOOK_SECRET_KEY',
    );
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const { query, headers, body } = request;
    const paymentId = (query?.id || query['data.id']) ?? '';
    const xSignature = headers['x-signature'] as string;
    const xRequestId = headers['x-request-id'] as string;

    this.logger.debug(`[${paymentId}] Verifying signature:
      Signature: ${xSignature}
      RequestId: ${xRequestId}
      PaymentId: ${paymentId}
      Body: ${JSON.stringify(body)}
    `);

    try {
      const verifiedSignature = await this.verifySignature(
        xSignature,
        xRequestId,
        paymentId as string,
      );

      if (!verifiedSignature) {
        this.logger.warn(`[${paymentId}] Invalid webhook signature
          Signature: ${xSignature}
          RequestId: ${xRequestId}
          PaymentId: ${paymentId}
        `);
        throw new UnauthorizedException();
      }

      return true;
    } catch (error) {
      throw new UnauthorizedException();
    }
  }

  private async verifySignature(
    signature: string,
    requestId: string,
    id: string,
  ): Promise<boolean> {
    if (!signature || !requestId || !id) {
      this.logger.warn(
        'Missing required parameters for signature verification',
        { signature, requestId, id },
      );
      return false;
    }

    try {
      const signatureParts = new Map(
        signature.split(',').map((part) => {
          const [key, value] = part.split('=').map((s) => s.trim());
          return [key, value];
        }),
      );

      const ts = signatureParts.get('ts');
      const hash = signatureParts.get('v1');

      if (!ts || !hash) {
        this.logger.warn('Invalid signature format: missing ts or v1', {
          ts,
          hash,
          signature,
        });
        return false;
      }

      const manifest = `id:${id};request-id:${requestId};ts:${ts};`;

      this.logger.debug(`Verifying signature:
        Manifest: ${manifest}
        Expected hash: ${hash}
        Secret key length: ${this.mercadopagoWebhookSecret.length}
      `);

      const calculatedSignature = crypto
        .createHmac('sha256', this.mercadopagoWebhookSecret.trim())
        .update(manifest, 'utf8')
        .digest('hex');

      this.logger.debug(`Calculated signature: ${calculatedSignature}`);

      if (calculatedSignature === hash) {
        this.logger.log('HMAC verification passed');
        return true;
      } else {
        this.logger.warn('HMAC verification failed', {
          calculatedSignature,
          expectedHash: hash,
          manifest,
        });
        return false;
      }
    } catch (error) {
      this.logger.error('Error verifying signature', {
        error: error.message,
        stack: error.stack,
        signature,
        requestId,
        id,
      });
      throw error;
    }
  }
}
