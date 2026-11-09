import { execFileSync } from 'node:child_process';

/** Makes sure public/data exists and is current before the tests read it. */
export default function setup() {
  execFileSync(process.execPath, ['scripts/ensure-data.ts'], { stdio: 'inherit' });
}
