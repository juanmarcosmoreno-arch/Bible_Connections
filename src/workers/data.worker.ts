/// <reference lib="webworker" />
/** Downloads, decompresses and decodes the reference table off the main thread. */
import { decodeReferences } from '../data/format.ts';
import { fetchReferenceBinary } from '../data/fetchBinary.ts';

export interface DataWorkerRequest {
  gzUrl: string;
  rawUrl: string;
  count: number;
  sizes: { gz: number; raw: number };
}

self.onmessage = async (e: MessageEvent<DataWorkerRequest>) => {
  const { gzUrl, rawUrl, count, sizes } = e.data;
  try {
    let last = 0;
    const buf = await fetchReferenceBinary(gzUrl, rawUrl, sizes, (f) => {
      if (f - last > 0.02 || f === 1) {
        last = f;
        self.postMessage({ type: 'progress', fraction: f });
      }
    });
    const cols = decodeReferences(buf, count);
    self.postMessage({ type: 'done', cols }, [
      cols.sourceStart.buffer,
      cols.sourceEnd.buffer,
      cols.targetStart.buffer,
      cols.targetEnd.buffer,
      cols.votes.buffer,
    ]);
  } catch (err) {
    self.postMessage({ type: 'error', message: err instanceof Error ? err.message : String(err) });
  }
};
