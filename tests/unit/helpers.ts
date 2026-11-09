import { readFileSync } from 'node:fs';
import { decodeReferences, type DataManifest, type ReferenceColumns } from '../../src/data/format.ts';

let cache: ReferenceColumns | null = null;

/** Decoded reference table from the generated public/data binary (full dataset). */
export function loadColumns(): ReferenceColumns {
  if (cache) return cache;
  const manifest: DataManifest = JSON.parse(readFileSync('public/data/manifest.json', 'utf8'));
  const raw = readFileSync(`public/data/${manifest.references.file}`);
  cache = decodeReferences(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength) as ArrayBuffer, manifest.references.count);
  return cache;
}

export function sourceLines(): string[] {
  return readFileSync('data-source/cross_references.txt', 'utf8').split('\n').slice(1).filter((l) => l.trim());
}
