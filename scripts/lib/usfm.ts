/** Extracts per-verse Strong's numbers from eBible.org USFM files (\w word|strong="H1234"\w*). */
import { readFileSync, readdirSync } from 'node:fs';

export interface UsfmVerse {
  book: string;
  chapter: number;
  verse: number;
  strongs: string[];
}

export function readUsfmStrongs(dir: string): UsfmVerse[] {
  const out: UsfmVerse[] = [];
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.usfm')).sort()) {
    const txt = readFileSync(`${dir}/${f}`, 'utf8');
    const book = /\\id (\w+)/.exec(txt)![1];
    let chapter = 0;
    let cur: UsfmVerse | null = null;
    const re = /\\c (\d+)|\\v (\d+)|strong="([^"]+)"/g;
    for (let m = re.exec(txt); m; m = re.exec(txt)) {
      if (m[1]) chapter = Number(m[1]);
      else if (m[2]) {
        cur = { book, chapter, verse: Number(m[2]), strongs: [] };
        out.push(cur);
      } else if (m[3] && cur) {
        for (const s of m[3].split(',')) cur.strongs.push(s.replace(/^([HG])0*(\d+).*$/, '$1$2'));
      }
    }
  }
  return out;
}
