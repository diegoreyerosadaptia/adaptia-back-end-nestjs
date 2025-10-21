import { registerAs } from '@nestjs/config';
import { type TypeOrmModuleOptions } from '@nestjs/typeorm';

const isSupabase = process.env.DATABASE_URL?.includes('supabase.co');

export default registerAs(
  'database',
  () =>
    ({
      type: 'postgres',
      url: process.env.DATABASE_URL,
      entities: [`${__dirname}/../**/*.entity{.ts,.js}`],
      synchronize: true,
      ssl: isSupabase ? { rejectUnauthorized: false } : false,
    }) as TypeOrmModuleOptions,
);
