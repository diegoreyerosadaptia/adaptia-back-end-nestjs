import { registerAs } from "@nestjs/config";
import { TypeOrmModuleOptions } from "@nestjs/typeorm";

export default registerAs("database", (): TypeOrmModuleOptions => {
  const dbUrl = process.env.DATABASE_URL;

  if (!dbUrl) {
    throw new Error(
      "DATABASE_URL is missing. Check that ConfigModule.forRoot is loading your .env and that .env contains DATABASE_URL."
    );
  }

  const isSupabase = dbUrl.includes("supabase"); // supabase.co / supabase.com / pooler.supabase.com

  return {
    type: "postgres",
    url: dbUrl,
    entities: [`${__dirname}/../**/*.entity{.ts,.js}`],
    migrations: [`${__dirname}/../../db/migrations/*{.ts,.js}`],
    migrationsTableName: "migrations",

    synchronize: process.env.NODE_ENV !== "production",
    logging: process.env.NODE_ENV !== "production",

    ssl: isSupabase ? { rejectUnauthorized: false } : undefined,

    extra: {
      connectionTimeoutMillis: 15000,
      keepAlive: true,
      max: 5,
      idleTimeoutMillis: 30000,
      ssl: isSupabase ? { rejectUnauthorized: false } : undefined,
    },

    retryAttempts: 5,
    retryDelay: 3000,
  };
});
