/**
 * Full data build: import cross references, build translation texts, compute statistics
 * and network metrics, and write public/data/manifest.json.
 *
 *   npm run data
 */
import { readFileSync, readdirSync } from 'node:fs';
import { BOOKS, CHAPTERS, TOTAL_VERSES } from '../src/data/bibleStructure.ts';
import { FORMAT_VERSION, decodeReferences, type DataManifest } from '../src/data/format.ts';
import { buildAllTranslations } from './build-texts.ts';
import { buildNames } from './build-names.ts';
import { generateStatistics } from './generate-statistics.ts';
import { importCrossReferences, writeImport } from './import-crossrefs.ts';
import { OUT_DIR, isMain, sha256, toArrayBuffer, writeJson } from './lib/io.ts';

/** Bump when the output format or build logic changes, to force a rebuild. */
export const BUILD_VERSION = 5;

/** Hash of every input that affects the generated data. */
export function inputsHash(): string {
  const files = [
    'data-source/cross_references.txt',
    'src/data/versification.json',
    'src/data/books.ts',
    'src/data/tsk.ts',
    'data-source/tsk/TSK.zip',
    'data-source/names/tipnr-derived.json',
    ...readdirSync('data-source/texts').flatMap((d) =>
      readdirSync(`data-source/texts/${d}`).map((f) => `data-source/texts/${d}/${f}`),
    ),
  ].sort();
  return sha256(`${BUILD_VERSION}\n${files.map((f) => `${f}:${sha256(readFileSync(f))}`).join('\n')}`);
}

export function buildData(): DataManifest {
  const t0 = performance.now();
  const imp = importCrossReferences();
  writeImport(imp);
  console.log(`• references: ${imp.report.imported}/${imp.report.dataLines} imported, ${imp.report.invalid.count} invalid, ${imp.report.duplicates.count} duplicates (${(imp.gzBytes / 1024).toFixed(0)} KiB gzip)`);
  const pv = imp.report.provenance;
  console.log(`• provenance: TSK ${pv.tsk}, TSK reverse ${pv.tskReverse}, OpenBible only ${pv.openbible}`);

  const texts = buildAllTranslations();
  for (const r of texts) console.log(`• text ${r.code}: ${r.withText}/${r.verses} verses with text, ${r.remapped} remapped, ${r.shared} shared`);

  const names = buildNames();
  console.log(`• people & places: ${names.entries.length} (STEPBible TIPNR)`);

  const cols = decodeReferences(toArrayBuffer(imp.buffer), imp.records.length);
  const { stats, books, chapters } = generateStatistics(cols);
  console.log(`• statistics: ${stats.totals.references} references; book network modularity ${books.graph.modularity}, chapter network ${chapters.graph.communities} communities`);

  writeJson(`${OUT_DIR}/books.json`, BOOKS, true);
  writeJson(`${OUT_DIR}/chapters.json`, CHAPTERS);

  const translations = texts.map((r) => {
    const meta = JSON.parse(readFileSync(`${OUT_DIR}/texts/${r.code}/meta.json`, 'utf8'));
    return { code: meta.code, name: meta.name, language: meta.language, path: `texts/${meta.code}` };
  });
  const manifest: DataManifest & { inputsHash: string } = {
    formatVersion: FORMAT_VERSION,
    generatedAt: new Date().toISOString(),
    inputsHash: inputsHash(),
    source: {
      file: 'cross_references.txt',
      sha256: imp.sourceSha256,
      license: 'CC BY 4.0',
      attribution: 'Cross-reference data from OpenBible.info (https://www.openbible.info/labs/cross-references/), licensed CC BY 4.0.',
      url: 'https://www.openbible.info/labs/cross-references/',
      header: imp.header,
    },
    references: {
      count: imp.records.length,
      file: imp.binFile,
      gzFile: imp.gzFile,
      bytes: imp.bytes,
      gzBytes: imp.gzBytes,
      sort: 'votes desc, source asc, target start asc, target end asc',
    },
    versification: 'kjv-openbible',
    totals: { books: BOOKS.length, chapters: CHAPTERS.length, verses: TOTAL_VERSES },
    translations,
    statistics: 'statistics/statistics.json',
    importReport: 'import-report.json',
  };
  writeJson(`${OUT_DIR}/manifest.json`, manifest, true);
  console.log(`Data build finished in ${((performance.now() - t0) / 1000).toFixed(1)} s`);
  return manifest;
}

if (isMain(import.meta.url)) buildData();
