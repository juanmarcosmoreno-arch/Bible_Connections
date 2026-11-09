/**
 * Fetches the reference binary: prefers the gzip file (decompressed with the native
 * DecompressionStream), falls back to the raw file. Uses Cache Storage keyed by the
 * content-hashed file name, so a cached copy is valid forever.
 */
const CACHE_NAME = 'bible-connections-data-v1';

async function cachedFetch(url: string): Promise<Response> {
  let cache: Cache | null = null;
  try {
    cache = typeof caches !== 'undefined' ? await caches.open(CACHE_NAME) : null;
    const hit = cache ? await cache.match(url) : undefined;
    if (hit) return hit;
  } catch {
    cache = null;
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  if (cache) {
    try {
      await cache.put(url, res.clone());
    } catch {
      /* quota or private mode: ignore */
    }
  }
  return res;
}

async function readWithProgress(res: Response, total: number, onProgress?: (f: number) => void): Promise<Uint8Array> {
  if (!res.body) return new Uint8Array(await res.arrayBuffer());
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.byteLength;
    onProgress?.(Math.min(1, received / total));
  }
  const out = new Uint8Array(received);
  let off = 0;
  for (const c of chunks) {
    out.set(c, off);
    off += c.byteLength;
  }
  return out;
}

export async function fetchReferenceBinary(
  gzUrl: string,
  rawUrl: string,
  sizes: { gz: number; raw: number },
  onProgress?: (fraction: number) => void,
): Promise<ArrayBuffer> {
  if (typeof DecompressionStream !== 'undefined') {
    try {
      const res = await cachedFetch(gzUrl);
      const gz = await readWithProgress(res, sizes.gz, onProgress);
      // If a server already decoded the gzip stream (Content-Encoding), use the bytes as they are.
      if (gz.byteLength === sizes.raw || gz[0] !== 0x1f || gz[1] !== 0x8b) {
        if (gz.byteLength === sizes.raw) return gz.buffer.slice(gz.byteOffset, gz.byteOffset + gz.byteLength) as ArrayBuffer;
        throw new Error('unexpected compressed payload');
      }
      const stream = new Blob([gz as BlobPart]).stream().pipeThrough(new DecompressionStream('gzip'));
      return await new Response(stream).arrayBuffer();
    } catch (err) {
      console.warn('gzip path failed, falling back to raw binary', err);
    }
  }
  const res = await cachedFetch(rawUrl);
  const raw = await readWithProgress(res, sizes.raw, onProgress);
  return raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength) as ArrayBuffer;
}
