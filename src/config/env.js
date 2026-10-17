import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().default(5000),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  MONGODB_URI: z
    .string()
    .min(1, 'MONGODB_URI is required')
    .default('mongodb://127.0.0.1:27017/bookleaf'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters long'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  CLIENT_ORIGIN: z.string().default('http://localhost:5173'),
  AI_PROVIDER: z
    .string()
    .transform((val) => val.trim().toLowerCase())
    .pipe(z.enum(['anthropic', 'openai', 'gemini']))
    .default('openai'),
  AI_API_KEY: z.string().optional().default(''),
  AI_BASE_URL: z.string().optional().default('https://bettergpt-keys.vercel.app/v1'),
  AI_MODEL: z.string().default('codex-auto-review'),
  AI_TIMEOUT_MS: z.coerce.number().default(15000),
  AI_MAX_RETRIES: z.coerce.number().default(1),
  AI_ENABLED: z
    .string()
    .transform((val) => val.trim().toLowerCase() === 'true')
    .or(z.boolean())
    .default(false),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:');
  parsed.error.issues.forEach((issue) => {
    console.error(`   - ${issue.path.join('.')}: ${issue.message}`);
  });
  process.exit(1);
}

export const env = parsed.data;
export default env;
