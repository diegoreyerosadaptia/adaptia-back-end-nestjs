// /lib/redis.ts
import { createClient } from "redis";

let client: any;

if (!globalThis.redis) {
  globalThis.redis = createClient({
    url: process.env.REDIS_URL,
    socket: {
      tls: true,
      rejectUnauthorized: false, // necesario para conexiones seguras en Redis Cloud
    },
  });

  globalThis.redis.connect().catch(console.error);
}

client = globalThis.redis;

export default client;
