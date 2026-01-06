import { registerAs } from "@nestjs/config";
import { TypeOrmModuleOptions } from "@nestjs/typeorm";

export default registerAs("database", (): TypeOrmModuleOptions => {
  const dbUrl = process.env.DATABASE_URL;

  if (!dbUrl) {
    throw new Error(
      "DATABASE_URL is missing. Check that ConfigModule.forRoot is loading your .env and that .env contains DATABASE_URL."
    );
  }

  // ✅ detecta supabase.co / supabase.com / pooler.supabase.com
  const isSupabase = dbUrl.includes("supabase");

  // ✅ logs seguros (no muestran password)
  try {
    const u = new URL(dbUrl);
    const poolMax = Number(process.env.PG_POOL_MAX ?? 2);

    console.log(
      `[DB] host=${u.hostname} port=${u.port || "(default)"} isSupabase=${
        u.hostname.includes("supabase")
      } poolMax=${poolMax} nodeEnv=${process.env.NODE_ENV ?? "undefined"}`
    );
  } catch (e) {
    console.log("[DB] DATABASE_URL present but could not be parsed as URL");
  }

  const poolMax = Number(process.env.PG_POOL_MAX ?? 2);

  return {
    type: "postgres",
    url: dbUrl,
    entities: [`${__dirname}/../**/*.entity{.ts,.js}`],
    migrations: [`${__dirname}/../../db/migrations/*{.ts,.js}`],
    migrationsTableName: "migrations",

    // ⚠️ recomendado en prod: usar migrations, no synchronize
    synchronize: process.env.NODE_ENV !== "production",
    logging: process.env.NODE_ENV !== "production",

    // ✅ SSL también a nivel raíz (TypeORM) + extra (pg)
    ssl: isSupabase ? { rejectUnauthorized: false } : undefined,

    relationLoadStrategy: "query", 

    extra: {
      connectionTimeoutMillis: 15000,
      keepAlive: true,

      // 🔻 CLAVE para Railway + Supabase pooler
      max: Number.isFinite(poolMax) && poolMax > 0 ? poolMax : 2,
      idleTimeoutMillis: 10_000,

      ssl: isSupabase ? { rejectUnauthorized: false } : undefined,
    },

    // ✅ más tolerancia a cortes/retries en cloud
    retryAttempts: 10,
    retryDelay: 3000,
  };
});
