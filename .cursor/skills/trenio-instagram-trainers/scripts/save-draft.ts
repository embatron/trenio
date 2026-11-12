/**
 * Turn a raw Instagram extract into a draft trainer profile.
 * Usage: npx tsx .cursor/skills/trenio-instagram-trainers/scripts/save-draft.ts <raw.json> [more.json]
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import "dotenv/config";
import sharp from "sharp";
import { tinifyImage } from "../../../../src/lib/images/tinify.ts";
import { coverPosition } from "../../../../src/lib/images/variants.ts";
import { formatBelarusPhone } from "../../../../src/lib/auth/phone.ts";
import { inferTrainerGender } from "../../../../src/lib/catalog/trainer-gender.ts";
import { foldYo, prepareSportText, sportAliasRegex } from "../../../../src/lib/catalog/sport-alias.ts";
import { TOP_LEVEL_SPORT_CATEGORIES, trainerIntroPhrase, trainerSportRoles } from "../../../../src/lib/catalog/sport-taxonomy.ts";
import { trainerPersonKey } from "../../../../src/lib/catalog/trainer-slugs.ts";
import { AuthError } from "../../../../src/lib/auth/errors.ts";
import { isSpecificAddress } from "../../../../src/lib/geo/schemas.ts";
import { resolveTrainingPlaces } from "../../../../src/lib/geo/resolve.ts";
import { logCaught } from "../../../../src/lib/log/logger.ts";
import { closeDb } from "../../../../src/db/index.ts";
import { duplicateTrainerSlug } from "../../../../src/db/trainer-profiles.ts";

type RawPhoto = {
  url?: string;
  alt?: string;
  mime?: string;
  base64?: string;
  width?: number;
  height?: number;
};

type PinnedPost = {
  url?: string;
  caption?: string;
  ogDescription?: string;
  heading?: string;
  visibleText?: string;
  /** Words read off a pinned photo: about the trainer, the session, or the facts. */
  imageText?: string[];
  /** True when the opened post is a reel or another video. A video stores no frame. */
  video?: boolean;
  photos?: RawPhoto[];
};

type ThreadsPost = {
  url?: string;
  text?: string;
  photos?: RawPhoto[];
};

type ThreadsProfile = {
  url?: string;
  headerText?: string;
  bio?: string;
  posts?: ThreadsPost[];
};

type PhotoKeep = {
  postUrl?: string;
  index?: number;
  role?: "gallery" | "certificate";
  caption?: string;
};

type PhotoSkip = {
  postUrl?: string;
  index?: number;
  reason?: string;
};

type SportRole = {
  slug?: string;
  quote?: string;
};

type ResolvedProfile = {
  firstName?: string;
  lastName?: string;
  nameQuotes?: string[];
  /** Verbatim profile biography. The card text is `presentation`, not this field. */
  sourceBio?: string;
  aboutProfile?: string[];
  presentation?: string;
  presentationQuotes?: string[];
  /** Plain «Как проходят мои тренировки». Empty when the source never describes a session. */
  training?: string;
  trainingQuotes?: string[];
  sportQuotes?: string[];
  coachedSports?: SportRole[];
  practicedSports?: SportRole[];
  unrelatedSports?: SportRole[];
  primarySportSlug?: string;
  city?: string;
  /** Short street or hall, verbatim. The script geocodes it and stores the street. */
  address?: string;
  priceFrom?: number | null;
  phone?: string;
  email?: string;
  telegram?: string;
  languages?: string[];
  experienceYears?: number | null;
  formats?: Array<"individual" | "group">;
  audiences?: Array<"adult" | "kid" | "teen">;
  photoKeeps?: PhotoKeep[];
  photoSkips?: PhotoSkip[];
  /** Old inputs. The script rejects them so a caption is not stored as the card text. */
  bio?: string;
  about?: string[];
};

type RawExtract = {
  sourceUrl?: string;
  blocked?: string | null;
  ogTitle?: string;
  ogDescription?: string;
  headerText?: string;
  externalUrl?: string;
  highlights?: string[];
  highlightLinks?: Array<{ title?: string; href?: string }>;
  contacts?: { emails?: string[]; phones?: string[]; telegrams?: string[] };
  aboutFrames?: string[];
  pinned?: PinnedPost[];
  /** Other grid posts. Photos only. Their captions are not card-text quotes. */
  extraPosts?: PinnedPost[];
  /** Facts the operator wrote for this Instagram account. Verbatim. */
  operatorNotes?: string;
  /** Public Threads profile attached to this account. Text may fill fields and the card. */
  threads?: ThreadsProfile | null;
  avatarUrl?: string;
  avatarMime?: string;
  avatarBase64?: string;
  resolved?: ResolvedProfile;
};

type SportHit = {
  slug: string;
  parentSlug: string;
  label: string;
  titleGenitive: string;
  alias: string;
  child: boolean;
};

const ROOT = process.cwd();
const DRAFT_DIR = join(ROOT, "data/instagram-trainers");
const AVATAR_DIR = join(ROOT, "public/trainers/instagram");
const SETTLEMENTS_PATH = join(ROOT, "public/data/belarus-settlements.json");

const ROLE_WORDS =
  /^(тренер|тренерка|coach|trainer|fitness|training|sport|sports|official|instagram|insta)$/i;

function handleFromUrl(url: string): string {
  const match = url.match(/instagram\.com\/([A-Za-z0-9._]{1,30})\/?/i);
  if (!match) throw new Error(`Not an Instagram profile URL: ${url}`);
  const handle = match[1].toLowerCase();
  if (["p", "reel", "reels", "stories", "explore", "accounts"].includes(handle)) {
    throw new Error(`Need a profile URL, not a ${handle} link: ${url}`);
  }
  return handle;
}

function cleanLine(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function norm(value: string): string {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

function includesNorm(haystack: string, needle: string): boolean {
  const cleaned = norm(needle);
  return cleaned.length > 0 && norm(haystack).includes(cleaned);
}

function hasWord(haystack: string, word: string): boolean {
  const cleaned = word.trim();
  if (!cleaned) return false;
  const escaped = cleaned.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?<![\\p{L}])${escaped}(?![\\p{L}])`, "iu").test(haystack);
}

function corpusOf(raw: RawExtract): string {
  const pins = raw.pinned || [];
  return [
    raw.ogTitle || "",
    raw.ogDescription || "",
    raw.headerText || "",
    ...(raw.aboutFrames || []),
    ...(raw.highlights || []),
    ...pins.flatMap((post) => [
      post.ogDescription || "",
      post.heading || "",
      post.visibleText || "",
      post.caption || "",
      ...(post.imageText || []),
    ]),
  ].join("\n");
}

function threadsBlob(raw: RawExtract): string {
  const threads = raw.threads;
  if (!threads) return "";
  return [threads.headerText || "", threads.bio || "", ...(threads.posts || []).map((post) => post.text || "")].join("\n");
}

function noteBlob(raw: RawExtract): string {
  return raw.operatorNotes || "";
}

function noteNamePairs(note: string, settlements: string[]): Array<{ first: string; last: string }> {
  const cities = new Set(settlements.map((name) => name.toLowerCase()));
  const pairs: Array<{ first: string; last: string }> = [];
  const noteForNames = note.replace(/(?<![\p{L}])Это\s+(?=[\p{Lu}])/gu, "");
  for (const match of noteForNames.matchAll(/(?<![\p{L}])([\p{Lu}][\p{Ll}]{1,})\s+([\p{Lu}][\p{Ll}]{1,})(?![\p{L}])/gu)) {
    const first = match[1] || "";
    const last = match[2] || "";
    if (!first || !last || ROLE_WORDS.test(first) || ROLE_WORDS.test(last)) continue;
    if (!/^[\p{Script=Cyrillic}]+$/u.test(first) || !/^[\p{Script=Cyrillic}]+$/u.test(last)) continue;
    const sportWord = (word: string) => catalogPhrases().some((phrase) => phrase.label.toLowerCase() === word.toLowerCase() || phrase.alias.toLowerCase() === word.toLowerCase());
    if (sportWord(first) || sportWord(last)) continue;
    if (cities.has(first.toLowerCase()) || cities.has(last.toLowerCase())) continue;
    const before = noteForNames.slice(Math.max(0, (match.index ?? 0) - 16), match.index ?? 0);
    if (/(?:ул\.?|улиц\p{L}*|проспект|пр-т|пер\.|переул\p{L}*|бульвар)\s*$/iu.test(before)) continue;
    if (pairs.some((pair) => pair.first === first && pair.last === last)) continue;
    pairs.push({ first, last });
  }
  return pairs;
}

function labeledName(note: string, label: "имя" | "фамилия" | "зовут"): string[] {
  const found = new Set<string>();
  const pattern = new RegExp(`(?:${label})\\s*[:\\-—]?\\s*([\\p{Lu}][\\p{Ll}]{1,})`, "giu");
  for (const match of note.matchAll(pattern)) {
    const value = match[1] || "";
    if (value && !ROLE_WORDS.test(value)) found.add(value);
  }
  return [...found];
}

/** A single value in the operator note replaces the page. Several values are refused. */
function oneFromNote(noteValues: string[], pageValues: string[], label: string, rawPath: string): string[] {
  if (noteValues.length > 1) fail(rawPath, `Operator note has several ${label} values: ${noteValues.join(", ")}. Keep one.`);
  if (noteValues.length === 1) return noteValues;
  return pageValues;
}

function assertThreads(raw: RawExtract, rawPath: string) {
  const threads = raw.threads;
  if (!threads) return;
  const url = (threads.url || "").trim().split("?")[0];
  if (!/^https:\/\/(?:www\.)?threads\.(?:net|com)\/@?[A-Za-z0-9._]{1,30}\/?$/i.test(url)) {
    fail(rawPath, "Threads URL must be a profile on threads.net or threads.com.");
  }
  const posts = threads.posts || [];
  if (posts.length > 12) fail(rawPath, "Threads stores at most 12 posts.");
  for (const post of posts) {
    if ((post.photos || []).length > 2) fail(rawPath, "A Threads post stores at most 2 photos.");
    if ((post.photos || []).length > 0 && !(post.url || "").trim()) fail(rawPath, "A Threads photo needs the post URL.");
  }
}

function givenNamesBeside(corpus: string, lastName: string): string[] {
  if (!lastName.trim()) return [];
  const escaped = lastName.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(
    `(?:(?<![\\p{L}])([\\p{Lu}][\\p{Ll}]{1,})\\s+${escaped}(?![\\p{L}]))|(?:(?<![\\p{L}])${escaped}\\s+([\\p{Lu}][\\p{Ll}]{1,})(?![\\p{L}]))`,
    "gu",
  );
  const found = new Set<string>();
  for (const match of corpus.matchAll(pattern)) {
    const candidate = match[1] || match[2] || "";
    if (candidate && !ROLE_WORDS.test(candidate)) found.add(candidate);
  }
  return [...found];
}

const HOBBY_CUE = /занима(юсь|ется|лась|лся)|увлека(юсь|ется)|хожу в|для себя|хобби|практикую|испытал[аи]? на себе|в свой тренировочный план/iu;
const COACH_CUE = /тренер|тренирую(?!сь)|тренирует|преподава|инструктор|обучаю|веду (?:занятия|группы|тренировки)|coach\b|trainer\b/iu;

function catalogPhrases(): SportHit[] {
  const phrases: SportHit[] = [];
  for (const category of TOP_LEVEL_SPORT_CATEGORIES) {
    const parents = [
      { slug: category.slug, parentSlug: category.slug, label: category.label, titleGenitive: category.titleGenitive, aliases: [category.label, ...(category.aliases || [])], child: false },
      ...category.children.map((child) => ({
        slug: child.slug,
        parentSlug: category.slug,
        label: child.label,
        titleGenitive: child.titleGenitive || child.label,
        aliases: [child.label, ...(child.aliases || [])],
        child: true,
      })),
    ];
    for (const phrase of parents) {
      for (const alias of phrase.aliases) {
        if (alias.trim().length < 3) continue;
        phrases.push({ slug: phrase.slug, parentSlug: phrase.parentSlug, label: phrase.label, titleGenitive: phrase.titleGenitive, alias, child: phrase.child });
      }
    }
  }
  return phrases;
}

function matchSports(text: string, settlements: string[]): SportHit[] {
  const aliases = catalogPhrases().map((phrase) => phrase.alias);
  const folded = foldYo(prepareSportText(text, settlements, aliases));
  const found: Array<SportHit & { start: number; end: number }> = [];
  for (const phrase of catalogPhrases()) {
    const pattern = new RegExp(sportAliasRegex(phrase.alias).source, "giu");
    for (const match of folded.matchAll(pattern)) {
      const start = match.index ?? 0;
      found.push({ ...phrase, start, end: start + match[0].length });
    }
  }
  found.sort((a, b) => {
    const byLength = (b.end - b.start) - (a.end - a.start);
    if (byLength) return byLength;
    if (a.start !== b.start) return a.start - b.start;
    const aSpecific = a.child ? 0 : 1;
    const bSpecific = b.child ? 0 : 1;
    return aSpecific - bSpecific;
  });
  const taken: Array<{ start: number; end: number }> = [];
  const hits: SportHit[] = [];
  const seen = new Set<string>();
  for (const hit of found) {
    if (taken.some((span) => hit.start < span.end && hit.end > span.start)) continue;
    taken.push({ start: hit.start, end: hit.end });
    const key = `${hit.parentSlug}/${hit.slug}`;
    if (seen.has(key)) continue;
    seen.add(key);
    hits.push({ slug: hit.slug, parentSlug: hit.parentSlug, label: hit.label, titleGenitive: hit.titleGenitive, alias: hit.alias, child: hit.child });
  }
  return hits;
}

function clausesOf(text: string): string[] {
  return text.split(/\n+|(?<=[.!?])\s+/u).map((part) => part.trim()).filter(Boolean);
}

function sportIsHobbyOnly(text: string, alias: string, settlements: string[]): boolean {
  const pattern = sportAliasRegex(alias);
  const clauses = clausesOf(foldYo(prepareSportText(text, settlements, [alias]))).filter((clause) => pattern.test(clause));
  return clauses.length > 0 && clauses.every((clause) => HOBBY_CUE.test(clause) && !COACH_CUE.test(clause));
}

function loadSettlements(): string[] {
  const payload = JSON.parse(readFileSync(SETTLEMENTS_PATH, "utf8")) as { settlements?: string[] };
  return (payload.settlements || []).filter((name) => name.trim().length >= 4);
}

function matchCities(text: string, settlements: string[]): string[] {
  const words = text.match(/(?<![\p{L}\d])[\p{L}]{4,}(?![\p{L}\d])/giu) || [];
  const found = new Set<string>();
  const byLength = [...settlements].sort((a, b) => b.length - a.length);
  for (const word of words) {
    const city = byLength.find((name) => {
      const cityName = name.toLowerCase();
      const token = word.toLowerCase();
      // «новый акк» is not the village Новый. A settlement name is capitalized.
      if (word[0] === word[0].toLowerCase()) return false;
      if (token === cityName) return true;
      if (cityName.length < 4 || !token.startsWith(cityName)) return false;
      return /^(?:[еуаыию]|ом|ой|ах|ях|ою)$/iu.test(token.slice(cityName.length));
    });
    if (city) found.add(city);
  }
  return [...found];
}

/** The word after a street mark is the street (пр. Янки Купалы), not the village of the same name. */
function streetNameTokens(text: string): Set<string> {
  const found = new Set<string>();
  const re =
    /(?:проспект\p{L}*|праспект\p{L}*|переул\p{L}*|завулак\p{L}*|бульвар\p{L}*|проезд\p{L}*|площад\p{L}*|плошч\p{L}*|набереж\p{L}*|шоссе|пр-т|(?<![\p{L}])пр\.|(?<![\p{L}])ул\.|(?<![\p{L}])вул\.)\s*([\p{Lu}][\p{Ll}]{3,})/gu;
  for (const match of text.matchAll(re)) {
    if (match[1]) found.add(match[1].toLowerCase());
  }
  return found;
}

function cityNamedAsPlace(text: string, city: string): boolean {
  const stem = city.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:в|г\\.|📍)\\s*${stem}(?:[еуаыию]|ом|ой|ах|ях|ою)?(?![\\p{L}])`, "iu").test(text);
}

function matchPrice(text: string): number | null {
  const match = text.match(/(\d{2,4})\s*(?:byn|бел\.?\s*руб|руб\.?)/i);
  return match ? Number(match[1]) : null;
}

const PHONE_IN_TEXT = /(?:[\u260E\u{1F4DE}\u{1F4F2}]\uFE0F?\s*)?(?:\+?\s*375|8\s*0)(?:[\s().-]*\d){9}/gu;

function matchPhones(text: string): string[] {
  const found = new Set<string>();
  for (const match of text.matchAll(PHONE_IN_TEXT)) {
    const phone = formatBelarusPhone(match[0]);
    if (phone) found.add(phone);
  }
  return [...found];
}

/** The number stays in the phone field. Description text does not repeat it. */
function stripPhones(text: string): string {
  return cleanLine(text.replace(PHONE_IN_TEXT, " "));
}

function matchEmails(text: string): string[] {
  const found = new Set<string>();
  for (const match of text.matchAll(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi)) {
    found.add(match[0].toLowerCase());
  }
  return [...found];
}

function matchTelegrams(text: string): string[] {
  const found = new Set<string>();
  for (const match of text.matchAll(/(?:https?:\/\/)?(?:t\.me|telegram\.me)\/([A-Za-z0-9_]{3,32})/gi)) {
    found.add(`https://t.me/${match[1]}`);
  }
  for (const match of text.matchAll(/(?:телеграм|telegram|tg)\s*[:\-—]?\s*@([A-Za-z0-9_]{3,32})/giu)) {
    found.add(`https://t.me/${match[1]}`);
  }
  return [...found];
}

function matchLanguages(text: string): string[] {
  const languages: string[] = [];
  if (/(?<![\p{L}])(?:русск\p{L}*|russian)(?![\p{L}])/iu.test(text)) languages.push("Русский");
  if (/(?<![\p{L}])(?:англ\p{L}*|english)(?![\p{L}])/iu.test(text)) languages.push("Английский");
  if (/(?<![\p{L}])(?:беларуск\p{L}*|белорусск\p{L}*)(?![\p{L}])/iu.test(text)) languages.push("Беларуская");
  if (/(?<![\p{L}])(?:польск\p{L}*|polish)(?![\p{L}])/iu.test(text)) languages.push("Польский");
  return languages;
}

function matchExperience(text: string): number | null {
  const patterns = [
    /тренерск\p{L}*\s+стаж\s*(?:более\s*)?(\d{1,2})\s*(?:год|года|лет)/iu,
    /стаж\s+тренер\p{L}*\s*(?:более\s*)?(\d{1,2})\s*(?:год|года|лет)/iu,
    /стаж\s+работ\p{L}*\s+тренер\p{L}*\s*(?:более\s*)?(\d{1,2})\s*(?:год|года|лет)/iu,
    /опыт\s+тренерск\p{L}*(?:\s+работ\p{L}*)?\s*(?:более\s*)?(\d{1,2})\s*(?:год|года|лет)/iu,
    /(?:тренирую|преподаю)(?:\s+уже)?\s*(?:более\s*)?(\d{1,2})\s*(?:год|года|лет)/iu,
    /более\s*(\d{1,2})\s*лет\s+тренерск/iu,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return Number(match[1]);
  }
  return null;
}

function matchFormats(text: string): Array<"individual" | "group"> {
  const formats: Array<"individual" | "group"> = [];
  if (/индивидуальн|персональн/iu.test(text)) formats.push("individual");
  if (/группов|в групп|групп[аеуы]/iu.test(text)) formats.push("group");
  return formats;
}

function matchAudiences(text: string): Array<"adult" | "kid" | "teen"> {
  if (/любого возраста|для всех возраст|всей семьи/iu.test(text)) return ["adult", "kid", "teen"];
  const found: Array<"adult" | "kid" | "teen"> = [];
  if (/взросл/iu.test(text)) found.push("adult");
  if (/дет(?:и|ск|ей|ям|ями|ях)|ребён|ребен|малыш/iu.test(text)) found.push("kid");
  if (/подрост|юниор/iu.test(text)) found.push("teen");
  return found;
}

const SESSION_CUE = /тренировк|заняти|в зале|группов|индивидуальн|персональн|разминк|спарринг/iu;
const PLACE_CUE = /улиц|вуліц|проспект|праспект|пр-т|(?<![\p{L}])пр(?:\.|(?![\p{L}]))|(?<![\p{L}])ул(?:\.|(?![\p{L}]))|(?<![\p{L}])вул(?:\.|(?![\p{L}]))|переул|завулак|бульвар|проезд|площад|плошч|набереж|шоссе|pushkin|пушкин/iu;
const CARD_NOISE = /[#|•·\p{Extended_Pictographic}\uFE0F]|https?:\/\/|t\.me\/|@[\p{L}\d_]/iu;
const CARD_CTA = /директ|в\s+лс\b|подпиши|пиши(?:те)?|ссылка в шапке|для записи/iu;
const SKIP_REASONS = new Set(["text", "logo", "flyer", "duplicate", "not-trainer", "crop", "clutter", "crowd", "back", "blur"]);
const CERTIFICATE_WORD = /диплом|сертификат|удостоверен/iu;

function fileStem(url: string): string {
  try {
    return new URL(url).pathname.split("/").pop()?.replace(/\.[a-z0-9]+$/i, "") || "";
  } catch {
    return "";
  }
}

function sentenceCount(text: string): number {
  return text.split(/[.!?]+/u).map((part) => part.trim()).filter((part) => /[\p{L}]/u.test(part)).length;
}

function paragraphsOf(value: string): string[] {
  return value
    .split(/\n\s*\n/)
    .map((part) => part.replace(/[ \t]+/g, " ").replace(/\n/g, " ").trim())
    .filter(Boolean);
}

function numbersIn(text: string): string[] {
  return [...text.matchAll(/\d+/g)].map((match) => match[0]);
}

function assertCardText(rawPath: string, label: string, text: string, quotes: string[], corpus: string, limit: number, maxSentences: number) {
  if (!text) return;
  if (text.length > limit) fail(rawPath, `${label} is longer than ${limit} characters.`);
  if (text.length < 20) fail(rawPath, `${label} is too short to read.`);
  if (sentenceCount(text) > maxSentences) fail(rawPath, `${label} is at most ${maxSentences} sentences.`);
  if (/[<>]/.test(text) || CARD_NOISE.test(text) || CARD_CTA.test(text)) {
    fail(rawPath, `${label} must be plain sentences: no emoji, hashtags, links, @names, or a call to write in direct.`);
  }
  if (!/[.!?…]/.test(text)) fail(rawPath, `${label} must be sentences a person can read aloud.`);
  if (!quotes.length) fail(rawPath, `${label} needs verbatim quotes from the biography, the about highlight, a pinned photo, Threads, or the operator note.`);
  for (const quote of quotes) {
    if (quote.trim().length < 4 || !includesNorm(corpus, quote)) {
      fail(rawPath, `${label} quote is not in the source: ${quote}`);
    }
  }
  for (const num of numbersIn(text)) {
    if (!corpus.includes(num)) fail(rawPath, `${label} contains ${num}, which is not in the source.`);
  }
}

const AVATAR_MIN_SIDE = 400;

async function imageSides(bytes: Buffer): Promise<{ w: number; h: number } | null> {
  try {
    const meta = await sharp(bytes, { failOn: "none", animated: false }).metadata();
    return { w: meta.width ?? 0, h: meta.height ?? 0 };
  } catch {
    return null;
  }
}

function avatarFile(handle: string) {
  return join(AVATAR_DIR, `${handle}.jpg`);
}

function avatarPublicPath(handle: string) {
  return `/trainers/instagram/${handle}.jpg`;
}

/** Same sizes as `writeImageSet`: master up to 1600px, then the card derivatives. Nothing is upscaled. */
async function storeAvatar(bytes: Buffer, absoluteMaster: string) {
  mkdirSync(AVATAR_DIR, { recursive: true });
  const prepared = await sharp(bytes, { failOn: "none", animated: false })
    .rotate()
    .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 82, mozjpeg: true })
    .toBuffer();
  let master = prepared;
  try {
    master = await tinifyImage(prepared);
  } catch (error) {
    console.warn(`TinyPNG skipped for ${absoluteMaster}: ${error instanceof Error ? error.message : "error"}`);
  }
  writeFileSync(absoluteMaster, master);
  const base = absoluteMaster.replace(/\.[a-z0-9]+$/i, "");
  const variants = [
    { name: "s128", width: 128, height: 128, fit: "cover" as const },
    { name: "c320", width: 320, height: 400, fit: "cover" as const },
    { name: "c640", width: 640, height: 800, fit: "cover" as const },
    { name: "w960", width: 960, height: 1280, fit: "inside" as const },
  ];
  const source = sharp(master, { failOn: "none" });
  const meta = await source.metadata();
  for (const variant of variants) {
    const gravity =
      variant.fit === "cover"
        ? coverPosition(meta.width ?? 0, meta.height ?? 0, variant.width, variant.height)
        : "centre";
    const file = await source
      .clone()
      .resize({ width: variant.width, height: variant.height, fit: variant.fit, position: gravity, withoutEnlargement: true })
      .jpeg({ quality: 78, mozjpeg: true })
      .toBuffer();
    writeFileSync(`${base}-${variant.name}.jpg`, file);
  }
}

async function savedAvatar(handle: string): Promise<string> {
  const file = avatarFile(handle);
  if (!existsSync(file)) return "";
  const size = await imageSides(readFileSync(file));
  if (!size || size.w < AVATAR_MIN_SIDE || size.h < AVATAR_MIN_SIDE) return "";
  return avatarPublicPath(handle);
}

function removeStaleExtras(handle: string, keepMasters: Set<string>) {
  if (!existsSync(AVATAR_DIR)) return;
  const escaped = handle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`^${escaped}-[gd]\\d+(?:-(?:s128|c320|c640|w960))?\\.jpg$`);
  for (const name of readdirSync(AVATAR_DIR)) {
    if (!pattern.test(name)) continue;
    const master = name.replace(/-(?:s128|c320|c640|w960)\.jpg$/, ".jpg");
    if (keepMasters.has(master)) continue;
    unlinkSync(join(AVATAR_DIR, name));
  }
}

async function writeAvatar(handle: string, raw: RawExtract): Promise<string> {
  const kept = await savedAvatar(handle);
  if (!raw.avatarBase64) return kept;
  const bytes = Buffer.from(raw.avatarBase64, "base64");
  const size = await imageSides(bytes);
  if (!size || size.w < 1 || size.h < 1) return kept;
  if ((size.w < AVATAR_MIN_SIDE || size.h < AVATAR_MIN_SIDE) && kept) return kept;
  await storeAvatar(bytes, avatarFile(handle));
  return avatarPublicPath(handle);
}

function fail(rawPath: string, message: string): never {
  throw new Error(`${rawPath}: ${message}`);
}

async function assertUniqueAccount(handle: string, slug: string, firstName: string, lastName: string, rawPath: string) {
  const key = trainerPersonKey(firstName, lastName);
  let names: string[] = [];
  try {
    names = readdirSync(DRAFT_DIR).filter((name) => name.endsWith(".json") && name !== "index.json");
  } catch {
    names = [];
  }
  for (const name of names) {
    if (name === `${handle}.json`) continue;
    let other: { handle?: string; slug?: string; firstName?: string; lastName?: string } = {};
    try {
      other = JSON.parse(readFileSync(join(DRAFT_DIR, name), "utf8")) as typeof other;
    } catch {
      continue;
    }
    const otherNick = String(other.slug || other.handle || "").trim().toLowerCase();
    const otherHandle = String(other.handle || "").trim().toLowerCase();
    if (otherNick === slug || otherHandle === handle) {
      fail(rawPath, `Nick ${slug} is already used by ${other.handle || name}.`);
    }
    if (key && trainerPersonKey(other.firstName || "", other.lastName || "") === key) {
      fail(rawPath, `This person already has slug ${otherNick || name}. Update that card. Do not create a second one.`);
    }
  }
  let duplicate: string | null = null;
  try {
    duplicate = await duplicateTrainerSlug(slug, firstName, lastName);
  } catch {
    fail(rawPath, "Could not read existing trainers. Do not create a card until that list is available.");
  }
  if (duplicate) fail(rawPath, `This person already has slug ${duplicate}. Update that card. Do not create a second one.`);
}

function placeQueriesOf(value: string): string[] {
  return value.split(/\s*\|\s*|\n+/u).map(cleanLine).filter(Boolean).slice(0, 3);
}

function placeQueryWords(value: string): number {
  return value.split(/[^\p{L}\p{N}]+/u).filter(Boolean).length;
}

function canonicalSettlement(name: string, settlements: string[]): string {
  const folded = name.trim().toLocaleLowerCase("ru");
  return settlements.find((item) => item.toLocaleLowerCase("ru") === folded) || "";
}

/** The street Nominatim returned. A venue name that did not resolve is dropped. A short street is kept when the map does not answer. */
async function geocodedPlaces(
  queries: string[],
  city: string,
  settlements: string[],
): Promise<{ address: string; city: string }> {
  const lines: string[] = [];
  let hitCity = "";
  for (const query of queries) {
    try {
      const [place] = await resolveTrainingPlaces(
        [{ city, district: "", address: query, lat: null, lng: null }],
        [],
      );
      if (place?.geocodeStatus === "ok" && isSpecificAddress(place.address)) {
        if (!lines.includes(place.address)) lines.push(place.address);
        if (!hitCity) hitCity = canonicalSettlement(place.city, settlements);
        continue;
      }
      if (isSpecificAddress(query)) lines.push(query);
    } catch (error) {
      if (error instanceof AuthError) continue;
      logCaught("geo", "geo.profile", error);
      if (isSpecificAddress(query)) lines.push(query);
    }
  }
  return { address: lines.slice(0, 3).join(" | "), city: hitCity };
}

const MOTION_URL = /\/(?:reel|reels|tv)\//i;
const STILL_REFUSAL = "A reel or a video is not a trainer photo. Store no frame from it.";

function videoBytes(bytes: Buffer): boolean {
  if (bytes.length >= 8 && bytes.subarray(4, 8).toString("ascii") === "ftyp") return true;
  if (bytes.length >= 4 && bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) return true;
  return false;
}

function assertStillPhotos(rawPath: string, post: PinnedPost, pinnedCaption: boolean) {
  const url = post.url || "";
  const motion = MOTION_URL.test(url) || post.video === true;
  const photos = post.photos || [];
  if (motion && photos.length) fail(rawPath, STILL_REFUSAL);
  if (motion && !pinnedCaption) fail(rawPath, "A reel is a video. Do not store it. Scroll to a still photo.");
  for (const photo of photos) {
    if (MOTION_URL.test(photo.url || "") || /^video\//i.test(photo.mime || "")) fail(rawPath, STILL_REFUSAL);
    if (!photo.base64) continue;
    const bytes = Buffer.from(photo.base64, "base64");
    if (videoBytes(bytes)) fail(rawPath, STILL_REFUSAL);
  }
}

async function saveOne(rawPath: string, settlements: string[]) {
  const raw = JSON.parse(readFileSync(rawPath, "utf8")) as RawExtract;
  if (raw.blocked) fail(rawPath, `Instagram blocked the read (${raw.blocked}). Do not invent a profile.`);
  const resolved = raw.resolved;
  if (!resolved) fail(rawPath, "Missing resolved block. Run sequential thinking for this trainer before saving.");

  const sourceUrl = raw.sourceUrl || "";
  const handle = handleFromUrl(sourceUrl);
  assertThreads(raw, rawPath);
  const note = noteBlob(raw);
  const threadsText = threadsBlob(raw);
  const pageCorpus = [corpusOf(raw), threadsText].join("\n");
  const corpus = [pageCorpus, note].join("\n");
  const pins = (raw.pinned || []).slice(0, 3);
  if ((raw.pinned || []).length > 3) fail(rawPath, "More than 3 pinned posts were stored.");
  const extras = (raw.extraPosts || []).slice(0, 12);
  if ((raw.extraPosts || []).length > 12) fail(rawPath, "More than 12 other photo posts were stored.");
  for (const post of extras) assertStillPhotos(rawPath, post, false);
  const threadPosts: PinnedPost[] = (raw.threads?.posts || []).map((post) => ({
    url: post.url,
    caption: post.text,
    visibleText: post.text,
    photos: post.photos,
  }));
  for (const post of threadPosts) assertStillPhotos(rawPath, post, true);
  const photoSources = [...pins, ...extras, ...threadPosts];

  const firstName = cleanLine(resolved.firstName || "");
  const lastName = cleanLine(resolved.lastName || "");
  const nameQuotes = (resolved.nameQuotes || []).map(cleanLine).filter(Boolean);
  for (const quote of nameQuotes) {
    if (!includesNorm(corpus, quote)) fail(rawPath, `Name quote is not in the profile, Threads, or the operator note: ${quote}`);
  }
  const quoted = nameQuotes.join("\n");
  if (firstName && !hasWord(quoted, firstName)) fail(rawPath, `firstName "${firstName}" is not in nameQuotes.`);
  if (lastName && !hasWord(quoted, lastName)) fail(rawPath, `lastName "${lastName}" is not in nameQuotes.`);
  const notedPairs = noteNamePairs(note, settlements);
  const notedPair = notedPairs.length === 1 ? notedPairs[0] : null;
  const notedFirst = labeledName(note, "имя").concat(labeledName(note, "зовут"));
  const notedLast = labeledName(note, "фамилия");
  if (notedPairs.length > 1) fail(rawPath, `Operator note names several people: ${notedPairs.map((pair) => `${pair.first} ${pair.last}`).join(", ")}.`);
  const noteOrder = Boolean(notedPair) && firstName === notedPair.first && lastName === notedPair.last;
  const noteReverse = Boolean(notedPair) && firstName === notedPair.last && lastName === notedPair.first;
  if (notedPair && !noteOrder && !noteReverse) {
    fail(rawPath, `Operator note names ${notedPair.first} ${notedPair.last}.`);
  }
  if (!notedPair && notedFirst.length > 1) fail(rawPath, `Operator note names several given names: ${notedFirst.join(", ")}.`);
  if (!notedPair && notedFirst.length === 1 && firstName !== notedFirst[0]) fail(rawPath, `Operator note names ${notedFirst[0]}.`);
  if (notedLast.length > 1) fail(rawPath, `Operator note names several surnames: ${notedLast.join(", ")}.`);
  if (notedLast.length === 1 && lastName !== notedLast[0]) fail(rawPath, `Operator note names ${notedLast[0]}.`);
  const noteStatesName = Boolean(notedPair) || (notedFirst.length === 1 && firstName === notedFirst[0]) || (Boolean(firstName) && hasWord(note, firstName));
  if (!noteStatesName) {
    const beside = givenNamesBeside(pageCorpus, lastName);
    if (beside.length > 1) fail(rawPath, `Conflicting given names next to ${lastName}: ${beside.join(", ")}. Leave the draft unsaved.`);
    if (beside.length === 1 && firstName !== beside[0]) {
      fail(rawPath, `Given name next to ${lastName} is ${beside[0]}. Do not leave it empty and do not substitute another name.`);
    }
  }

  if (resolved.bio != null || resolved.about != null) {
    fail(rawPath, "resolved.bio and resolved.about are no longer inputs. Set sourceBio, presentation, and training.");
  }

  const profileSurface = `${raw.ogDescription || ""}\n${raw.headerText || ""}`;
  const sourceBio = cleanLine(resolved.sourceBio || "");
  if (sourceBio && !includesNorm(profileSurface, sourceBio)) fail(rawPath, "sourceBio is not a verbatim piece of the profile text.");

  pins.forEach((post, index) => {
    const caption = cleanLine(post.caption || "");
    const postSource = `${post.ogDescription || ""}\n${post.heading || ""}\n${post.visibleText || ""}`;
    if (caption && !includesNorm(postSource, caption)) fail(rawPath, `Pinned caption ${index + 1} is not in that post.`);
    if ((post.photos || []).length > 2) fail(rawPath, "A pinned post stores at most 2 photos.");
    assertStillPhotos(rawPath, post, true);
  });
  extras.forEach((post) => {
    if ((post.photos || []).length > 2) fail(rawPath, "Another post stores at most 2 photos.");
  });
  const aboutFrames = (raw.aboutFrames || []).map(cleanLine).filter(Boolean);
  const aboutProfile = (resolved.aboutProfile || []).map(cleanLine);
  if (aboutProfile.join("\n") !== aboutFrames.join("\n")) {
    fail(rawPath, "aboutProfile must copy aboutFrames, one verbatim frame at a time.");
  }

  const sportQuotes = (resolved.sportQuotes || []).map(cleanLine).filter(Boolean);
  for (const quote of sportQuotes) {
    if (!includesNorm(corpus, quote)) fail(rawPath, `Sport quote is not in the source: ${quote}`);
  }
  const imageText = pins.flatMap((post) => (post.imageText || []).map(cleanLine).filter(Boolean));
  const pageEvidence = [
    profileSurface,
    ...aboutFrames,
    ...imageText,
    ...pins.map((post) => `${post.caption || ""}\n${post.visibleText || ""}`),
    threadsText,
  ].join("\n");
  const evidence = [pageEvidence, note].join("\n");
  const cardCorpus = [profileSurface, ...aboutFrames, ...imageText, threadsText, note].join("\n");
  const placeQueries = placeQueriesOf(resolved.address || "");
  for (const query of placeQueries) {
    if (!includesNorm(evidence, query)) {
      fail(rawPath, "address is not a verbatim piece of the profile, Threads, a pinned caption, a pinned image, or the operator note.");
    }
    if (query.length > 80 || placeQueryWords(query) > 8) {
      fail(rawPath, "Put the street or the hall in address, not the whole sentence. The script geocodes it.");
    }
  }
  if (PLACE_CUE.test(evidence) && placeQueries.length === 0) {
    fail(rawPath, "The source names a training place. Put the street or the hall in address. The script geocodes it.");
  }
  const expected = matchSports(evidence, settlements);
  const bySlug = new Map(expected.map((sport) => [sport.slug, sport]));
  const readRoles = (roles: SportRole[] | undefined, label: string) => (roles || []).map((role) => {
    const slug = cleanLine(role.slug || "");
    const quote = cleanLine(role.quote || "");
    const sport = bySlug.get(slug);
    if (!sport) fail(rawPath, `${label} slug ${slug || "empty"} is not a sport phrase in the profile, Threads, a pinned post, a pinned image, or the operator note.`);
    if (!quote || !includesNorm(evidence, quote)) fail(rawPath, `${label} quote for ${slug} is not in the source.`);
    const aliases = catalogPhrases().filter((phrase) => phrase.slug === slug).map((phrase) => phrase.alias);
    const preparedQuote = foldYo(prepareSportText(quote, settlements, aliases));
    if (!aliases.some((alias) => sportAliasRegex(alias).test(preparedQuote))) {
      fail(rawPath, `${label} quote for ${slug} does not contain that sport.`);
    }
    return { slug, quote, sport };
  });
  const coached = readRoles(resolved.coachedSports, "coached");
  const practiced = readRoles(resolved.practicedSports, "practiced");
  const unrelated = readRoles(resolved.unrelatedSports, "unrelated");
  const classified = new Set([...coached, ...practiced, ...unrelated].map((role) => role.slug));
  const missingSport = expected.filter((sport) => !classified.has(sport.slug)).map((sport) => sport.label);
  if (missingSport.length) fail(rawPath, `Classify every sport phrase as coached or practiced: ${missingSport.join(", ")}.`);
  for (const role of coached) {
    if (sportIsHobbyOnly(evidence, role.sport.alias, settlements)) {
      fail(rawPath, `${role.sport.label} is only something this person does, not a sport they coach. Quote: ${role.quote}`);
    }
  }
  const primarySlug = cleanLine(resolved.primarySportSlug || "");
  const primary = coached.find((role) => role.slug === primarySlug)?.sport || null;
  if (coached.length && !primary) fail(rawPath, "primarySportSlug must be one of the coached sports.");
  if (!coached.length && primarySlug) fail(rawPath, "No coached sport, so primarySportSlug stays empty.");
  const sports = coached.map((role) => role.sport);

  const nameTokens = new Set(
    [resolved.firstName, resolved.lastName]
      .map((part) => cleanLine(part || "").toLowerCase())
      .filter((part) => part.length >= 4),
  );
  // A surname that is also a village (Князева) is the person's name, not the city they named.
  const notThePerson = (name: string) => !nameTokens.has(name.toLowerCase());
  const notAStreet = (text: string) => {
    const streets = streetNameTokens(text);
    return (name: string) => !streets.has(name.toLowerCase());
  };
  const noteCities = matchCities(note, settlements).filter(notThePerson).filter(notAStreet(note));
  const pageCityHits = matchCities(pageCorpus, settlements).filter(notThePerson).filter(notAStreet(pageCorpus));
  const pageCued = pageCityHits.filter((name) => cityNamedAsPlace(pageCorpus, name));
  const pageCities = pageCued.length === 1 ? pageCued : pageCityHits;
  let city = cleanLine(resolved.city || "");
  if (noteCities.length > 1) fail(rawPath, `Operator note names several cities (${noteCities.join(", ")}). Name one.`);
  if (noteCities.length === 1 && city !== noteCities[0]) fail(rawPath, `Operator note names ${noteCities[0]}.`);
  if (noteCities.length === 0 && pageCities.length === 1 && city !== pageCities[0]) fail(rawPath, `City in the text is ${pageCities[0]}.`);
  if (noteCities.length === 0 && pageCities.length !== 1 && city) {
    fail(rawPath, `City is ambiguous or absent (${pageCityHits.join(", ") || "none"}). Leave it empty.`);
  }
  const cities = noteCities.length === 1 ? noteCities : pageCities;
  const statedCity = city;
  const mappedPlace = await geocodedPlaces(placeQueries, statedCity, settlements);
  let address = mappedPlace.address;
  if (!statedCity && mappedPlace.city) city = mappedPlace.city;
  if (!city && !address && cities.length === 0) city = "Минск";

  const priceInText = matchPrice(note) ?? matchPrice(pageCorpus);
  const priceFrom = resolved.priceFrom ?? null;
  if (priceFrom !== priceInText) fail(rawPath, `Price must be ${priceInText ?? "empty"}, matching the text.`);

  const pageContact = [
    pageCorpus,
    ...(raw.contacts?.phones || []),
    ...(raw.contacts?.emails || []),
    ...(raw.contacts?.telegrams || []),
  ].join("\n");
  const pagePhones = [...new Set([...matchPhones(pageContact), ...(raw.contacts?.phones || []).map((item) => formatBelarusPhone(item)).filter(Boolean)])];
  const phonesInText = oneFromNote([...new Set(matchPhones(note))], pagePhones, "phone", rawPath);
  const phone = formatBelarusPhone(resolved.phone || "");
  if (phonesInText.length === 0 && phone) fail(rawPath, "Phone is not in the profile, Threads, or the operator note.");
  if (phonesInText.length === 1 && phone !== phonesInText[0]) fail(rawPath, `Phone in the source is ${phonesInText[0]}. Copy it into the phone field and do not confirm it.`);
  if (phonesInText.length > 1 && !phonesInText.includes(phone)) fail(rawPath, `Phone must be one of: ${phonesInText.join(", ")}.`);

  const pageEmails = [...new Set([...matchEmails(pageContact), ...(raw.contacts?.emails || []).map((item) => item.trim().toLowerCase()).filter(Boolean)])];
  const emailsInText = oneFromNote([...new Set(matchEmails(note))], pageEmails, "email", rawPath);
  const email = cleanLine(resolved.email || "").toLowerCase();
  if (emailsInText.length === 0 && email) fail(rawPath, "Email is not in the profile, Threads, or the operator note.");
  if (emailsInText.length === 1 && email !== emailsInText[0]) fail(rawPath, `Email in the source is ${emailsInText[0]}. Save it without confirmation.`);
  if (emailsInText.length > 1 && !emailsInText.includes(email)) fail(rawPath, `Email must be one of: ${emailsInText.join(", ")}.`);

  const pageTelegrams = [...new Set([...matchTelegrams(pageContact), ...(raw.contacts?.telegrams || []).map((item) => {
    const handleMatch = item.match(/(?:t\.me|telegram\.me)\/([A-Za-z0-9_]{3,32})/i);
    return handleMatch ? `https://t.me/${handleMatch[1]}` : "";
  }).filter(Boolean)])];
  const telegramsInText = oneFromNote([...new Set(matchTelegrams(note))], pageTelegrams, "Telegram", rawPath);
  const telegram = cleanLine(resolved.telegram || "");
  const telegramKey = (value: string) => value.replace(/\/$/, "").toLowerCase();
  if (telegramsInText.length === 0 && telegram) fail(rawPath, "Telegram is not in the profile, Threads, or the operator note.");
  if (telegramsInText.length === 1 && telegramKey(telegram) !== telegramKey(telegramsInText[0])) {
    fail(rawPath, `Telegram in the source is ${telegramsInText[0]}.`);
  }
  if (telegramsInText.length > 1 && !telegramsInText.some((item) => telegramKey(item) === telegramKey(telegram))) {
    fail(rawPath, `Telegram must be one of: ${telegramsInText.join(", ")}.`);
  }
  const phoneValue = phonesInText.length === 1 ? phonesInText[0] : phone;
  const emailValue = emailsInText.length === 1 ? emailsInText[0] : email;
  const telegramValue = telegramsInText.length === 1 ? telegramsInText[0] : telegram;

  const languagesInText = matchLanguages(evidence);
  const languages = resolved.languages || [];
  if (languages.join("|") !== languagesInText.join("|")) fail(rawPath, "Languages do not match the text.");

  const experienceInText = matchExperience(note) ?? matchExperience(pageEvidence);
  const experienceYears = resolved.experienceYears ?? null;
  if (experienceYears !== experienceInText) {
    fail(rawPath, `Coaching experience must be ${experienceInText ?? "empty"}. A bare «стаж N лет» is not coaching experience.`);
  }

  const formatsInText = matchFormats(evidence);
  const formats = resolved.formats || [];
  if (formats.join("|") !== formatsInText.join("|")) fail(rawPath, "Formats do not match the text.");

  const audiencesInText = matchAudiences(evidence);
  const audiences = resolved.audiences || [];
  if (audiences.join("|") !== audiencesInText.join("|")) {
    fail(rawPath, `Audiences must be ${audiencesInText.join(", ") || "empty"}, matching the text. Order is adult, kid, teen.`);
  }

  const presentation = cleanLine(resolved.presentation || "");
  const presentationQuotes = (resolved.presentationQuotes || []).map(cleanLine).filter(Boolean);
  const trainingParagraphs = paragraphsOf(resolved.training || "");
  const training = trainingParagraphs.join("\n\n");
  const trainingQuotes = (resolved.trainingQuotes || []).map(cleanLine).filter(Boolean);
  const cardSurface = `${presentation}\n${training}`;
  const vagueExperience = evidence.match(/стаж\s*(\d{1,2})\s*(?:год|года|лет)/iu);
  if (vagueExperience && experienceYears == null && cardSurface.includes(vagueExperience[1])) {
    fail(rawPath, `The source says «стаж ${vagueExperience[1]}» without saying it is coaching experience. Leave that number out of the card.`);
  }
  if (/[\p{L}]{4,}/u.test(cardCorpus) && !presentation) {
    fail(rawPath, "Write presentation («Как меня представить») from the biography, the about highlight, the words on a pinned photo, Threads, or the operator note.");
  }
  assertCardText(rawPath, "presentation", presentation, presentationQuotes, cardCorpus, 700, 4);
  assertCardText(rawPath, "training", training, trainingQuotes, cardCorpus, 1600, 8);
  if (trainingParagraphs.length > 3) fail(rawPath, "training has at most 3 paragraphs.");
  const sessionInProfile = SESSION_CUE.test(cardCorpus);
  const trainingQuoted = trainingQuotes.length > 0 && trainingQuotes.every((quote) =>
    includesNorm(sourceBio, quote)
    || includesNorm(note, quote)
    || includesNorm(threadsText, quote)
    || aboutFrames.some((frame) => includesNorm(frame, quote))
    || imageText.some((frame) => includesNorm(frame, quote)),
  );
  if (sessionInProfile && !training) fail(rawPath, "The biography, the about highlight, a pinned photo, Threads, or the operator note describes a session. Write training («Как проходят мои тренировки»).");
  if (!sessionInProfile && training && !trainingQuoted) fail(rawPath, "training describes a session the biography, the about highlight, a pinned photo, Threads, and the operator note do not. A pinned caption fills fields and stays out of the card.");
  if (training && !trainingQuotes.some((quote) => SESSION_CUE.test(quote)) && !trainingQuoted) {
    fail(rawPath, "trainingQuotes must include the line that describes the session.");
  }
  const storedSourceBio = stripPhones(sourceBio);
  if (storedSourceBio && norm(presentation) === norm(storedSourceBio) && CARD_NOISE.test(sourceBio)) {
    fail(rawPath, "Rewrite the biography into plain sentences. Do not paste it into presentation.");
  }
  for (const post of pins) {
    const caption = cleanLine(post.caption || "");
    if (caption && (norm(caption) === norm(presentation) || norm(caption) === norm(training))) {
      fail(rawPath, "Write the card text. Do not paste a pinned caption.");
    }
  }
  for (const post of raw.threads?.posts || []) {
    const text = cleanLine(post.text || "");
    if (text && (norm(text) === norm(presentation) || norm(text) === norm(training))) {
      fail(rawPath, "Write the card text. Do not paste a Threads post.");
    }
  }
  const allowedSports = new Set([...coached, ...practiced].map((role) => role.slug));
  for (const hit of matchSports(cardSurface, settlements)) {
    if (!allowedSports.has(hit.slug)) {
      fail(rawPath, `${hit.label} is not a coached or practiced sport. Leave it out of the card text.`);
    }
  }
  const sportAliases = catalogPhrases().map((phrase) => phrase.alias);
  const sportInProfile = primary
    ? catalogPhrases().some((phrase) => phrase.slug === primary.slug && sportAliasRegex(phrase.alias).test(prepareSportText(cardCorpus, settlements, sportAliases)))
    : false;
  if (sportInProfile && !catalogPhrases().some((phrase) => phrase.slug === primary?.slug && sportAliasRegex(phrase.alias).test(foldYo(presentation)))) {
    fail(rawPath, `presentation must name the coached sport (${primary?.label}).`);
  }
  const namedCities = matchCities(cardSurface, settlements).filter((name) => !nameTokens.has(name.toLowerCase()));
  const extraCities = namedCities.filter((name) => name !== statedCity);
  if (extraCities.length) fail(rawPath, `Card text names ${extraCities.join(", ")}. The saved city is ${statedCity || "empty"}.`);
  if (statedCity && matchCities(cardCorpus, settlements).includes(statedCity) && !matchCities(presentation, settlements).includes(statedCity)) {
    fail(rawPath, `presentation must name ${statedCity}.`);
  }

  if (raw.avatarBase64 || raw.avatarUrl || raw.avatarMime) {
    const avatarBytes = raw.avatarBase64 ? Buffer.from(raw.avatarBase64, "base64") : Buffer.alloc(0);
    if (MOTION_URL.test(raw.avatarUrl || "") || /^video\//i.test(raw.avatarMime || "") || videoBytes(avatarBytes)) {
      fail(rawPath, STILL_REFUSAL);
    }
  }

  const avatarPath = await writeAvatar(handle, raw);
  const avatarStem = fileStem(raw.avatarUrl || "");
  const keeps = resolved.photoKeeps || [];
  const skips = resolved.photoSkips || [];
  const decisionKey = (item: { postUrl?: string; index?: number }) => `${(item.postUrl || "").split("?")[0]}#${item.index ?? ""}`;
  const decisionKeys = [...keeps, ...skips].map(decisionKey);
  if (new Set(decisionKeys).size !== decisionKeys.length) fail(rawPath, "A stored photo is listed twice.");
  for (const item of [...keeps, ...skips]) {
    const postUrl = (item.postUrl || "").split("?")[0];
    const post = photoSources.find((candidate) => (candidate.url || "").split("?")[0] === postUrl);
    const count = post?.photos?.length ?? 0;
    if (!post || item.index == null || item.index < 0 || item.index >= count) {
      fail(rawPath, `Photo decision does not match a stored image: ${postUrl || "missing url"} #${item.index ?? "?"}.`);
    }
  }
  const decided = new Set<string>();
  const gallery: Array<{ bytes: Buffer; stem: string; order: number }> = [];
  const certificates: Array<{ bytes: Buffer; caption: string }> = [];
  for (const post of photoSources) {
    const postUrl = (post.url || "").split("?")[0];
    const postSource = `${post.ogDescription || ""}\n${post.heading || ""}\n${post.visibleText || ""}\n${post.caption || ""}`;
    (post.photos || []).forEach((photo, index) => {
      const key = `${postUrl}#${index}`;
      const keep = keeps.find((item) => (item.postUrl || "").split("?")[0] === postUrl && item.index === index);
      const skip = skips.find((item) => (item.postUrl || "").split("?")[0] === postUrl && item.index === index);
      if (keep && skip) fail(rawPath, `Photo ${index + 1} of ${postUrl} is both kept and skipped.`);
      if (!keep && !skip) fail(rawPath, `Decide photo ${index + 1} of ${postUrl}: keep it or skip it.`);
      if (decided.has(key)) fail(rawPath, `Photo ${index + 1} of ${postUrl} is listed twice.`);
      decided.add(key);
      if (skip) {
        if (!SKIP_REASONS.has(skip.reason || "")) {
          fail(rawPath, `Skip reason for photo ${index + 1} must be one of: ${[...SKIP_REASONS].join(", ")}.`);
        }
        return;
      }
      const role = keep?.role;
      if (role !== "gallery" && role !== "certificate") fail(rawPath, `Photo ${index + 1} of ${postUrl} needs role gallery or certificate.`);
      const stem = fileStem(photo.url || "");
      if (stem && avatarStem && stem === avatarStem) {
        fail(rawPath, `Photo ${index + 1} of ${postUrl} is the face photo. Skip it as duplicate.`);
      }
      if (!photo.base64) fail(rawPath, `Photo ${index + 1} of ${postUrl} has no image bytes.`);
      const bytes = Buffer.from(photo.base64, "base64");
      if (role === "certificate") {
        const caption = cleanLine(keep?.caption || "");
        if (!CERTIFICATE_WORD.test(postSource) || !CERTIFICATE_WORD.test(caption)) {
          fail(rawPath, "A certificate needs the word диплом, сертификат, or удостоверение in the pinned caption and in the document caption.");
        }
        if (caption.length > 80 || !includesNorm(postSource, caption)) {
          fail(rawPath, "Certificate caption must be a verbatim slice of that post, at most 80 characters.");
        }
        certificates.push({ bytes, caption: stripPhones(caption) });
        return;
      }
      if (stem && gallery.some((item) => item.stem === stem)) {
        fail(rawPath, `Photo ${index + 1} of ${postUrl} repeats an image already kept. Skip it as duplicate.`);
      }
      const order = keeps.findIndex((item) => (item.postUrl || "").split("?")[0] === postUrl && item.index === index);
      gallery.push({ bytes, stem, order });
    });
  }
  if (gallery.length > 8) fail(rawPath, "At most 8 gallery photos besides the face.");
  if (certificates.length > 5) fail(rawPath, "At most 5 certificates.");
  if ((avatarPath ? 1 : 0) + gallery.length > 9) fail(rawPath, "A profile stores at most 9 photos.");

  const keptMasters = new Set<string>();
  const galleryPaths: string[] = [];
  gallery.sort((a, b) => a.order - b.order);
  for (const [index, photo] of gallery.entries()) {
    const size = await imageSides(photo.bytes);
    if (!size || size.w < AVATAR_MIN_SIDE || size.h < AVATAR_MIN_SIDE) {
      fail(rawPath, "A gallery photo must be at least 400px on both sides.");
    }
    const master = `${handle}-g${index + 2}.jpg`;
    await storeAvatar(photo.bytes, join(AVATAR_DIR, master));
    keptMasters.add(master);
    galleryPaths.push(`/trainers/instagram/${master}`);
  }
  const certificateRecords: Array<{ path: string; caption: string }> = [];
  for (const [index, photo] of certificates.entries()) {
    const size = await imageSides(photo.bytes);
    if (!size || size.w < AVATAR_MIN_SIDE || size.h < AVATAR_MIN_SIDE) {
      fail(rawPath, "A certificate photo must be at least 400px on both sides.");
    }
    const master = `${handle}-d${index + 1}.jpg`;
    await storeAvatar(photo.bytes, join(AVATAR_DIR, master));
    keptMasters.add(master);
    certificateRecords.push({ path: `/trainers/instagram/${master}`, caption: photo.caption });
  }
  removeStaleExtras(handle, keptMasters);
  const photos = [...(avatarPath ? [avatarPath] : []), ...galleryPaths];
  const fullName = [firstName, lastName].filter(Boolean).join(" ");
  const gender = inferTrainerGender(firstName, corpus);
  const storedNotes = stripPhones(cleanLine(note));
  const storedThreads = stripPhones(threadsText);
  const slug = handle.trim().toLowerCase().replace(/[^a-z0-9._]/g, "").slice(0, 30);
  if (!slug) fail(rawPath, "Instagram nick is empty.");
  await assertUniqueAccount(handle, slug, firstName, lastName, rawPath);

  let previous: { status?: string; claimStatus?: string } = {};
  try {
    previous = JSON.parse(readFileSync(join(DRAFT_DIR, `${handle}.json`), "utf8")) as { status?: string; claimStatus?: string };
  } catch {
    previous = {};
  }
  const status = previous.status === "published" || previous.status === "hidden" || previous.status === "archived" ? previous.status : "draft";
  const claimStatus = previous.claimStatus === "claimed" || previous.claimStatus === "disputed" ? previous.claimStatus : "unclaimed";

  const missing = [
    !firstName ? "firstName" : "",
    !lastName ? "lastName" : "",
    !primary ? "sport" : "",
    !city ? "city" : "",
    priceFrom == null ? "price" : "",
    !avatarPath ? "avatar" : "",
    !phoneValue ? "phone" : "",
    PLACE_CUE.test(evidence) && !address ? "address" : "",
    !emailValue ? "email" : "",
    !telegramValue ? "telegram" : "",
    !gender ? "gender" : "",
    pins.length === 0 ? "pinnedPosts" : "",
  ].filter(Boolean);

  const storedSports = [primary, ...sports.filter((sport) => sport.slug !== primary?.slug)]
    .filter((sport): sport is SportHit => Boolean(sport))
    .slice(0, 4);
  const headline = storedSports.length
    ? trainerIntroPhrase(trainerSportRoles(storedSports.map((sport) => ({ slug: sport.slug, label: sport.label }))))
    : "";

  const draft = {
    source: "instagram",
    sourceUrl: `https://www.instagram.com/${handle}/`,
    handle,
    slug,
    status,
    claimStatus,
    createdSource: "import",
    firstName,
    lastName,
    fullName,
    gender,
    nameQuotes,
    headline: headline === "Тренер" ? "" : headline,
    sourceBio: storedSourceBio,
    sourceAbout: aboutFrames.map(stripPhones),
    sourceThreads: storedThreads,
    operatorNotes: storedNotes,
    threadsUrl: (raw.threads?.url || "").trim(),
    bio: stripPhones(presentation),
    about: trainingParagraphs.map(stripPhones).filter(Boolean),
    pinned: pins.map((post) => ({
      url: post.url || "",
      caption: cleanLine(post.caption || ""),
      imageText: (post.imageText || []).map(cleanLine).filter(Boolean),
    })),
    sports: storedSports.map((sport) => ({
      slug: sport.slug,
      parentSlug: sport.parentSlug,
      label: sport.label,
      evidence: sport.alias,
    })),
    practicedSports: practiced.map((role) => ({
      slug: role.slug,
      label: role.sport.label,
      quote: role.quote,
    })),
    primarySport: primary
      ? { slug: primary.slug, parentSlug: primary.parentSlug, label: primary.label }
      : null,
    city,
    address,
    cityCandidates: cities,
    priceFrom,
    experienceYears,
    formats,
    audiences,
    languages,
    avatarPath,
    photos,
    certificates: certificateRecords,
    photoSearch: {
      face: Boolean(avatarPath),
      pinned: pins.length,
      candidates: photoSources.reduce((sum, post) => sum + (post.photos || []).length, 0),
      gallery: galleryPaths.length,
      certificates: certificateRecords.length,
      skipped: skips.length,
    },
    contacts: {
      instagram: `https://www.instagram.com/${handle}/`,
      phone: phoneValue,
      email: emailValue,
      telegram: telegramValue,
      website: raw.externalUrl || "",
    },
    missing,
  };

  mkdirSync(DRAFT_DIR, { recursive: true });
  const outPath = join(DRAFT_DIR, `${handle}.json`);
  writeFileSync(outPath, `${JSON.stringify(draft, null, 2)}\n`);
  return draft;
}

function updateIndex(drafts: Array<Awaited<ReturnType<typeof saveOne>>>) {
  const indexPath = join(DRAFT_DIR, "index.json");
  type IndexProfile = {
    handle: string;
    slug: string;
    fullName: string;
    primarySport: string;
    city: string;
    status: string;
    missing: string[];
    file: string;
  };
  let profiles: IndexProfile[] = [];
  try {
    profiles = (JSON.parse(readFileSync(indexPath, "utf8")) as { profiles?: IndexProfile[] }).profiles || [];
  } catch {
    profiles = [];
  }
  for (const draft of drafts) {
    const row: IndexProfile = {
      handle: draft.handle,
      slug: draft.slug,
      fullName: draft.fullName,
      primarySport: draft.primarySport?.label || "",
      city: draft.city,
      status: draft.status,
      missing: draft.missing,
      file: `data/instagram-trainers/${draft.handle}.json`,
    };
    profiles = profiles.filter((item) => item.handle !== draft.handle);
    profiles.push(row);
  }
  writeFileSync(indexPath, `${JSON.stringify({ updatedAt: new Date().toISOString(), profiles }, null, 2)}\n`);
}

const inputs = process.argv.slice(2).map((file) => resolve(file));
if (!inputs.length) {
  console.error("Usage: npx tsx .cursor/skills/trenio-instagram-trainers/scripts/save-draft.ts <raw.json> [more.json]");
  process.exit(1);
}

const settlements = loadSettlements();
try {
  const saved = await Promise.all(inputs.map((file) => saveOne(file, settlements)));
  updateIndex(saved);
  for (const draft of saved) {
    const trainingState = draft.about.length ? "yes" : "no";
    const noteState = draft.operatorNotes ? "yes" : "no";
    const threadsState = draft.threadsUrl ? "yes" : "no";
    console.log(`${draft.handle}\t${draft.fullName || "—"}\t${draft.primarySport?.label || "—"}\t${draft.city || "—"}\tgallery:${draft.photoSearch.gallery}\tcertificates:${draft.photoSearch.certificates}\ttraining:${trainingState}\tnotes:${noteState}\tthreads:${threadsState}\tmissing:${draft.missing.join(",") || "none"}`);
  }
} finally {
  await closeDb();
}
