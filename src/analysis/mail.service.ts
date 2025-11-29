import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Resend } from 'resend'

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name)
  private readonly resend: Resend
  private readonly from: string

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('RESEND_API_KEY')
    this.from =
      this.configService.get<string>('RESEND_FROM') || 'no-reply@adaptianow.com'
    this.resend = new Resend(apiKey)
  }

  async sendAnalysisEmail(params: {
    to: string
    organizationName: string
    analysisId: string
    attachment?: {
      filename: string
      content: string // base64
      contentType: string
    }
  }) {
    const { to, organizationName, analysisId, attachment } = params
  
    const frontendUrl =
      this.configService.get<string>('ALLOWED_ORIGINS') || 'http://localhost:3000'
  
    const analysisUrl = `${frontendUrl}/dashboard/organization/${analysisId}`
  
    const subject = `Tu análisis ESG de ${organizationName} ya está disponible`
  
    const html = `
  <!DOCTYPE html>
  <html lang="es">
    <body style="font-family: Arial, sans-serif; background: #f5f5f5; padding: 40px;">
      <div style="max-width: 520px; margin: auto; background: #ffffff; padding: 32px; border-radius: 12px; border: 1px solid #e5e7eb;">
        
        <h2 style="color: #163F6A; margin-top: 0; font-size: 22px;">
          Tu análisis ESG ya está disponible
        </h2>
  
        <p style="font-size: 16px; color: #374151; line-height: 1.5;">
          Te compartimos que el análisis ESG de <strong>${organizationName}</strong> ya fue generado y está disponible en tu panel de Adaptia.
        </p>
  
        <p style="text-align: center; margin: 32px 0;">
          <a 
            href="${analysisUrl}" 
            style="
              background-color: #619F44;
              color: white;
              padding: 14px 22px;
              border-radius: 8px;
              text-decoration: none;
              font-weight: bold;
              font-size: 16px;
            "
          >
            Ver análisis en Adaptia
          </a>
        </p>
  
        <p style="font-size: 14px; color: #4B5563;">
          Si el botón no funciona, copia y pega este enlace en tu navegador:
          <br /><br />
          <a href="${analysisUrl}" style="color: #163F6A;">
            ${analysisUrl}
          </a>
        </p>
  
        <p style="font-size: 14px; color: #4B5563; margin-top: 32px;">
          Si tienes alguna duda puedes contactarnos a 
          <a href="mailto:diego@adaptianow.com" style="color: #163F6A;">diego@adaptianow.com</a>.
        </p>
      </div>
    </body>
  </html>
    `
  
    try {
      await this.resend.emails.send({
        from: this.from,
        // 👇 cliente + Diego
        to: [to, 'diego@adaptianow.com'],
        subject,
        html,
        attachments: attachment
          ? [
              {
                filename: attachment.filename,
                content: attachment.content,
                contentType: attachment.contentType,
              },
            ]
          : undefined,
      })
  
      this.logger.log(`Email de análisis enviado a ${to} y a diego@adaptianow.com`)
    } catch (err: any) {
      this.logger.error(
        `Error enviando email a ${to} / diego@adaptianow.com: ${err.message}`,
        err.stack,
      )
    }
  }

  async sendPaymentConfirmationEmail(params: {
    to: string
    organizationName: string
    amount?: number      // opcional, por si querés mostrar el monto
    planName?: string    // opcional, por si tenés nombre del plan
  }) {
    const { to, organizationName, amount, planName } = params

    const frontendUrl =
      this.configService.get<string>('ALLOWED_ORIGINS') || 'http://localhost:3000'

    const dashboardUrl = `${frontendUrl}/dashboard`

    const formattedAmount =
      typeof amount === 'number'
        ? amount.toLocaleString('es-AR', {
            style: 'currency',
            currency: 'USD', // o ARS según tu flujo
          })
        : null

    const subject = `Confirmación de pago - ${organizationName}`

    const html = `
<!DOCTYPE html>
<html lang="es">
  <body style="font-family: Arial, sans-serif; background: #f5f5f5; padding: 40px;">
    <div style="max-width: 520px; margin: auto; background: #ffffff; padding: 32px; border-radius: 12px; border: 1px solid #e5e7eb;">
      
      <h2 style="color: #163F6A; margin-top: 0; font-size: 22px;">
        ¡Tu pago se registró correctamente!
      </h2>

      <p style="font-size: 16px; color: #374151; line-height: 1.5;">
        Te confirmamos que el pago para <strong>${organizationName}</strong> fue procesado con éxito.
      </p>

      ${
        planName || formattedAmount
          ? `<p style="font-size: 15px; color: #374151; line-height: 1.5; margin-top: 8px;">
              ${planName ? `Plan contratado: <strong>${planName}</strong><br />` : ''}
              ${formattedAmount ? `Monto: <strong>${formattedAmount}</strong>` : ''}
            </p>`
          : ''
      }

      <p style="text-align: center; margin: 32px 0;">
        <a 
          href="${dashboardUrl}" 
          style="
            background-color: #619F44;
            color: white;
            padding: 14px 22px;
            border-radius: 8px;
            text-decoration: none;
            font-weight: bold;
            font-size: 16px;
          "
        >
          Ir a mi panel en Adaptia
        </a>
      </p>

      <p style="font-size: 14px; color: #4B5563;">
        Desde tu panel podrás revisar tus análisis ESG, tu organización y los próximos pasos sugeridos.
      </p>

      <p style="font-size: 14px; color: #4B5563; margin-top: 32px;">
        Si tienes alguna duda puedes contactarnos a 
        <a href="mailto:diego@adaptianow.com" style="color: #163F6A;">diego@adaptianow.com</a>.
      </p>
    </div>
  </body>
</html>
    `

    try {
      await this.resend.emails.send({
        from: this.from,
        // 👇 cliente + Diego
        to: [to, 'diego@adaptianow.com'],
        subject,
        html,
      })

      this.logger.log(
        `Email de confirmación de pago enviado a ${to} y a diego@adaptianow.com`,
      )
    } catch (err: any) {
      this.logger.error(
        `Error enviando email de pago a ${to} / diego@adaptianow.com: ${err.message}`,
        err.stack,
      )
    }
  }
  
}
