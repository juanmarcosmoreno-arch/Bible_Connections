import { createHash } from 'node:crypto';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { gzipSync } from 'node:zlib';

export const OUT_DIR = 'public/data';

export function sha256(data: string | Uint8Array): string {
  return createHash('sha256').update(data).digest('hex');
}

export function writeJson(path: string, data: unknown, pretty = false): number {
  mkdirSync(dirname(path), { recursive: true });
  const text = pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data);
  writeFileSync(path, text + '\n');
  return Buffer.byteLength(text);
}

export function writeBinary(path: string, data: Uint8Array): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, data);
}

export function gzip(data: Uint8Array): Uint8Array {
  return gzipSync(data, { level: 9 });
}

export function resetDir(path: string): void {
  rmSync(path, { recursive: true, force: true });
  mkdirSync(path, { recursive: true });
}

export function isMain(metaUrl: string): boolean {
  const entry = process.argv[1];
  return !!entry && metaUrl === new URL(`file://${entry.startsWith('/') ? '' : process.cwd() + '/'}${entry}`).href;
}

/** Copies a byte view into a standalone ArrayBuffer. */
export function toArrayBuffer(u8: Uint8Array): ArrayBuffer {
  const out = new ArrayBuffer(u8.byteLength);
  new Uint8Array(out).set(u8);
  return out;
}
