/** Reader for compressed SWORD commentary modules (zCom: .bzs/.bzv/.bzz, zlib blocks). */
import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';

export function readZCom(dir: string, testament: 'ot' | 'nt'): (index: number) => string {
  const bzs = readFileSync(`${dir}/${testament}.bzs`);
  const bzv = readFileSync(`${dir}/${testament}.bzv`);
  const bzz = readFileSync(`${dir}/${testament}.bzz`);
  const cache = new Map<number, Buffer>();
  return (i: number) => {
    if ((i + 1) * 10 > bzv.length) return '';
    const block = bzv.readUInt32LE(i * 10);
    const off = bzv.readUInt32LE(i * 10 + 4);
    const size = bzv.readUInt16LE(i * 10 + 8);
    if (!size) return '';
    let data = cache.get(block);
    if (!data) {
      const o = bzs.readUInt32LE(block * 12), s = bzs.readUInt32LE(block * 12 + 4);
      data = inflateSync(bzz.subarray(o, o + s));
      cache.set(block, data);
    }
    return data.subarray(off, off + size).toString('utf8');
  };
}
