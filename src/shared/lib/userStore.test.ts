import { readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { deleteUser, readUser, saveUser, updateUser, userIdFor, type UserRecord } from "./userStore.ts";

const DATA_DIR = join("data-test", "user-store");
process.env.DATA_DIR = DATA_DIR;

function makeUser(sub: string): UserRecord {
  return {
    id: userIdFor(sub),
    sub,
    name: "Test User",
    linkedin: { accessToken: "secret-linkedin-token", scopes: ["openid"], expiresAt: Date.now() + 60_000 },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

afterAll(async () => {
  await rm(DATA_DIR, { recursive: true, force: true });
});

describe("userStore", () => {
  it("writes encrypted files and reads them back", async () => {
    const user = makeUser("member-1");
    await saveUser(user);

    const raw = await readFile(join(DATA_DIR, "users", `${user.id}.json`), "utf8");
    expect(raw).not.toContain("secret-linkedin-token");
    expect(raw).not.toContain("Test User");

    const loaded = await readUser(user.id);
    expect(loaded?.linkedin.accessToken).toBe("secret-linkedin-token");
  });

  it("serializes concurrent updates", async () => {
    const user = makeUser("member-2");
    await saveUser(user);
    await Promise.all(
      Array.from({ length: 10 }, (_, index) =>
        updateUser(user.id, (current) => ({ ...current, name: `${current.name}|${index}` })),
      ),
    );
    const loaded = await readUser(user.id);
    expect(loaded?.name.split("|")).toHaveLength(11);
  });

  it("returns undefined for missing users and deletes files", async () => {
    const user = makeUser("member-3");
    await saveUser(user);
    await deleteUser(user.id);
    expect(await readUser(user.id)).toBeUndefined();
  });

  it("rejects ids that could escape the folder", async () => {
    await expect(readUser("../../etc/passwd")).rejects.toThrow("Invalid user id");
  });
});
