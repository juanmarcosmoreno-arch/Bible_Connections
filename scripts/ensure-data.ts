/** Rebuilds public/data only when an input changed (used by predev / prebuild). */
import { existsSync, readFileSync } from 'node:fs';
import { buildData, inputsHash } from './build-data.ts';

const path = 'public/data/manifest.json';
const current = existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')).inputsHash : null;
if (current === inputsHash()) console.log('Data is up to date.');
else buildData();
