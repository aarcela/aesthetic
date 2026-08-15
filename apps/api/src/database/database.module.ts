import { Global, Module } from '@nestjs/common';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

import * as schema from './schema.js';

export const DATABASE = Symbol('DATABASE');
export type Database = NodePgDatabase<typeof schema>;

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

        return drizzle(new Pool({ connectionString }), { schema });
      },
    },
  ],
  exports: [DATABASE],
})
export class DatabaseModule {}
