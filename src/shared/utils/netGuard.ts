import { lookup } from "node:dns";
import { lookup as lookupAsync } from "node:dns/promises";
import { BlockList, isIP, type LookupFunction } from "node:net";

const PRIVATE_V4 = [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
] as const;

const PRIVATE_V6 = [
  ["::", 128],
  ["::1", 128],
  ["64:ff9b::", 96],
  ["100::", 64],
  ["2001:db8::", 32],
  ["fc00::", 7],
  ["fe80::", 10],
  ["ff00::", 8],
] as const;

const blocked = new BlockList();
for (const [network, prefix] of PRIVATE_V4) blocked.addSubnet(network, prefix, "ipv4");
for (const [network, prefix] of PRIVATE_V6) blocked.addSubnet(network, prefix, "ipv6");

export class PrivateAddressError extends Error {
  override readonly name = "PrivateAddressError";
}

export function isPrivateAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 0) return true;
  return blocked.check(address, family === 6 ? "ipv6" : "ipv4");
}

export async function resolvePublicAddress(hostname: string): Promise<string> {
  const host = hostname.replace(/^\[|\]$/g, "");
  const addresses = isIP(host) ? [{ address: host }] : await lookupAsync(host, { all: true }).catch(() => []);
  const first = addresses[0];
  if (!first) {
    throw new PrivateAddressError(`Could not resolve ${host}`);
  }
  if (addresses.some(({ address }) => isPrivateAddress(address))) {
    throw new PrivateAddressError(`${host} resolves to a private network address`);
  }
  return first.address;
}

export async function assertPublicHostname(hostname: string): Promise<void> {
  await resolvePublicAddress(hostname);
}

export const publicOnlyLookup: LookupFunction = (hostname, options, callback) => {
  lookup(hostname, { ...options, all: true }, (error, addresses) => {
    if (error) {
      callback(error, "", 0);
      return;
    }
    const list = Array.isArray(addresses) ? addresses : [];
    const unsafe = list.find(({ address }) => isPrivateAddress(address));
    const first = list[0];
    if (unsafe || !first) {
      callback(new PrivateAddressError(`${hostname} resolves to a private network address`), "", 0);
      return;
    }
    if (options.all) {
      callback(null, list);
    } else {
      callback(null, first.address, first.family);
    }
  });
};
