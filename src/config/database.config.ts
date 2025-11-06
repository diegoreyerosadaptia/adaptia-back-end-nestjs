import { registerAs } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';

const isSupabase = process.env.DATABASE_URL?.includes('supabase.co');

export default registerAs(
  'database',
  (): TypeOrmModuleOptions => ({
    type: 'postgres',
    url: process.env.DATABASE_URL,
    entities: [`${__dirname}/../**/*.entity{.ts,.js}`],
    migrations: [`${__dirname}/../../db/migrations/*{.ts,.js}`],
    migrationsTableName: 'migrations',

    // ✅ SSL solo si es Supabase o producción

    // ✅ En producción: false, en local: true
    synchronize: process.env.NODE_ENV !== 'production',
    logging: process.env.NODE_ENV !== 'production',

    // 🔒 Evita errores si falta DATABASE_URL
    extra: {
      connectionTimeoutMillis: 10000,
    },
  }),
);


