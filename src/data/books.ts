/**
 * Canonical metadata for the 66 books of the Protestant canon, in canonical order.
 *
 * - `osis`  : OSIS-style code used by OpenBible.info (e.g. "Gen", "1Cor", "Ps").
 * - `vpl`   : book code used by eBible.org VPL files (BibleWorks-style), used only at import time.
 * - `genre` : conventional Protestant grouping, used for colouring and grouping only.
 * - `aliasesEn` / `aliasesEs`: names and common abbreviations recognised by the search box.
 *   Accents, dots, spaces and case are normalised before matching (see `search.ts`).
 */
export type Testament = 'OT' | 'NT';

export type Genre =
  | 'law'
  | 'history'
  | 'wisdom'
  | 'major-prophets'
  | 'minor-prophets'
  | 'gospels'
  | 'acts'
  | 'pauline'
  | 'general'
  | 'apocalyptic';

export interface BookMeta {
  osis: string;
  vpl: string;
  nameEn: string;
  nameEs: string;
  shortEn: string;
  shortEs: string;
  testament: Testament;
  genre: Genre;
  aliasesEn: string[];
  aliasesEs: string[];
}

const b = (
  osis: string,
  vpl: string,
  nameEn: string,
  nameEs: string,
  shortEn: string,
  shortEs: string,
  testament: Testament,
  genre: Genre,
  aliasesEn: string[],
  aliasesEs: string[],
): BookMeta => ({ osis, vpl, nameEn, nameEs, shortEn, shortEs, testament, genre, aliasesEn, aliasesEs });

export const BOOK_META: readonly BookMeta[] = [
  b('Gen', 'GEN', 'Genesis', 'Génesis', 'Gen', 'Gn', 'OT', 'law', ['ge', 'gn', 'gen'], ['gn', 'gen', 'ge']),
  b('Exod', 'EXO', 'Exodus', 'Éxodo', 'Exod', 'Éx', 'OT', 'law', ['ex', 'exo', 'exod'], ['ex', 'exo', 'exod']),
  b('Lev', 'LEV', 'Leviticus', 'Levítico', 'Lev', 'Lv', 'OT', 'law', ['le', 'lv', 'lev'], ['lv', 'lev']),
  b('Num', 'NUM', 'Numbers', 'Números', 'Num', 'Nm', 'OT', 'law', ['nu', 'nm', 'nb', 'num'], ['nm', 'num']),
  b('Deut', 'DEU', 'Deuteronomy', 'Deuteronomio', 'Deut', 'Dt', 'OT', 'law', ['dt', 'de', 'deu', 'deut'], ['dt', 'deu', 'deut']),
  b('Josh', 'JOS', 'Joshua', 'Josué', 'Josh', 'Jos', 'OT', 'history', ['jos', 'jsh', 'josh'], ['jos']),
  b('Judg', 'JDG', 'Judges', 'Jueces', 'Judg', 'Jue', 'OT', 'history', ['jdg', 'jg', 'jdgs', 'judg'], ['jue', 'jc']),
  b('Ruth', 'RUT', 'Ruth', 'Rut', 'Ruth', 'Rt', 'OT', 'history', ['ru', 'rth', 'rut'], ['rt']),
  b('1Sam', '1SA', '1 Samuel', '1 Samuel', '1 Sam', '1 S', 'OT', 'history', ['1sa', '1sam', '1sm', '1s'], ['1s', '1sa', '1sam', '1sm']),
  b('2Sam', '2SA', '2 Samuel', '2 Samuel', '2 Sam', '2 S', 'OT', 'history', ['2sa', '2sam', '2sm', '2s'], ['2s', '2sa', '2sam', '2sm']),
  b('1Kgs', '1KI', '1 Kings', '1 Reyes', '1 Kgs', '1 R', 'OT', 'history', ['1k', '1ki', '1kg', '1kgs', '1kin'], ['1r', '1re', '1rey']),
  b('2Kgs', '2KI', '2 Kings', '2 Reyes', '2 Kgs', '2 R', 'OT', 'history', ['2k', '2ki', '2kg', '2kgs', '2kin'], ['2r', '2re', '2rey']),
  b('1Chr', '1CH', '1 Chronicles', '1 Crónicas', '1 Chr', '1 Cr', 'OT', 'history', ['1ch', '1chr', '1chron'], ['1cr', '1cro', '1cron']),
  b('2Chr', '2CH', '2 Chronicles', '2 Crónicas', '2 Chr', '2 Cr', 'OT', 'history', ['2ch', '2chr', '2chron'], ['2cr', '2cro', '2cron']),
  b('Ezra', 'EZR', 'Ezra', 'Esdras', 'Ezra', 'Esd', 'OT', 'history', ['ezr'], ['esd']),
  b('Neh', 'NEH', 'Nehemiah', 'Nehemías', 'Neh', 'Neh', 'OT', 'history', ['ne', 'neh'], ['ne', 'neh']),
  b('Esth', 'EST', 'Esther', 'Ester', 'Esth', 'Est', 'OT', 'history', ['es', 'est', 'esth'], ['est']),
  b('Job', 'JOB', 'Job', 'Job', 'Job', 'Job', 'OT', 'wisdom', ['jb'], ['jb']),
  b('Ps', 'PSA', 'Psalms', 'Salmos', 'Ps', 'Sal', 'OT', 'wisdom', ['ps', 'psa', 'psalm', 'pss', 'psm'], ['sal', 'salmo', 'sl']),
  b('Prov', 'PRO', 'Proverbs', 'Proverbios', 'Prov', 'Pr', 'OT', 'wisdom', ['pr', 'prv', 'pro', 'prov'], ['pr', 'pro', 'prov']),
  b('Eccl', 'ECC', 'Ecclesiastes', 'Eclesiastés', 'Eccl', 'Ec', 'OT', 'wisdom', ['ec', 'ecc', 'eccl', 'eccles', 'qoh', 'qoheleth'], ['ec', 'ecl', 'ecles', 'qo']),
  b('Song', 'SOL', 'Song of Solomon', 'Cantares', 'Song', 'Cnt', 'OT', 'wisdom', ['so', 'sos', 'sng', 'song', 'song of songs', 'canticles', 'cant'], ['cnt', 'cant', 'cantar', 'cantar de los cantares', 'cantico', 'cantico de los canticos']),
  b('Isa', 'ISA', 'Isaiah', 'Isaías', 'Isa', 'Is', 'OT', 'major-prophets', ['is', 'isa'], ['is', 'isa']),
  b('Jer', 'JER', 'Jeremiah', 'Jeremías', 'Jer', 'Jer', 'OT', 'major-prophets', ['je', 'jr', 'jer'], ['jr', 'jer']),
  b('Lam', 'LAM', 'Lamentations', 'Lamentaciones', 'Lam', 'Lm', 'OT', 'major-prophets', ['la', 'lam'], ['lm', 'lam']),
  b('Ezek', 'EZE', 'Ezekiel', 'Ezequiel', 'Ezek', 'Ez', 'OT', 'major-prophets', ['eze', 'ezk', 'ezek'], ['ez', 'eze', 'ezeq']),
  b('Dan', 'DAN', 'Daniel', 'Daniel', 'Dan', 'Dn', 'OT', 'major-prophets', ['da', 'dn', 'dan'], ['dn', 'dan']),
  b('Hos', 'HOS', 'Hosea', 'Oseas', 'Hos', 'Os', 'OT', 'minor-prophets', ['ho', 'hos'], ['os']),
  b('Joel', 'JOE', 'Joel', 'Joel', 'Joel', 'Jl', 'OT', 'minor-prophets', ['jl', 'joe'], ['jl']),
  b('Amos', 'AMO', 'Amos', 'Amós', 'Amos', 'Am', 'OT', 'minor-prophets', ['am', 'amo'], ['am']),
  b('Obad', 'OBA', 'Obadiah', 'Abdías', 'Obad', 'Abd', 'OT', 'minor-prophets', ['ob', 'oba', 'obad'], ['abd']),
  b('Jonah', 'JON', 'Jonah', 'Jonás', 'Jonah', 'Jon', 'OT', 'minor-prophets', ['jnh', 'jon'], ['jon']),
  b('Mic', 'MIC', 'Micah', 'Miqueas', 'Mic', 'Mi', 'OT', 'minor-prophets', ['mi', 'mc', 'mic'], ['mi', 'miq']),
  b('Nah', 'NAH', 'Nahum', 'Nahúm', 'Nah', 'Nah', 'OT', 'minor-prophets', ['na', 'nah'], ['na', 'nah']),
  b('Hab', 'HAB', 'Habakkuk', 'Habacuc', 'Hab', 'Hab', 'OT', 'minor-prophets', ['hb', 'hab'], ['ha', 'hab']),
  b('Zeph', 'ZEP', 'Zephaniah', 'Sofonías', 'Zeph', 'Sof', 'OT', 'minor-prophets', ['zp', 'zep', 'zeph'], ['so', 'sof']),
  b('Hag', 'HAG', 'Haggai', 'Hageo', 'Hag', 'Hag', 'OT', 'minor-prophets', ['hg', 'hag'], ['ag', 'hag']),
  b('Zech', 'ZEC', 'Zechariah', 'Zacarías', 'Zech', 'Zac', 'OT', 'minor-prophets', ['zc', 'zec', 'zech'], ['zc', 'zac']),
  b('Mal', 'MAL', 'Malachi', 'Malaquías', 'Mal', 'Mal', 'OT', 'minor-prophets', ['ml', 'mal'], ['ml', 'mal']),
  b('Matt', 'MAT', 'Matthew', 'Mateo', 'Matt', 'Mt', 'NT', 'gospels', ['mt', 'mat', 'matt'], ['mt', 'mat']),
  b('Mark', 'MAR', 'Mark', 'Marcos', 'Mark', 'Mc', 'NT', 'gospels', ['mk', 'mr', 'mrk', 'mar'], ['mc', 'mr', 'mar', 'marc']),
  b('Luke', 'LUK', 'Luke', 'Lucas', 'Luke', 'Lc', 'NT', 'gospels', ['lk', 'lu', 'luk'], ['lc', 'luc']),
  b('John', 'JOH', 'John', 'Juan', 'John', 'Jn', 'NT', 'gospels', ['jn', 'jhn', 'joh'], ['jn']),
  b('Acts', 'ACT', 'Acts', 'Hechos', 'Acts', 'Hch', 'NT', 'acts', ['ac', 'act', 'acts of the apostles'], ['hch', 'hech', 'hechos de los apostoles']),
  b('Rom', 'ROM', 'Romans', 'Romanos', 'Rom', 'Ro', 'NT', 'pauline', ['ro', 'rm', 'rom'], ['ro', 'rm', 'rom']),
  b('1Cor', '1CO', '1 Corinthians', '1 Corintios', '1 Cor', '1 Co', 'NT', 'pauline', ['1co', '1cor'], ['1co', '1cor']),
  b('2Cor', '2CO', '2 Corinthians', '2 Corintios', '2 Cor', '2 Co', 'NT', 'pauline', ['2co', '2cor'], ['2co', '2cor']),
  b('Gal', 'GAL', 'Galatians', 'Gálatas', 'Gal', 'Gá', 'NT', 'pauline', ['ga', 'gal'], ['ga', 'gal']),
  b('Eph', 'EPH', 'Ephesians', 'Efesios', 'Eph', 'Ef', 'NT', 'pauline', ['ep', 'eph', 'ephes'], ['ef', 'efe']),
  b('Phil', 'PHI', 'Philippians', 'Filipenses', 'Phil', 'Flp', 'NT', 'pauline', ['php', 'pp', 'phil'], ['fil', 'flp']),
  b('Col', 'COL', 'Colossians', 'Colosenses', 'Col', 'Col', 'NT', 'pauline', ['col'], ['col']),
  b('1Thess', '1TH', '1 Thessalonians', '1 Tesalonicenses', '1 Thess', '1 Ts', 'NT', 'pauline', ['1th', '1thes', '1thess'], ['1ts', '1tes']),
  b('2Thess', '2TH', '2 Thessalonians', '2 Tesalonicenses', '2 Thess', '2 Ts', 'NT', 'pauline', ['2th', '2thes', '2thess'], ['2ts', '2tes']),
  b('1Tim', '1TI', '1 Timothy', '1 Timoteo', '1 Tim', '1 Ti', 'NT', 'pauline', ['1ti', '1tim', '1tm'], ['1ti', '1tim', '1tm']),
  b('2Tim', '2TI', '2 Timothy', '2 Timoteo', '2 Tim', '2 Ti', 'NT', 'pauline', ['2ti', '2tim', '2tm'], ['2ti', '2tim', '2tm']),
  b('Titus', 'TIT', 'Titus', 'Tito', 'Titus', 'Tit', 'NT', 'pauline', ['tit', 'ti'], ['tit']),
  b('Phlm', 'PHM', 'Philemon', 'Filemón', 'Phlm', 'Flm', 'NT', 'pauline', ['phm', 'phlm', 'philem'], ['flm', 'filem']),
  b('Heb', 'HEB', 'Hebrews', 'Hebreos', 'Heb', 'Heb', 'NT', 'general', ['he', 'heb'], ['he', 'heb']),
  b('Jas', 'JAM', 'James', 'Santiago', 'Jas', 'Stg', 'NT', 'general', ['jas', 'jm', 'jam'], ['stg', 'sant', 'sgo']),
  b('1Pet', '1PE', '1 Peter', '1 Pedro', '1 Pet', '1 P', 'NT', 'general', ['1pe', '1pet', '1pt', '1p'], ['1p', '1pe', '1ped']),
  b('2Pet', '2PE', '2 Peter', '2 Pedro', '2 Pet', '2 P', 'NT', 'general', ['2pe', '2pet', '2pt', '2p'], ['2p', '2pe', '2ped']),
  b('1John', '1JO', '1 John', '1 Juan', '1 John', '1 Jn', 'NT', 'general', ['1jn', '1jo', '1jhn', '1joh'], ['1jn']),
  b('2John', '2JO', '2 John', '2 Juan', '2 John', '2 Jn', 'NT', 'general', ['2jn', '2jo', '2jhn', '2joh'], ['2jn']),
  b('3John', '3JO', '3 John', '3 Juan', '3 John', '3 Jn', 'NT', 'general', ['3jn', '3jo', '3jhn', '3joh'], ['3jn']),
  b('Jude', 'JUD', 'Jude', 'Judas', 'Jude', 'Jud', 'NT', 'general', ['jud', 'jd'], ['jud', 'jds']),
  b('Rev', 'REV', 'Revelation', 'Apocalipsis', 'Rev', 'Ap', 'NT', 'apocalyptic', ['re', 'rv', 'rev', 'apocalypse', 'revelations'], ['ap', 'apoc']),
];

export const BOOK_COUNT = BOOK_META.length;

export const GENRES: readonly Genre[] = [
  'law',
  'history',
  'wisdom',
  'major-prophets',
  'minor-prophets',
  'gospels',
  'acts',
  'pauline',
  'general',
  'apocalyptic',
];
