import { describe, expect, it } from "vitest";
import { runExclusive } from "./userQueue.ts";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe("runExclusive", () => {
  it("runs tasks for the same key one at a time", async () => {
    const order: string[] = [];
    await Promise.all([
      runExclusive("a", async () => {
        order.push("start-1");
        await delay(20);
        order.push("end-1");
      }),
      runExclusive("a", async () => {
        order.push("start-2");
        order.push("end-2");
      }),
    ]);
    expect(order).toEqual(["start-1", "end-1", "start-2", "end-2"]);
  });

  it("keeps going after a task fails", async () => {
    const failing = runExclusive("b", async () => {
      throw new Error("boom");
    });
    const next = runExclusive("b", async () => "ok");
    await expect(failing).rejects.toThrow("boom");
    await expect(next).resolves.toBe("ok");
  });

  it("runs different keys in parallel", async () => {
    const order: string[] = [];
    await Promise.all([
      runExclusive("c", async () => {
        await delay(20);
        order.push("c");
      }),
      runExclusive("d", async () => {
        order.push("d");
      }),
    ]);
    expect(order).toEqual(["d", "c"]);
  });
});
