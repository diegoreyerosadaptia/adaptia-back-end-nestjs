import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { setGlobalDispatcher, Agent } from 'undici';


async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger('NestApplication');
  const configService = app.get(ConfigService);

  app.enableCors({
    origin: configService.getOrThrow('app.allowedOrigins'),
    methods: 'GET,PUT,PATCH,POST,DELETE',
  });

  setGlobalDispatcher(
    new Agent({
      // esperar hasta 35 min a que lleguen HEADERS
      headersTimeout: 35 * 60 * 1000,
      // no cortar por tiempo de BODY (que puede tardar)
      bodyTimeout: 0,
      // opcional: tiempo de conexión
      connectTimeout: 30_000,
      keepAliveTimeout: 600_000,
    }),
  );
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  const port = configService.get('app.port');
  await app.listen(port, '0.0.0.0');
  logger.log(`Application is running on port ${port}`);
}
bootstrap();
