/** Shared types for Bible translation data (build scripts + BibleTextProvider). */
export type VerseNote =
  | { kind: 'empty' } // the edition has no text at this verse number
  | { kind: 'remapped'; from: string } // text comes from a differently numbered verse of the edition
  | { kind: 'shared'; from: string; covers: [string, string] } // one edition verse spans several KJV verses
  | { kind: 'versification'; from: string; detail: string }; // dataset-only position (3 John 1:15)

export interface TranslationMeta {
  code: string;
  name: string;
  language: string;
  license: string;
  licenseNote: string;
  source: string;
  sourceUrl: string;
  versification: string;
  bracketsMeaning: string | null;
  stats: { verses: number; withText: number; remapped: number; shared: number; empty: number };
}

export interface BookText {
  chapters: string[][];
  notes: Record<string, VerseNote>;
}
