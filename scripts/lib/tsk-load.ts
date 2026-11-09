/** Loads the TSK SWORD module from data-source/tsk/TSK.zip into per-verse reference spans. */
import { existsSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { parseTskEntry, swordVerseKeys, type Span, type TskParseStats } from '../../src/data/tsk.ts';
import { verseIndex } from '../../src/data/bibleStructure.ts';
import { readZCom } from './sword.ts';

export const TSK_ZIP = 'data-source/tsk/TSK.zip';

export function loadTsk(): { byVerse: Map<number, Span[]>; stats: TskParseStats & { entries: number; spans: number } } {
  const dir = 'data-source/.cache/tsk';
  if (!existsSync(`${dir}/modules/comments/zcom/tsk/ot.bzz`)) {
    mkdirSync(dir, { recursive: true });
    execFileSync('unzip', ['-o', '-q', `${process.cwd()}/${TSK_ZIP}`], { cwd: dir });
  }
  const mod = `${dir}/modules/comments/zcom/tsk`;
  const byVerse = new Map<number, Span[]>();
  const stats = { parts: 0, unparsed: 0, entries: 0, spans: 0 };
  for (const t of ['OT', 'NT'] as const) {
    const read = readZCom(mod, t === 'OT' ? 'ot' : 'nt');
    for (const k of swordVerseKeys(t)) {
      const html = read(k.index);
      if (!html) continue;
      const spans = parseTskEntry(html, k.book, k.chapter, stats);
      if (!spans.length) continue;
      stats.entries++;
      stats.spans += spans.length;
      byVerse.set(verseIndex(k.book, k.chapter, k.verse), spans);
    }
  }
  return { byVerse, stats };
}
