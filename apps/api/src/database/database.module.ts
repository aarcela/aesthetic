import { Global, Module } from '@nestjs/common';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

import { DATABASE, type Database } from './database.tokens.js';
import * as schema from './schema.js';
import { TenantDb } from './tenant-db.js';

export { DATABASE, type Database } from './database.tokens.js';

@Global()
@Module({
  providers: [
    {
      provide: DATABASE,
      useFactory: (): Database | null => {
        const connectionString = process.env.DATABASE_URL;

        if (!connectionString) {
          return null;
        }

        if (
          /\[PROJECT-REF\]|\[REGION\]|\[YOUR-PASSWORD\]|YOUR_PASSWORD|placeholder/i.test(
            connectionString,
          )
        ) {
          throw new Error(
            'DATABASE_URL still has placeholders. Paste the real URI from Supabase → Settings → Database → Connection string.',
          );
        }

        const isSupabase =
          /supabase\.(co|com)/i.test(connectionString) ||
          /pooler\.supabase\.com/i.test(connectionString);

        const poolMax = Number(process.env.PG_POOL_MAX ?? 10);

        return drizzle(
          new Pool({
            connectionString,
            max: Number.isFinite(poolMax) && poolMax > 0 ? poolMax : 10,
            ssl: isSupabase ? { rejectUnauthorized: false } : undefined,
          }),
          { schema },
        );
      },
    },
    TenantDb,
  ],
  exports: [DATABASE, TenantDb],
})
export class DatabaseModule {}
