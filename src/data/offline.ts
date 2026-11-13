/**
 * Offline (single-file) build support. `npm run build:offline` produces one HTML file that
 * embeds every data file (gzip + base64) in `window.__BC_DATA__`, so the app works when the
 * file is opened directly from disk (file://), where fetch() and module workers are blocked.
 */
export const OFFLINE = import.meta.env.MODE === 'offline';

declare global {
  interface Window {
    __BC_DATA__?: Record<string, string>;
  }
}

export function embedded(path: string): string | undefined {
  return typeof window !== 'undefined' ? window.__BC_DATA__?.[path] : undefined;
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Decodes an embedded gzip+base64 file. */
export async function embeddedBytes(path: string): Promise<ArrayBuffer | null> {
  const b64 = embedded(path);
  if (b64 === undefined) return null;
  const gz = base64ToBytes(b64);
  const stream = new Blob([gz as BlobPart]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Response(stream).arrayBuffer();
}

/** Runs a heavy computation without blocking the first paint (offline build has no workers). */
export function later<T>(fn: () => T): Promise<T> {
  return new Promise((resolve, reject) =>
    setTimeout(() => {
      try {
        resolve(fn());
      } catch (e) {
        reject(e);
      }
    }, 30),
  );
}
