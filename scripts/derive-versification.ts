/**
 * Derives the chapter/verse table used to position verses on the global axis.
 *
 * Source: King James Version (1769 standard text), eBible.org edition "eng-kjv2006",
 * VPL export. The table is cross-checked against the Reina-Valera 1909 VPL file that
 * ships in data-source/texts (an independent edition that uses the same versification).
 *
 * Usage:  node scripts/derive-versification.ts [path/to/eng-kjv2006_vpl.txt]
 * Without a path the KJV archive is downloaded into data-source/.cache/.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { BOOK_META } from '../src/data/books.ts';
import { readVpl, type VplVerse } from './lib/vpl.ts';

const KJV_URL = 'https://ebible.org/Scriptures/eng-kjv2006_vpl.zip';
const OUT = 'src/data/versification.json';

function countTable(verses: VplVerse[]): Map<string, number[]> {
  const table = new Map<string, number[]>();
  for (const v of verses) {
    const counts = table.get(v.book) ?? [];
    counts[v.chapter - 1] = Math.max(counts[v.chapter - 1] ?? 0, v.verse);
    table.set(v.book, counts);
  }
  return table;
}

async function main() {
  let kjvPath = process.argv[2];
  if (!kjvPath) {
    const dir = 'data-source/.cache/eng-kjv2006';
    kjvPath = `${dir}/eng-kjv2006_vpl.txt`;
    if (!existsSync(kjvPath)) {
      mkdirSync(dir, { recursive: true });
      const res = await fetch(KJV_URL);
      if (!res.ok) throw new Error(`Download failed: ${res.status}`);
      writeFileSync(`${dir}/vpl.zip`, Buffer.from(await res.arrayBuffer()));
      execFileSync('unzip', ['-o', '-q', 'vpl.zip', 'eng-kjv2006_vpl.txt'], { cwd: dir });
    }
  }
  const sha256 = createHash('sha256').update(readFileSync(kjvPath)).digest('hex');
  const kjv = countTable(readVpl(kjvPath));
  const rv = countTable(readVpl('data-source/texts/spaRV1909/spaRV1909_vpl.txt'));

  let chapters = 0;
  let verses = 0;
  const books = BOOK_META.map((meta) => {
    const counts = kjv.get(meta.vpl);
    if (!counts) throw new Error(`Book ${meta.vpl} missing from KJV source`);
    const rvCounts = rv.get(meta.vpl);
    if (JSON.stringify(rvCounts) !== JSON.stringify(counts)) {
      throw new Error(`KJV and RV1909 disagree on ${meta.osis}`);
    }
    chapters += counts.length;
    verses += counts.reduce((a, c) => a + c, 0);
    return { osis: meta.osis, verses: counts };
  });
  if (books.length !== 66 || chapters !== 1189 || verses !== 31102) {
    throw new Error(`Unexpected totals: ${books.length} books, ${chapters} chapters, ${verses} verses`);
  }

  const doc = {
    id: 'kjv-openbible',
    name: 'KJV versification + OpenBible extension',
    description:
      'Chapter/verse counts of the King James Version (66 books, 1,189 chapters, 31,102 verses), ' +
      'cross-checked against the Reina-Valera 1909. One additional position (3 John 1:15) is appended ' +
      'because the OpenBible.info dataset follows ESV-style numbering there; in KJV/RV1909 its text belongs to 3 John 1:14.',
    source: {
      edition: 'King James Version (1769), eBible.org eng-kjv2006, VPL export',
      url: KJV_URL,
      file: 'eng-kjv2006_vpl.txt',
      sha256,
      crossCheckedWith: 'data-source/texts/spaRV1909/spaRV1909_vpl.txt (Reina-Valera 1909, eBible.org)',
    },
    totals: { books: books.length, chapters, verses },
    additions: [
      {
        osis: '3John',
        chapter: 1,
        verse: 15,
        mapsTo: { osis: '3John', chapter: 1, verse: 14 },
        note: 'ESV/NA28 split 3 John 1:14 into 1:14-15. Referenced by 5 OpenBible records.',
      },
    ],
    books,
  };
  const { books: bookRows, ...head } = doc;
  const body = JSON.stringify(head, null, 2).replace(/\n}$/, '');
  const rows = bookRows.map((r) => `    ${JSON.stringify(r)}`).join(',\n');
  writeFileSync(OUT, `${body},\n  "books": [\n${rows}\n  ]\n}\n`);
  console.log(`Wrote ${OUT}: ${books.length} books, ${chapters} chapters, ${verses} verses (+${doc.additions.length} addition).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
