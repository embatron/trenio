/**
 * Turn a raw Instagram extract into a draft trainer profile.
 * Usage: npx tsx .cursor/skills/trenio-instagram-trainers/scripts/save-draft.ts <raw.json> [more.json]
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { TOP_LEVEL_SPORT_CATEGORIES } from "../../../../src/lib/catalog/sport-taxonomy.ts";

type PinnedPost = {
  url?: string;
  caption?: string;
  ogDescription?: string;
  heading?: string;
  visibleText?: string;
};

type ResolvedProfile = {
  firstName?: string;
  lastName?: string;
  nameQuotes?: string[];
  bio?: string;
  about?: string[];
  sportQuotes?: string[];
  city?: string;
  priceFrom?: number | null;
  phone?: string;
  languages?: string[];
};

type RawExtract = {
  sourceUrl?: string;
  blocked?: string | null;
  ogTitle?: string;
  ogDescription?: string;
  headerText?: string;
  externalUrl?: string;
  highlights?: string[];
  pinned?: PinnedPost[];
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
  where: "profile" | "captions";
};

const ROOT = process.cwd();
const DRAFT_DIR = join(ROOT, "data/instagram-trainers");
const AVATAR_DIR = join(ROOT, "public/trainers/instagram");
const SETTLEMENTS_PATH = join(ROOT, "public/data/belarus-settlements.json");

const ROLE_WORDS =
  /^(тренер|тренерка|coach|trainer|fitness|training|sport|sports|official|instagram|insta)$/i;

const TRANSLIT: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z",
  и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r",
  с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "ts", ч: "ch", ш: "sh", щ: "shch",
  ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya", ў: "u", і: "i",
};

function handleFromUrl(url: string): string {
  const match = url.match(/instagram\.com\/([A-Za-z0-9._]{1,30})\/?/i);
  if (!match) throw new Error(`Not an Instagram profile URL: ${url}`);
  const handle = match[1].toLowerCase();
  if (["p", "reel", "reels", "stories", "explore", "accounts"].includes(handle)) {
    throw new Error(`Need a profile URL, not a ${handle} link: ${url}`);
  }
  return handle;
}

function transliterate(value: string): string {
  return [...value.toLowerCase()].map((char) => TRANSLIT[char] ?? char).join("");
}

function slugify(value: string): string {
  return transliterate(value)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 18)
    .replace(/-+$/g, "");
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
    ...(raw.highlights || []),
    ...pins.flatMap((post) => [post.ogDescription || "", post.heading || "", post.visibleText || "", post.caption || ""]),
  ].join("\n");
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

function matchSports(profile: string, captions: string): SportHit[] {
  const hits: SportHit[] = [];
  const scan = (haystack: string, where: SportHit["where"]) => {
    const lower = haystack.toLowerCase();
    for (const category of TOP_LEVEL_SPORT_CATEGORIES) {
      const phrases = [
        { slug: category.slug, parentSlug: category.slug, label: category.label, titleGenitive: category.titleGenitive, aliases: [category.label, ...(category.aliases || [])] },
        ...category.children.map((child) => ({
          slug: child.slug,
          parentSlug: category.slug,
          label: child.label,
          titleGenitive: child.titleGenitive || child.label,
          aliases: [child.label, ...(child.aliases || [])],
        })),
      ];
      for (const phrase of phrases) {
        for (const alias of phrase.aliases) {
          const needle = alias.trim().toLowerCase();
          if (needle.length < 3) continue;
          if (lower.includes(needle)) {
            hits.push({
              slug: phrase.slug,
              parentSlug: phrase.parentSlug,
              label: phrase.label,
              titleGenitive: phrase.titleGenitive,
              alias,
              where,
            });
          }
        }
      }
    }
  };
  scan(profile, "profile");
  scan(captions, "captions");

  const ranked = [...hits].sort((a, b) => b.alias.length - a.alias.length || a.where.localeCompare(b.where));
  const seen = new Set<string>();
  return ranked.filter((hit) => {
    const key = `${hit.parentSlug}/${hit.slug}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function loadSettlements(): string[] {
  const payload = JSON.parse(readFileSync(SETTLEMENTS_PATH, "utf8")) as { settlements?: string[] };
  return (payload.settlements || []).filter((name) => name.trim().length >= 4);
}

function matchCities(text: string, settlements: string[]): string[] {
  const words = text.toLowerCase().match(/[a-zа-яёўі]{4,}/gi) || [];
  const found = new Set<string>();
  const byLength = [...settlements].sort((a, b) => b.length - a.length);
  for (const word of words) {
    const city = byLength.find((name) => {
      const cityName = name.toLowerCase();
      if (word === cityName) return true;
      // "Минске" matches Минск. A 4-letter stem must be exact, so "белье" is not Бель.
      return cityName.length >= 5 && word.startsWith(cityName) && word.length - cityName.length <= 2;
    });
    if (city) found.add(city);
  }
  return [...found];
}

function matchPrice(text: string): number | null {
  const match = text.match(/(\d{2,4})\s*(?:byn|бел\.?\s*руб|руб\.?)/i);
  return match ? Number(match[1]) : null;
}

function matchPhone(text: string): string {
  const match = text.match(/\+375[\s\-()]?\d{2}[\s\-()]?\d{3}[\s\-]?\d{2}[\s\-]?\d{2}/);
  return match ? match[0].replace(/[^\d+]/g, "").replace(/^(\+375)(\d{2})(\d{3})(\d{2})(\d{2})$/, "$1 $2 $3-$4-$5") : "";
}

function matchLanguages(text: string): string[] {
  const lower = text.toLowerCase();
  const languages: string[] = [];
  if (/русск/.test(lower)) languages.push("Русский");
  if (/english|англ/.test(lower)) languages.push("Английский");
  if (/беларус/.test(lower)) languages.push("Беларуская");
  if (/polish|польск/.test(lower)) languages.push("Польский");
  return languages;
}

function extensionFor(mime: string): string {
  if (mime.includes("png")) return "png";
  if (mime.includes("webp")) return "webp";
  return "jpg";
}

function writeAvatar(handle: string, raw: RawExtract): string {
  if (!raw.avatarBase64) return "";
  const ext = extensionFor(raw.avatarMime || "image/jpeg");
  mkdirSync(AVATAR_DIR, { recursive: true });
  const filename = `${handle}.${ext}`;
  writeFileSync(join(AVATAR_DIR, filename), Buffer.from(raw.avatarBase64, "base64"));
  return `/trainers/instagram/${filename}`;
}

function fail(rawPath: string, message: string): never {
  throw new Error(`${rawPath}: ${message}`);
}

function saveOne(rawPath: string, settlements: string[]) {
  const raw = JSON.parse(readFileSync(rawPath, "utf8")) as RawExtract;
  if (raw.blocked) fail(rawPath, `Instagram blocked the read (${raw.blocked}). Do not invent a profile.`);
  const resolved = raw.resolved;
  if (!resolved) fail(rawPath, "Missing resolved block. Run sequential thinking for this trainer before saving.");

  const sourceUrl = raw.sourceUrl || "";
  const handle = handleFromUrl(sourceUrl);
  const corpus = corpusOf(raw);
  const pins = (raw.pinned || []).slice(0, 3);
  if ((raw.pinned || []).length > 3) fail(rawPath, "More than 3 pinned posts were stored.");

  const firstName = cleanLine(resolved.firstName || "");
  const lastName = cleanLine(resolved.lastName || "");
  const nameQuotes = (resolved.nameQuotes || []).map(cleanLine).filter(Boolean);
  for (const quote of nameQuotes) {
    if (!includesNorm(corpus, quote)) fail(rawPath, `Name quote is not in the profile or pinned posts: ${quote}`);
  }
  const quoted = nameQuotes.join("\n");
  if (firstName && !hasWord(quoted, firstName)) fail(rawPath, `firstName "${firstName}" is not in nameQuotes.`);
  if (lastName && !hasWord(quoted, lastName)) fail(rawPath, `lastName "${lastName}" is not in nameQuotes.`);
  const beside = givenNamesBeside(corpus, lastName);
  if (beside.length > 1) fail(rawPath, `Conflicting given names next to ${lastName}: ${beside.join(", ")}. Leave the draft unsaved.`);
  if (beside.length === 1 && firstName !== beside[0]) {
    fail(rawPath, `Given name next to ${lastName} is ${beside[0]}. Do not leave it empty and do not substitute another name.`);
  }

  const bio = cleanLine(resolved.bio || "");
  const profileSurface = `${raw.ogDescription || ""}\n${raw.headerText || ""}`;
  if (bio && !includesNorm(profileSurface, bio)) fail(rawPath, "bio is not a verbatim piece of the profile text.");

  const about = (resolved.about || []).map(cleanLine);
  if (about.length !== pins.length) fail(rawPath, "about must contain one entry per pinned post, in the same order.");
  pins.forEach((post, index) => {
    const caption = cleanLine(post.caption || "");
    if (about[index] !== caption) fail(rawPath, `about[${index}] must be the pinned caption, copied without changes.`);
    const postSource = `${post.ogDescription || ""}\n${post.heading || ""}\n${post.visibleText || ""}`;
    if (caption && !includesNorm(postSource, caption)) fail(rawPath, `Pinned caption ${index + 1} is not in that post.`);
  });

  const sportQuotes = (resolved.sportQuotes || []).map(cleanLine).filter(Boolean);
  for (const quote of sportQuotes) {
    if (!includesNorm(corpus, quote)) fail(rawPath, `Sport quote is not in the source: ${quote}`);
  }
  const sports = matchSports(sportQuotes.join("\n"), "");
  const expected = matchSports(corpus, "");
  const sameSport = (list: SportHit[]) => list.map((sport) => `${sport.parentSlug}/${sport.slug}`).sort().join("|");
  if (sameSport(sports) !== sameSport(expected)) {
    fail(rawPath, "sportQuotes do not cover every taxonomy phrase present in the profile and pinned posts.");
  }
  const childSports = sports.filter((sport) => sport.slug !== sport.parentSlug);
  const primary = childSports[0] || sports[0] || null;

  const cities = matchCities(corpus, settlements);
  const city = cleanLine(resolved.city || "");
  if (cities.length === 1 && city !== cities[0]) fail(rawPath, `City in the text is ${cities[0]}.`);
  if (cities.length !== 1 && city) fail(rawPath, "City is ambiguous or absent. Leave it empty.");

  const priceInText = matchPrice(corpus);
  const priceFrom = resolved.priceFrom ?? null;
  if (priceFrom !== priceInText) fail(rawPath, `Price must be ${priceInText ?? "empty"}, matching the text.`);

  const phoneInText = matchPhone(corpus);
  const phone = cleanLine(resolved.phone || "");
  if (phone.replace(/\s/g, "") !== phoneInText.replace(/\s/g, "")) fail(rawPath, "Phone does not match the text.");

  const languagesInText = matchLanguages(corpus);
  const languages = resolved.languages || [];
  if (languages.join("|") !== languagesInText.join("|")) fail(rawPath, "Languages do not match the text.");

  const avatarPath = writeAvatar(handle, raw);
  const fullName = [firstName, lastName].filter(Boolean).join(" ");
  let slug = slugify(lastName || handle.split(".")[0]);
  if (firstName && lastName) {
    const both = slugify(`${firstName}-${lastName}`);
    slug = both.length <= 18 && both.length > 0 ? both : slugify(lastName);
  }

  const missing = [
    !firstName ? "firstName" : "",
    !lastName ? "lastName" : "",
    !primary ? "sport" : "",
    !city ? "city" : "",
    priceFrom == null ? "price" : "",
    !avatarPath ? "avatar" : "",
    !phone ? "phone" : "",
    pins.length === 0 ? "pinnedPosts" : "",
  ].filter(Boolean);

  const draft = {
    source: "instagram",
    sourceUrl: `https://www.instagram.com/${handle}/`,
    handle,
    slug,
    status: "draft",
    claimStatus: "unclaimed",
    createdSource: "import",
    firstName,
    lastName,
    fullName,
    nameQuotes,
    headline: primary ? `Тренер по ${primary.titleGenitive}` : "",
    bio,
    about,
    pinned: pins.map((post) => ({ url: post.url || "", caption: cleanLine(post.caption || "") })),
    sports: sports.slice(0, 6).map((sport) => ({
      slug: sport.slug,
      parentSlug: sport.parentSlug,
      label: sport.label,
      evidence: sport.alias,
    })),
    primarySport: primary
      ? { slug: primary.slug, parentSlug: primary.parentSlug, label: primary.label }
      : null,
    city,
    cityCandidates: cities,
    priceFrom,
    languages,
    avatarPath,
    contacts: {
      instagram: `https://www.instagram.com/${handle}/`,
      phone: phoneInText,
      website: raw.externalUrl || "",
    },
    missing,
  };

  mkdirSync(DRAFT_DIR, { recursive: true });
  const outPath = join(DRAFT_DIR, `${handle}.json`);
  writeFileSync(outPath, `${JSON.stringify(draft, null, 2)}\n`);
  return draft;
}

function updateIndex(drafts: ReturnType<typeof saveOne>[]) {
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
const saved = inputs.map((file) => saveOne(file, settlements));
updateIndex(saved);
for (const draft of saved) {
  console.log(`${draft.handle}\t${draft.fullName || "—"}\t${draft.primarySport?.label || "—"}\t${draft.city || "—"}\tmissing:${draft.missing.join(",") || "none"}`);
}
