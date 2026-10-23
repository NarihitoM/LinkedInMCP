import { describe, expect, it } from "vitest";
import { ToolError } from "./errors.ts";
import { isPrivateAddress } from "./netGuard.ts";
import { decodeImage, fetchImage } from "./safeFetch.ts";

describe("safeFetch", () => {
  it("flags private and loopback addresses", () => {
    for (const address of ["127.0.0.1", "10.1.2.3", "172.16.0.1", "192.168.1.1", "169.254.169.254", "0.0.0.0", "::1", "fd00::1", "::ffff:127.0.0.1", "::ffff:7f00:1", "64:ff9b::a00:1", "100.64.0.1", "not-an-ip"]) {
      expect(isPrivateAddress(address), address).toBe(true);
    }
  });

  it("allows public addresses", () => {
    for (const address of ["8.8.8.8", "151.101.1.69", "2606:4700::1111"]) {
      expect(isPrivateAddress(address), address).toBe(false);
    }
  });

  it("refuses to fetch from localhost", async () => {
    await expect(fetchImage("http://localhost/image.png")).rejects.toBeInstanceOf(ToolError);
    await expect(fetchImage("file:///etc/passwd")).rejects.toBeInstanceOf(ToolError);
  });

  it("decodes base64 images and validates the type", () => {
    const image = decodeImage("data:image/png;base64,iVBORw0KGgo=", "image/png");
    expect(image.mimeType).toBe("image/png");
    expect(image.buffer.length).toBeGreaterThan(0);
    expect(() => decodeImage("AAAA", "image/svg+xml")).toThrow(ToolError);
  });
});
