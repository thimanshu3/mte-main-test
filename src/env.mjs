import { createEnv } from '@t3-oss/env-nextjs'
import { z } from 'zod'

export const env = createEnv({
  /**
   * Specify your server-side environment variables schema here. This way you can ensure the app
   * isn't built with invalid env vars.
   */
  server: {
    NODE_ENV: z.enum(['development', 'test', 'production']),
    DATABASE_URL: z.string().url(),
    NEXTAUTH_SECRET:
      process.env.NODE_ENV === 'production'
        ? z.string().min(1)
        : z.string().min(1).optional(),
    NEXTAUTH_URL: z.preprocess(
      // This makes Vercel deployments not fail if you don't set NEXTAUTH_URL
      // Since NextAuth.js automatically uses the VERCEL_URL if present.
      str => process.env.VERCEL_URL ?? str,
      // VERCEL_URL doesn't include `https` so it cant be validated as a URL
      process.env.VERCEL ? z.string().min(1) : z.string().url()
    ),
    EMAIL_SERVER_HOST: z.string().min(1),
    EMAIL_SERVER_PORT: z.string().min(1),
    EMAIL_SERVER_USER: z.string().min(1),
    EMAIL_SERVER_PASSWORD: z.string().min(1),
    EMAIL_FROM: z.string().email(),
    EMAIL_ENVIRONMENT: z.enum(['development', 'test', 'production']),
    FIREBASE_PROJECT_ID: z.string().min(1),
    FIREBASE_PRIVATE_KEY: z.string().min(1),
    FIREBASE_CLIENT_EMAIL: z.string().min(1),
    FIREBASE_STORAGE_BUCKET: z.string().min(1),
    WHATSAPP_ENVIRONMENT: z.enum(['development', 'test', 'production']),
    WHATSAPP_BUSINESS_ACCOUNT_ID: z.string().min(1),
    WHATSAPP_BUSINESS_PHONE_NUMBER_ID: z.string().min(1),
    WHATSAPP_WEBHOOK_SECRET: z.string().min(1),
    WHATSAPP_API_ACCESS_TOKEN: z.string().min(1),
    SOCKET_APP_ID: z.string().min(1),
    SOCKET_APP_SECRET: z.string().min(1)
  },

  /**
   * Specify your client-side environment variables schema here. This way you can ensure the app
   * isn't built with invalid env vars. To expose them to the client, prefix them with
   * `NEXT_PUBLIC_`.
   */
  client: {
    // NEXT_PUBLIC_CLIENTVAR: z.string().min(1),
    NEXT_PUBLIC_SOCKET_APP_KEY: z.string().min(1),
    NEXT_PUBLIC_SOCKET_HOST: z.string().min(1),
    NEXT_PUBLIC_SOCKET_PORT: z.string().optional(),
    NEXT_PUBLIC_SOCKET_USE_TLS: z.boolean(),
    NEXT_PUBLIC_SOCKET_CLUSTER: z.string().min(1)
  },

  /**
   * You can't destruct `process.env` as a regular object in the Next.js edge runtimes (e.g.
   * middlewares) or client-side so we need to destruct manually.
   */
  runtimeEnv: {
    NODE_ENV: process.env.NODE_ENV,
    DATABASE_URL: process.env.DATABASE_URL,
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
    NEXTAUTH_URL: process.env.NEXTAUTH_URL,
    EMAIL_SERVER_HOST: process.env.EMAIL_SERVER_HOST,
    EMAIL_SERVER_PORT: process.env.EMAIL_SERVER_PORT,
    EMAIL_SERVER_USER: process.env.EMAIL_SERVER_USER,
    EMAIL_SERVER_PASSWORD: process.env.EMAIL_SERVER_PASSWORD,
    EMAIL_FROM: process.env.EMAIL_FROM,
    EMAIL_ENVIRONMENT: process.env.EMAIL_ENVIRONMENT,
    FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID,
    FIREBASE_PRIVATE_KEY: process.env.FIREBASE_PRIVATE_KEY,
    FIREBASE_CLIENT_EMAIL: process.env.FIREBASE_CLIENT_EMAIL,
    FIREBASE_STORAGE_BUCKET: process.env.FIREBASE_STORAGE_BUCKET,
    WHATSAPP_ENVIRONMENT: process.env.WHATSAPP_ENVIRONMENT,
    WHATSAPP_BUSINESS_ACCOUNT_ID: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID,
    WHATSAPP_BUSINESS_PHONE_NUMBER_ID:
      process.env.WHATSAPP_BUSINESS_PHONE_NUMBER_ID,
    WHATSAPP_API_ACCESS_TOKEN: process.env.WHATSAPP_API_ACCESS_TOKEN,
    WHATSAPP_WEBHOOK_SECRET: process.env.WHATSAPP_WEBHOOK_SECRET,
    SOCKET_APP_ID: process.env.SOCKET_APP_ID,
    SOCKET_APP_SECRET: process.env.SOCKET_APP_SECRET,
    NEXT_PUBLIC_SOCKET_APP_KEY: process.env.NEXT_PUBLIC_SOCKET_APP_KEY,
    NEXT_PUBLIC_SOCKET_HOST: process.env.NEXT_PUBLIC_SOCKET_HOST,
    NEXT_PUBLIC_SOCKET_PORT: process.env.NEXT_PUBLIC_SOCKET_PORT,
    NEXT_PUBLIC_SOCKET_USE_TLS:
      process.env.NEXT_PUBLIC_SOCKET_USE_TLS === 'true',
    NEXT_PUBLIC_SOCKET_CLUSTER: process.env.NEXT_PUBLIC_SOCKET_CLUSTER
  },
  /**
   * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation.
   * This is especially useful for Docker builds.
   */
  skipValidation: !!process.env.SKIP_ENV_VALIDATION
})
