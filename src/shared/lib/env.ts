import { z } from "zod";

export function decodeKey(value: string): Buffer | undefined {
  if (/^[0-9a-f]{64}$/i.test(value)) return Buffer.from(value, "hex");
  const decoded = Buffer.from(value, "base64");
  return decoded.length === 32 ? decoded : undefined;
}

const positiveInt = (fallback: number) => z.coerce.number().int().positive().default(fallback);

const envSchema = z.object({
  BASE_URL: z
    .url()
    .default("http://localhost:3000")
    .transform((value) => value.replace(/\/+$/, "")),
  PORT: positiveInt(3000),
  LINKEDIN_CLIENT_ID: z.string("is required").min(1, "is required"),
  LINKEDIN_CLIENT_SECRET: z.string("is required").min(1, "is required"),
  LINKEDIN_API_VERSION: z.string().regex(/^\d{6}$/, "must look like YYYYMM").default("202609"),
  SESSION_ENCRYPTION_KEY: z
    .string("is required")
    .transform((value) => value.trim().replace(/^(["'])(.*)\1$/, "$2").trim())
    .refine(
      (value) => decodeKey(value) !== undefined,
      "must be 64 hex characters. Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"",
    ),
  DATA_DIR: z.string().default("data"),
  MAX_BROWSERS: positiveInt(3),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | undefined;

function isLocalUrl(value: string): boolean {
  try {
    const { hostname } = new URL(value);
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
  } catch {
    return false;
  }
}

export function getEnv(): Env {
  if (cached) return cached;

  const present = Object.fromEntries(Object.entries(process.env).filter(([, value]) => value !== ""));
  const vercelUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercelUrl && (!present.BASE_URL || isLocalUrl(present.BASE_URL))) {
    present.BASE_URL = `https://${vercelUrl}`;
  }
  const result = envSchema.safeParse(present);
  if (!result.success) {
    const issues = result.error.issues.map((issue) => `  ${issue.path.join(".")}: ${issue.message}`).join("\n");
    throw new Error(`Invalid environment configuration (check your .env file):\n${issues}`);
  }

  cached = result.data;
  return cached;
}

export function browserToolsEnabled(): boolean {
  return !process.env.VERCEL;
}
