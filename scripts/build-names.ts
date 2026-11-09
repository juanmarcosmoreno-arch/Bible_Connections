/** Builds public/data/names/names.json from data-source/names/tipnr-derived.json. */
import { readFileSync } from 'node:fs';
import { parseOsisVerse } from '../src/data/bibleStructure.ts';
import type { NamesFile } from '../src/data/namesTypes.ts';
import { OUT_DIR, isMain, writeJson } from './lib/io.ts';

export function buildNames(): NamesFile {
  const doc = JSON.parse(readFileSync('data-source/names/tipnr-derived.json', 'utf8'));
  const entries = (doc.entries as [string, string, string, string][]).map(([unique, type, brief, refs]) => {
    const verses = refs.split(';').map(parseOsisVerse).filter((g) => g >= 0);
    return [unique.split('@')[0], unique.split('@')[1] ?? '', type, brief, verses] as NamesFile['entries'][number];
  });
  const file: NamesFile = { source: doc.source, license: doc.license, url: doc.url, entries };
  writeJson(`${OUT_DIR}/names/names.json`, file);
  return file;
}

if (isMain(import.meta.url)) {
  const f = buildNames();
  console.log(`names: ${f.entries.length}`);
}
