/** People and places (STEPBible TIPNR, CC BY 4.0), as published in public/data/names/names.json. */
export type NameType = 'person' | 'place' | 'other';

export interface NamesFile {
  source: string;
  license: string;
  url: string;
  /** [name, first-reference tag, type, short description (English), verse indices] */
  entries: [string, string, NameType, string, number[]][];
}
