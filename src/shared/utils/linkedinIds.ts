import { ToolError } from "./errors.ts";

const PUBLIC_ID = /^[\p{L}\p{N}\-_%.]{2,100}$/u;
const THREAD_ID = /^[A-Za-z0-9\-_=%.]{4,200}$/;

function fromPath(input: string, segment: string): string | undefined {
  const match = input.match(new RegExp(`linkedin\\.com/${segment}/([^/?#]+)`, "i"));
  return match?.[1] ? decodeURIComponent(match[1]) : undefined;
}

function assertId(value: string | undefined, label: string): string {
  if (!value || !PUBLIC_ID.test(value)) {
    throw new ToolError(`Invalid ${label}: ${value ?? "(empty)"}`);
  }
  return value;
}

export function profileId(input: string): string {
  const trimmed = input.trim();
  return assertId(fromPath(trimmed, "in") ?? trimmed.replace(/^@/, ""), "profile id or URL");
}

export function companySlug(input: string): string {
  const trimmed = input.trim();
  return assertId(fromPath(trimmed, "company") ?? fromPath(trimmed, "school") ?? trimmed, "company id or URL");
}

export function jobId(input: string): string {
  const trimmed = input.trim();
  const match = trimmed.match(/(?:jobs\/view\/|currentJobId=)(\d+)/) ?? trimmed.match(/^(\d{6,})$/);
  if (!match?.[1]) throw new ToolError(`Invalid job id or URL: ${trimmed}`);
  return match[1];
}

export function threadId(input: string): string {
  const trimmed = input.trim();
  const match = trimmed.match(/messaging\/thread\/([^/?#]+)/);
  const id = match?.[1] ? decodeURIComponent(match[1]) : trimmed;
  if (!THREAD_ID.test(id)) throw new ToolError(`Invalid conversation id or URL: ${trimmed}`);
  return id;
}
