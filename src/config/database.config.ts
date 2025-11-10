import { registerAs } from '@nestjs/config'
import { TypeOrmModuleOptions } from '@nestjs/typeorm'

const isSupabase = process.env.DATABASE_URL?.includes('supabase.co')

export default registerAs(
  'database',
  (): TypeOrmModuleOptions => ({
    type: 'postgres',
    url: process.env.DATABASE_URL,
    entities: [`${__dirname}/../**/*.entity{.ts,.js}`],
    migrations: [`${__dirname}/../../db/migrations/*{.ts,.js}`],
    migrationsTableName: 'migrations',

    // ✅ Forzar sincronización automática en cualquier entorno (incluye Supabase)
    synchronize: true,

    // 🧩 Mostrar logs solo si no estás en producción
    logging: process.env.NODE_ENV !== 'production',

    // 🔒 Seguridad y timeout
    extra: {
      connectionTimeoutMillis: 10000,
      ssl: isSupabase
        ? {
            rejectUnauthorized: false,
          }
        : undefined,
    },
  })
)
