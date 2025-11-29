import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { setGlobalDispatcher, Agent } from 'undici';
import Redis from 'ioredis';
import { json, urlencoded } from 'express'

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger('NestApplication');
  const configService = app.get(ConfigService);

  // 🌍 CORS
  app.enableCors({
    origin: configService.getOrThrow('app.allowedOrigins'),
    methods: 'GET,PUT,PATCH,POST,DELETE',
  });

  // 🕐 Ajustes de timeout para llamadas largas (PDF/AI)
  setGlobalDispatcher(
    new Agent({
      headersTimeout: 35 * 60 * 1000,
      bodyTimeout: 0,
      connectTimeout: 30_000,
      keepAliveTimeout: 600_000,
    }),
  );

  // 🧹 Validaciones globales
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  app.use(json({ limit: '2mb' }))
  app.use(urlencoded({ extended: true, limit: '2mb' }))

  // 🧩 Test de conexión Redis (solo log)
  const redisUrl = process.env.REDIS_URL;
  if (redisUrl) {
    try {
      const redis = new Redis(redisUrl);
      await redis.set('test-key', 'ok', 'EX', 5);
      const value = await redis.get('test-key');
      logger.log(`✅ Redis conectado correctamente: ${value}`);
      await redis.quit();
    } catch (err) {
      logger.error('❌ Error conectando a Redis:', err);
    }
  } else {
    logger.warn('⚠️ Variable REDIS_URL no definida');
  }

  // 🚀 Arrancar servidor
  const port = configService.get('app.port');
  await app.listen(port, '0.0.0.0');
  logger.log(`✅ Application is running on port ${port}`);
}
bootstrap();
