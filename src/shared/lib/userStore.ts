import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { getEnv } from "./env.ts";
import { seal, sha256, unseal } from "./seal.ts";
import { runExclusive } from "./userQueue.ts";

const cookieSchema = z.looseObject({
  name: z.string(),
  value: z.string(),
  domain: z.string(),
  path: z.string(),
  expires: z.number(),
  httpOnly: z.boolean(),
  secure: z.boolean(),
  sameSite: z.enum(["Strict", "Lax", "None"]),
});

const originSchema = z.looseObject({
  origin: z.string(),
  localStorage: z.array(z.object({ name: z.string(), value: z.string() })),
});

export const storageStateSchema = z.object({
  cookies: z.array(cookieSchema),
  origins: z.array(originSchema),
});

const userSchema = z.object({
  id: z.string(),
  sub: z.string(),
  name: z.string(),
  email: z.string().optional(),
  picture: z.string().optional(),
  linkedin: z.object({
    accessToken: z.string(),
    scopes: z.array(z.string()),
    expiresAt: z.number(),
  }),
  browser: z
    .object({
      storageState: storageStateSchema,
      publicIdentifier: z.string(),
      status: z.enum(["active", "expired"]),
      updatedAt: z.number(),
    })
    .optional(),
  proxyUrl: z.string().optional(),
  connectNonce: z.string().optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
});

const fileSchema = z.object({ id: z.string(), updatedAt: z.number(), sealed: z.string() });

export type UserRecord = z.infer<typeof userSchema>;
export type BrowserSession = NonNullable<UserRecord["browser"]>;

const USER_ID = /^[0-9a-f]{32}$/;

export function userIdFor(sub: string): string {
  return sha256(`linkedin:${sub}`).slice(0, 32);
}

function usersDir(): string {
  return join(getEnv().DATA_DIR, "users");
}

function fileFor(id: string): string {
  if (!USER_ID.test(id)) throw new Error("Invalid user id");
  return join(usersDir(), `${id}.json`);
}

function isMissing(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}

async function readRecord(id: string): Promise<UserRecord | undefined> {
  let raw: string;
  try {
    raw = await readFile(fileFor(id), "utf8");
  } catch (error) {
    if (isMissing(error)) return undefined;
    throw error;
  }

  const file = fileSchema.parse(JSON.parse(raw));
  const opened = unseal("user", file.sealed, userSchema);
  if (!opened) throw new Error(`User file ${id} could not be decrypted. Was SESSION_ENCRYPTION_KEY changed?`);
  return opened.data;
}

async function writeRecord(record: UserRecord): Promise<void> {
  await mkdir(usersDir(), { recursive: true });
  const target = fileFor(record.id);
  const temporary = `${target}.${process.pid}.tmp`;
  const file = { id: record.id, updatedAt: record.updatedAt, sealed: seal("user", record) };
  await writeFile(temporary, `${JSON.stringify(file, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  await rename(temporary, target);
}

export function readUser(id: string): Promise<UserRecord | undefined> {
  return runExclusive(`store:${id}`, () => readRecord(id));
}

export function saveUser(record: UserRecord): Promise<void> {
  return runExclusive(`store:${record.id}`, () => writeRecord({ ...record, updatedAt: Date.now() }));
}

export function updateUser(id: string, mutate: (record: UserRecord) => UserRecord): Promise<UserRecord> {
  return runExclusive(`store:${id}`, async () => {
    const current = await readRecord(id);
    if (!current) throw new Error("User not found");
    const next = { ...mutate(current), updatedAt: Date.now() };
    await writeRecord(next);
    return next;
  });
}

export function deleteUser(id: string): Promise<void> {
  return runExclusive(`store:${id}`, () => rm(fileFor(id), { force: true }));
}
