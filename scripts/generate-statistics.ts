/**
 * Generates dataset statistics and precomputed network metrics (exact betweenness) for the
 * Insights and Network views.
 */
import { computeStatistics, type Statistics } from '../src/analysis/statistics.ts';
import type { ReferenceColumns } from '../src/data/references.ts';
import { buildNetworkFile } from '../src/graph/networkFile.ts';
import type { NetworkFile } from '../src/graph/networkTypes.ts';
import { OUT_DIR, writeJson } from './lib/io.ts';

export function generateStatistics(cols: ReferenceColumns): { stats: Statistics; books: NetworkFile; chapters: NetworkFile } {
  const stats = computeStatistics(cols);
  const books = buildNetworkFile(cols, 'book', { edgesPerNode: 66 });
  const chapters = buildNetworkFile(cols, 'chapter', { edgesPerNode: 8 });
  writeJson(`${OUT_DIR}/statistics/statistics.json`, stats);
  writeJson(`${OUT_DIR}/statistics/network-books.json`, books);
  writeJson(`${OUT_DIR}/statistics/network-chapters.json`, chapters);
  return { stats, books, chapters };
}
