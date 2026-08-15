import { defineConfig } from 'drizzle-kit';
const url = process.env.DATABASE_URL;
if (!url) {
    throw new Error('DATABASE_URL is required to generate Drizzle artifacts.');
}
export default defineConfig({
    schema: './src/database/schema.ts',
    out: '../../supabase/drizzle',
    dialect: 'postgresql',
    dbCredentials: { url },
});
