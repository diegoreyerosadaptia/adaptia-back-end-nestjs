import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppConfig, DatabaseConfig } from './config';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { AnalysisModule } from './analysis/analysis.module';
import { EsgAnalysisModule } from './esg_analysis/esg_analysis.module';
import { BullModule } from '@nestjs/bull';
import { PaymentsModule } from './payments/payments.module';
import { PaymentsMethodsModule } from './payments/payments-methods/payments-methods.module';

@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const redisUrl = process.env.REDIS_URL;

        if (redisUrl) {
          const url = new URL(redisUrl);
          return {
            redis: {
              host: url.hostname,
              port: Number(url.port),
              password: url.password,
              tls: {},
            },
          };
        }

        return {
          redis: {
            host: 'localhost',
            port: 6379,
          },
        };
      },
      inject: [ConfigService],
    }),
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: [AppConfig, DatabaseConfig],
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        ...configService.get('database'),
      }),
      inject: [ConfigService],
    }),
    AuthModule,
    UsersModule,
    OrganizationsModule,
    AnalysisModule,
    EsgAnalysisModule,
    PaymentsModule,
    PaymentsMethodsModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
