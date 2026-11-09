/**
 * Builds per-book JSON files for every translation in data-source/texts/<id>/.
 *
 * Output: public/data/texts/<CODE>/meta.json and public/data/texts/<CODE>/<book>.json
 * Book files: { "chapters": string[][], "notes": { "c:v": VerseNote } }
 * An empty string means "no text for this verse in this edition"; the reason is in notes.
 * No text is ever generated or paraphrased: every string comes verbatim from the source file.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { BOOKS, CHAPTERS, VERSIFICATION_ADDITIONS } from '../src/data/bibleStructure.ts';
import { BOOK_META } from '../src/data/books.ts';
import type { TranslationMeta, VerseNote } from '../src/data/textTypes.ts';
import { readVpl } from './lib/vpl.ts';
import { OUT_DIR, isMain, resetDir, writeJson } from './lib/io.ts';

const TEXTS_DIR = 'data-source/texts';

interface Alignment {
  mappings: { kjv: string; text: string[]; shared: boolean }[];
}

export interface TextBuildReport {
  code: string;
  verses: number;
  withText: number;
  remapped: number;
  shared: number;
  empty: string[];
  unusedSourceVerses: number;
}

const vplToBook = new Map(BOOK_META.map((m, i) => [m.vpl, i]));

function humanRef(vplKey: string): string {
  const [code, cv] = vplKey.split(' ');
  return `${BOOKS[vplToBook.get(code)!].code} ${cv}`;
}

export function buildTranslation(id: string): TextBuildReport {
  const dir = `${TEXTS_DIR}/${id}`;
  const cfg = JSON.parse(readFileSync(`${dir}/translation.json`, 'utf8'));
  const source = new Map<string, string>();
  for (const v of readVpl(`${dir}/${cfg.file}`)) source.set(`${v.book} ${v.chapter}:${v.verse}`, v.text);
  const alignment: Alignment = existsSync(`${dir}/alignment.json`)
    ? JSON.parse(readFileSync(`${dir}/alignment.json`, 'utf8'))
    : { mappings: [] };
  const manual: Alignment = existsSync(`${dir}/alignment-manual.json`)
    ? JSON.parse(readFileSync(`${dir}/alignment-manual.json`, 'utf8'))
    : { mappings: [] };
  const remap = new Map([...alignment.mappings, ...manual.mappings].map((m) => [m.kjv, m]));
  alignment.mappings = [...remap.values()];
  // Which KJV verses share each source verse (for "covers" notes).
  const sharedBy = new Map<string, string[]>();
  for (const m of alignment.mappings) if (m.shared) for (const t of m.text) sharedBy.set(t, [...(sharedBy.get(t) ?? []), m.kjv]);

  const used = new Set<string>();
  const report: TextBuildReport = { code: cfg.code, verses: 0, withText: 0, remapped: 0, shared: 0, empty: [], unusedSourceVerses: 0 };
  const outDir = `${OUT_DIR}/texts/${cfg.code}`;
  resetDir(outDir);

  for (const book of BOOKS) {
    const meta = BOOK_META[book.id];
    const chapters: string[][] = [];
    const notes: Record<string, VerseNote> = {};
    for (let c = 1; c <= book.chapterCount; c++) {
      const ch = CHAPTERS[book.firstChapter + c - 1];
      const verses: string[] = [];
      for (let v = 1; v <= ch.verseCount; v++) {
        report.verses++;
        const k = `${meta.vpl} ${c}:${v}`;
        const addition = VERSIFICATION_ADDITIONS.find((a) => a.osis === book.code && a.chapter === c && a.verse === v);
        let text = '';
        if (addition) {
          // Position that exists only in the dataset's versification (3 John 1:15).
          const target = `${meta.vpl} ${addition.mapsTo.chapter}:${addition.mapsTo.verse}`;
          text = source.get(target) ?? '';
          notes[`${c}:${v}`] = { kind: 'versification', from: humanRef(target), detail: addition.note };
        } else if (remap.has(k)) {
          const m = remap.get(k)!;
          text = m.text.map((t) => source.get(t) ?? '').filter(Boolean).join(' ');
          m.text.forEach((t) => used.add(t));
          if (m.shared) {
            const covers = m.text.flatMap((t) => sharedBy.get(t) ?? []);
            notes[`${c}:${v}`] = { kind: 'shared', from: m.text.map(humanRef).join(' + '), covers: [humanRef(covers[0]), humanRef(covers[covers.length - 1])] };
            report.shared++;
          } else {
            notes[`${c}:${v}`] = { kind: 'remapped', from: m.text.map(humanRef).join(' + ') };
            report.remapped++;
          }
        } else {
          text = source.get(k) ?? '';
          used.add(k);
        }
        if (text) report.withText++;
        else {
          report.empty.push(`${book.code}.${c}.${v}`);
          if (!notes[`${c}:${v}`]) notes[`${c}:${v}`] = { kind: 'empty' };
        }
        verses.push(text);
      }
      chapters.push(verses);
    }
    writeJson(`${outDir}/${book.code}.json`, { chapters, notes });
  }
  for (const [k, text] of source) if (vplToBook.has(k.split(' ')[0]) && text && !used.has(k)) report.unusedSourceVerses++;

  const metaOut: TranslationMeta = {
    code: cfg.code,
    name: cfg.name,
    language: cfg.language,
    license: cfg.license,
    licenseNote: cfg.licenseNote,
    source: cfg.source,
    sourceUrl: cfg.sourceUrl,
    versification: cfg.versification,
    bracketsMeaning: cfg.bracketsMeaning,
    stats: { verses: report.verses, withText: report.withText, remapped: report.remapped, shared: report.shared, empty: report.empty.length },
  };
  writeJson(`${outDir}/meta.json`, metaOut, true);
  return report;
}

export function buildAllTranslations(): TextBuildReport[] {
  return readdirSync(TEXTS_DIR)
    .filter((d) => existsSync(`${TEXTS_DIR}/${d}/translation.json`))
    .sort()
    .map(buildTranslation);
}

if (isMain(import.meta.url)) {
  for (const r of buildAllTranslations()) {
    console.log(`${r.code}: ${r.withText}/${r.verses} verses with text, ${r.remapped} remapped, ${r.shared} shared, ${r.empty.length} empty, ${r.unusedSourceVerses} unused source verses`);
    if (r.empty.length) console.log(`  empty: ${r.empty.join(', ')}`);
  }
}
