/**
 * Aligns a Strong's-tagged translation to KJV verse numbering.
 *
 * Some editions (e.g. eBible.org's Reina-Valera 1909) keep their native chapter breaks
 * (Hebrew-style at Num 12/13, Job 38/39, Jonah 1/2 …) but are padded to KJV verse counts,
 * which shifts the text of whole chapters by one or more verses. Matching verses by number
 * would show the wrong text next to a reference.
 *
 * This script aligns both texts book by book with a banded dynamic-programming alignment
 * (steps 1:1, 2:1, 1:2, and skipping empty verses), scoring verse pairs by the IDF-weighted
 * overlap of their Strong's numbers. Only non-identity mappings are written.
 *
 *   node scripts/align-translation.ts spaRV1909
 *
 * Sources are downloaded to data-source/.cache/. Output: data-source/texts/<id>/alignment.json
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { BOOK_META } from '../src/data/books.ts';
import { readUsfmStrongs, type UsfmVerse } from './lib/usfm.ts';

const id = process.argv[2] ?? 'spaRV1909';
const CACHE = 'data-source/.cache';

async function fetchUsfm(ebibleId: string): Promise<string> {
  const dir = `${CACHE}/${ebibleId}_usfm`;
  if (!existsSync(`${dir}/usfm.zip`)) {
    mkdirSync(dir, { recursive: true });
    const url = `https://ebible.org/Scriptures/${ebibleId}_usfm.zip`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Download failed ${url}: ${res.status}`);
    writeFileSync(`${dir}/usfm.zip`, Buffer.from(await res.arrayBuffer()));
    execFileSync('unzip', ['-o', '-q', 'usfm.zip'], { cwd: dir });
  }
  return dir;
}

// USFM book ids differ slightly from the VPL codes used in books.ts.
const USFM_TO_VPL: Record<string, string> = { EZK: 'EZE', JOL: 'JOE', NAM: 'NAH', SNG: 'SOL', MRK: 'MAR', JHN: 'JOH', PHP: 'PHI', JAS: 'JAM', '1JN': '1JO', '2JN': '2JO', '3JN': '3JO', JUD: 'JUD' };

/** A DP step: `k` KJV verses aligned to `t` translation verses (0 = skip). */
type Step = { k: number; t: number };
const MAX_K = 10; // a translation verse may hold up to 10 KJV verses (e.g. RV1909 Job 39:30)
const MAX_T = 3;
const MERGE_PENALTY = 1.0;

interface Mapping {
  kjv: string; // "NUM 13:1"
  text: string[]; // translation verses (file numbering) providing the text
  shared: boolean; // translation verse also covers neighbouring KJV verses
  score: number;
}

function key(v: UsfmVerse): string {
  return `${USFM_TO_VPL[v.book] ?? v.book} ${v.chapter}:${v.verse}`;
}

async function main() {
  const kjvDir = await fetchUsfm('eng-kjv2006');
  const trDir = await fetchUsfm(id);
  const kjv = readUsfmStrongs(kjvDir);
  const tr = readUsfmStrongs(trDir);

  const df = new Map<string, number>();
  for (const v of [...kjv, ...tr]) for (const s of new Set(v.strongs)) df.set(s, (df.get(s) ?? 0) + 1);
  const N = kjv.length + tr.length;
  const w = (s: string) => Math.log(N / (df.get(s) ?? 1));

  const sim = (a: string[], b: string[]): number => {
    if (!a.length || !b.length) return 0;
    const A = new Set(a), B = new Set(b);
    let inter = 0, uni = 0;
    for (const s of A) { const x = w(s); uni += x; if (B.has(s)) inter += x; }
    for (const s of B) if (!A.has(s)) uni += w(s);
    return uni ? inter / uni : 0;
  };

  const mappings: Mapping[] = [];
  let identity = 0;
  const BAND = 12;

  for (const meta of BOOK_META) {
    const K = kjv.filter((v) => (USFM_TO_VPL[v.book] ?? v.book) === meta.vpl);
    const T = tr.filter((v) => (USFM_TO_VPL[v.book] ?? v.book) === meta.vpl);
    const n = K.length, m = T.length;
    const NEG = -1e9;
    const score = Array.from({ length: n + 1 }, () => new Float64Array(m + 1).fill(NEG));
    const back: (Step | null)[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(null));
    score[0][0] = 0;
    const cat = (arr: UsfmVerse[], a: number, b: number) => arr.slice(a, b).flatMap((v) => v.strongs);
    for (let i = 0; i <= n; i++) {
      for (let j = Math.max(0, i - BAND); j <= Math.min(m, i + BAND); j++) {
        const cur = score[i][j];
        if (cur === NEG) continue;
        const relax = (k: number, t: number, s: number) => {
          const ni = i + k, nj = j + t;
          if (ni <= n && nj <= m && Math.abs(ni - nj) <= BAND && cur + s > score[ni][nj]) {
            score[ni][nj] = cur + s;
            back[ni][nj] = { k, t };
          }
        };
        if (i < n && j < m) {
          // 1:1, with a small bias towards same-numbered verses so ties never introduce shifts.
          const same = K[i].chapter === T[j].chapter && K[i].verse === T[j].verse;
          relax(1, 1, sim(K[i].strongs, T[j].strongs) + (same ? 0.02 : 0));
          for (let k = 2; k <= MAX_K && i + k <= n; k++) relax(k, 1, sim(cat(K, i, i + k), T[j].strongs) * k - MERGE_PENALTY * (k - 1));
          for (let t = 2; t <= MAX_T && j + t <= m; t++) relax(1, t, sim(K[i].strongs, cat(T, j, j + t)) * t - MERGE_PENALTY * (t - 1));
        }
        if (j < m && T[j].strongs.length === 0) relax(0, 1, 0); // empty padding verse in the translation
        if (i < n) relax(1, 0, -MERGE_PENALTY); // KJV verse without counterpart
      }
    }
    // Trace back
    let i = n, j = m;
    const local: Mapping[] = [];
    while (i > 0 || j > 0) {
      const st = back[i][j];
      if (!st) throw new Error(`Alignment failed in ${meta.osis} at ${i},${j}`);
      const ks = K.slice(i - st.k, i);
      const ts = T.slice(j - st.t, j).filter((v) => v.strongs.length > 0 || st.t === 1);
      if (st.k === 1 && st.t === 1 && key(ks[0]) === key(ts[0])) identity++;
      else if (st.k > 0) {
        const s = ts.length ? +sim(ks.flatMap((v) => v.strongs), ts.flatMap((v) => v.strongs)).toFixed(3) : 0;
        for (let x = ks.length - 1; x >= 0; x--) {
          local.push({ kjv: key(ks[x]), text: ts.map(key), shared: st.k > 1, score: s });
        }
      }
      i -= st.k;
      j -= st.t;
    }
    mappings.push(...local.reverse());
  }

  const out = {
    translation: id,
    method:
      "Banded DP alignment against KJV (eBible.org eng-kjv2006 USFM) using IDF-weighted Strong's-number overlap; " +
      'only verses whose text does not come from the same-numbered verse are listed. Generated by scripts/align-translation.ts.',
    identityVerses: identity,
    mappings,
  };
  writeFileSync(`data-source/texts/${id}/alignment.json`, JSON.stringify(out, null, 1) + '\n');
  console.log(`${id}: ${identity} identity verses, ${mappings.length} remapped`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
