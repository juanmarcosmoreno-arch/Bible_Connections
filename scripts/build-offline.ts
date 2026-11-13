/**
 * Builds dist-offline/bible-connections.html: the whole app in ONE file that works without a
 * connection (open it with a double click). JavaScript, CSS, fonts, icon and every data file
 * (references, both Bible texts, statistics, networks, people & places) are embedded; data is
 * gzip-compressed and base64-encoded, and decompressed in the browser.
 *
 *   npm run build:offline        (copy to dist/ with --into-dist, as the Pages workflow does)
 */
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { gzipSync } from 'node:zlib';

const OUT = 'dist-offline/bible-connections.html';

execFileSync(process.execPath, ['scripts/ensure-data.ts'], { stdio: 'inherit' });
execFileSync(process.execPath, ['node_modules/vite/bin/vite.js', 'build', '--mode', 'offline', '--logLevel', 'warn'], { stdio: 'inherit' });

// 1. Data files used by the app (books.json/chapters.json and the raw .bin are not needed).
const data: Record<string, string> = {};
const walk = (dir: string) => {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p);
    else {
      const rel = relative('public/data', p).split('\\').join('/');
      if (rel.endsWith('.bin') || rel === 'books.json' || rel === 'chapters.json') continue;
      const bytes = readFileSync(p);
      data[rel] = (rel.endsWith('.gzbin') ? bytes : gzipSync(bytes, { level: 9 })).toString('base64');
    }
  }
};
walk('public/data');

// 2. Inline the bundle into the HTML.
let html = readFileSync('dist-offline/index.html', 'utf8');
const asset = (href: string) => readFileSync(join('dist-offline', href.replace(/^\.\//, '')), 'utf8');
const safe = (js: string) => js.replace(/<\/script/gi, '<\\/script');
html = html.replace(/<link rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/g, (_, href) => `<style>${asset(href)}</style>`);
html = html.replace(/<link rel="modulepreload"[^>]*>/g, '');
const dataScript = `<script>window.__BC_DATA__=${JSON.stringify(data)};</script>`;
html = html.replace(/<script type="module"[^>]*src="([^"]+)"[^>]*><\/script>/, (_, src) => `${dataScript}\n<script type="module">${safe(asset(src))}</script>`);
const favicon = `data:image/svg+xml;base64,${readFileSync('public/icons/favicon.svg').toString('base64')}`;
html = html.replace(/href="\.\/icons\/favicon\.svg"/, `href="${favicon}"`).replace(/<link rel="apple-touch-icon"[^>]*>/, '');
html = html.replace('<title>Bible Connections</title>', '<title>Bible Connections (offline)</title>');
if (/src="\.\/assets\/|href="\.\/assets\//.test(html)) throw new Error('An asset was not inlined');
writeFileSync(OUT, html);
console.log(`Wrote ${OUT}: ${(Buffer.byteLength(html) / 1e6).toFixed(1)} MB (${Object.keys(data).length} data files embedded)`);

if (process.argv.includes('--into-dist')) {
  if (!existsSync('dist')) throw new Error('dist/ not found: run npm run build first');
  copyFileSync(OUT, 'dist/bible-connections.html');
  console.log('Copied to dist/bible-connections.html');
}
