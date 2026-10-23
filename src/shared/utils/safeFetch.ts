import { request as httpRequest, type IncomingMessage } from "node:http";
import { request as httpsRequest } from "node:https";
import { ToolError } from "./errors.ts";
import { assertPublicHostname, PrivateAddressError, publicOnlyLookup } from "./netGuard.ts";

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_REDIRECTS = 4;
const IDLE_TIMEOUT_MS = 20_000;
const TOTAL_TIMEOUT_MS = 45_000;
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif"];

export interface ImageFile {
  buffer: Buffer;
  mimeType: string;
  name: string;
}

function assertImage(mimeType: string, size: number): void {
  if (!ALLOWED_IMAGE_TYPES.includes(mimeType)) {
    throw new ToolError(`Unsupported image type ${mimeType || "(none)"}. Use JPEG, PNG or GIF.`);
  }
  if (size > MAX_IMAGE_BYTES) {
    throw new ToolError("Image is larger than 10 MB.");
  }
}

function get(url: URL, signal: AbortSignal): Promise<IncomingMessage> {
  const request = url.protocol === "https:" ? httpsRequest : httpRequest;
  return new Promise((resolve, reject) => {
    const outgoing = request(url, { method: "GET", lookup: publicOnlyLookup, timeout: IDLE_TIMEOUT_MS, signal }, resolve);
    outgoing.on("timeout", () => outgoing.destroy(new ToolError("Image download timed out.")));
    outgoing.on("error", reject);
    outgoing.end();
  });
}

function readCapped(response: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let total = 0;
    response.on("data", (chunk: Buffer) => {
      total += chunk.length;
      if (total > MAX_IMAGE_BYTES) {
        response.destroy(new ToolError("Image is larger than 10 MB."));
        return;
      }
      chunks.push(chunk);
    });
    response.on("end", () => resolve(Buffer.concat(chunks)));
    response.on("error", reject);
  });
}

export async function fetchImage(rawUrl: string): Promise<ImageFile> {
  try {
    return await download(new URL(rawUrl), AbortSignal.timeout(TOTAL_TIMEOUT_MS));
  } catch (error) {
    if (error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError")) {
      throw new ToolError("Image download timed out.");
    }
    throw error;
  }
}

async function download(startUrl: URL, signal: AbortSignal): Promise<ImageFile> {
  let url = startUrl;

  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      throw new ToolError("Image URL must use http or https.");
    }

    let response: IncomingMessage;
    try {
      await assertPublicHostname(url.hostname);
      response = await get(url, signal);
    } catch (error) {
      if (error instanceof PrivateAddressError) {
        throw new ToolError("Image URL points to a private network address, which is not allowed.");
      }
      if (error instanceof ToolError || signal.aborted) throw error;
      throw new ToolError(`Could not download image: ${error instanceof Error ? error.message : String(error)}`);
    }

    const status = response.statusCode ?? 0;
    if (status >= 300 && status < 400 && response.headers.location) {
      response.resume();
      url = new URL(response.headers.location, url);
      continue;
    }
    if (status < 200 || status >= 300) {
      response.resume();
      throw new ToolError(`Could not download image (HTTP ${status}).`);
    }

    const mimeType = (response.headers["content-type"] ?? "").split(";")[0]?.trim() ?? "";
    try {
      assertImage(mimeType, Number(response.headers["content-length"] ?? 0));
    } catch (error) {
      response.destroy();
      throw error;
    }

    const buffer = await readCapped(response);
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

export async function loadImage(input: {
  imageUrl?: string | undefined;
  imageBase64?: string | undefined;
  mimeType?: string | undefined;
}): Promise<ImageFile> {
  if (input.imageUrl) return fetchImage(input.imageUrl);
  if (input.imageBase64) return decodeImage(input.imageBase64, input.mimeType ?? "image/jpeg");
  throw new ToolError("Provide either imageUrl or imageBase64.");
}
