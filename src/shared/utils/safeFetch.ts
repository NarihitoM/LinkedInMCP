import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { ToolError } from "./errors.ts";

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif"];

export interface ImageFile {
  buffer: Buffer;
  mimeType: string;
  name: string;
}

export function isPrivateAddress(address: string): boolean {
  if (isIP(address) === 6) {
    const lower = address.toLowerCase();
    if (lower.startsWith("::ffff:")) return isPrivateAddress(lower.slice(7));
    return lower === "::1" || lower === "::" || lower.startsWith("fc") || lower.startsWith("fd") || lower.startsWith("fe80");
  }
  const parts = address.split(".").map(Number);
  const [a = 0, b = 0] = parts;
  return (
    a === 10 ||
    a === 127 ||
    a === 0 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127) ||
    a >= 224
  );
}

async function assertPublicHost(url: URL): Promise<void> {
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new ToolError("Image URL must use http or https.");
  }
  const addresses = await lookup(url.hostname, { all: true }).catch(() => []);
  if (addresses.length === 0) {
    throw new ToolError(`Could not resolve ${url.hostname}.`);
  }
  if (addresses.some(({ address }) => isPrivateAddress(address))) {
    throw new ToolError("Image URL points to a private network address, which is not allowed.");
  }
}

function assertImage(mimeType: string, size: number): void {
  if (!ALLOWED_IMAGE_TYPES.includes(mimeType)) {
    throw new ToolError(`Unsupported image type ${mimeType}. Use JPEG, PNG or GIF.`);
  }
  if (size > MAX_IMAGE_BYTES) {
    throw new ToolError("Image is larger than 10 MB.");
  }
}

export async function fetchImage(rawUrl: string): Promise<ImageFile> {
  let url = new URL(rawUrl);

  for (let redirects = 0; redirects < 4; redirects += 1) {
    await assertPublicHost(url);
    const response = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(20_000) });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) break;
      url = new URL(location, url);
      continue;
    }
    if (!response.ok) {
      throw new ToolError(`Could not download image (HTTP ${response.status}).`);
    }

    const mimeType = (response.headers.get("content-type") ?? "").split(";")[0]?.trim() ?? "";
    const declared = Number(response.headers.get("content-length") ?? 0);
    assertImage(mimeType, declared);
    const buffer = Buffer.from(await response.arrayBuffer());
    assertImage(mimeType, buffer.length);
    const name = url.pathname.split("/").pop() || "image";
    return { buffer, mimeType, name };
  }

  throw new ToolError("Image URL redirected too many times.");
}

export function decodeImage(base64: string, mimeType: string): ImageFile {
  const buffer = Buffer.from(base64.replace(/^data:[^;]+;base64,/, ""), "base64");
  assertImage(mimeType, buffer.length);
  const extension = mimeType.split("/")[1] ?? "img";
  return { buffer, mimeType, name: `image.${extension}` };
}

export async function loadImage(input: { imageUrl?: string | undefined; imageBase64?: string | undefined; mimeType?: string | undefined }): Promise<ImageFile> {
  if (input.imageUrl) return fetchImage(input.imageUrl);
  if (input.imageBase64) return decodeImage(input.imageBase64, input.mimeType ?? "image/jpeg");
  throw new ToolError("Provide either imageUrl or imageBase64.");
}
