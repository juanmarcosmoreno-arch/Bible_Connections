/**
 * Static-data loader. Every file lives under `${BASE_URL}data/` (works on GitHub Pages
 * sub-paths). Results are memoised for the session.
 */
import type { Statistics } from '../analysis/statistics.ts';
import type { NetworkFile } from '../graph/networkTypes.ts';
import { decodeReferences, type DataManifest, type ReferenceColumns } from './format.ts';
import { fetchReferenceBinary } from './fetchBinary.ts';

export type Manifest = DataManifest & { inputsHash?: string };

export const DATA_BASE = `${import.meta.env.BASE_URL}data/`;

const memo = new Map<string, Promise<unknown>>();

export function loadJSON<T>(path: string): Promise<T> {
  if (!memo.has(path)) {
    const p = fetch(DATA_BASE + path).then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status} for ${path}`);
      return r.json() as Promise<T>;
    });
    p.catch(() => memo.delete(path));
    memo.set(path, p);
  }
  return memo.get(path) as Promise<T>;
}

export const loadManifest = () => loadJSON<Manifest>('manifest.json');
export const loadStatistics = () => loadJSON<Statistics>('statistics/statistics.json');
export const loadNetwork = (level: 'book' | 'chapter') =>
  loadJSON<NetworkFile>(level === 'book' ? 'statistics/network-books.json' : 'statistics/network-chapters.json');

let refsPromise: Promise<ReferenceColumns> | null = null;

/** Loads the full reference table (decoded in a Web Worker when available). */
export function loadReferences(onProgress?: (f: number) => void): Promise<ReferenceColumns> {
  if (refsPromise) return refsPromise;
  refsPromise = loadManifest().then(async (m) => {
    const req = {
      gzUrl: DATA_BASE + m.references.gzFile,
      rawUrl: DATA_BASE + m.references.file,
      count: m.references.count,
      sizes: { gz: m.references.gzBytes, raw: m.references.bytes },
    };
    if (typeof Worker !== 'undefined') {
      try {
        return await new Promise<ReferenceColumns>((resolve, reject) => {
          const w = new Worker(new URL('../workers/data.worker.ts', import.meta.url), { type: 'module' });
          w.onmessage = (e) => {
            if (e.data.type === 'progress') onProgress?.(e.data.fraction);
            else if (e.data.type === 'done') {
              resolve(e.data.cols);
              w.terminate();
            } else {
              reject(new Error(e.data.message));
              w.terminate();
            }
          };
          w.onerror = (e) => {
            reject(new Error(e.message || 'worker error'));
            w.terminate();
          };
          w.postMessage(req);
        });
      } catch (err) {
        console.warn('Data worker failed, decoding on the main thread', err);
      }
    }
    const buf = await fetchReferenceBinary(req.gzUrl, req.rawUrl, req.sizes, onProgress);
    return decodeReferences(buf, req.count);
  });
  refsPromise.catch(() => (refsPromise = null));
  return refsPromise;
}
