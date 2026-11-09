/**
 * Minimal reader for eBible.org "VPL" plain-text Bibles (one verse per line):
 *   GEN 1:1 In the beginning God created the heaven and the earth.
 */
import { readFileSync } from 'node:fs';

export interface VplVerse {
  book: string;
  chapter: number;
  verse: number;
  text: string;
}

export function readVpl(path: string): VplVerse[] {
  const raw = readFileSync(path, 'utf8').replace(/^﻿/, '');
  const out: VplVerse[] = [];
  for (const line of raw.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const m = /^(\S+) (\d+):(\d+)(?: (.*))?$/.exec(line);
    if (!m) throw new Error(`Unrecognised VPL line: ${line.slice(0, 80)}`);
    out.push({ book: m[1], chapter: Number(m[2]), verse: Number(m[3]), text: (m[4] ?? '').trim() });
  }
  return out;
}
