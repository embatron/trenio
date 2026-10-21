/**
 * Turn a raw Instagram extract into a draft trainer profile.
 * Usage: npx tsx .cursor/skills/trenio-instagram-trainers/scripts/save-draft.ts <raw.json> [more.json]
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { formatBelarusPhone } from "../../../../src/lib/auth/phone.ts";
import { inferTrainerGender } from "../../../../src/lib/catalog/trainer-gender.ts";
import { TOP_LEVEL_SPORT_CATEGORIES } from "../../../../src/lib/catalog/sport-taxonomy.ts";

type PinnedPost = {
  url?: string;
  caption?: string;
  ogDescription?: string;
  heading?: string;
  visibleText?: string;
};

type SportRole = {
  slug?: string;
  quote?: string;
};

type ResolvedProfile = {
  firstName?: string;
  lastName?: string;
  nameQuotes?: string[];
  bio?: string;
  about?: string[];
  aboutProfile?: string[];
  sportQuotes?: string[];
  coachedSports?: SportRole[];
  practicedSports?: SportRole[];
  unrelatedSports?: SportRole[];
  primarySportSlug?: string;
  city?: string;
  priceFrom?: number | null;
  phone?: string;
  email?: string;
  telegram?: string;
  languages?: string[];
  experienceYears?: number | null;
  formats?: Array<"individual" | "group">;
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

const HOBBY_CUE = /занима(юсь|ется|лась|лся)|увлека(юсь|ется)|хожу в|для себя|хобби|практикую|испытал[аи]? на себе|в свой тренировочный план/iu;
const COACH_CUE = /тренер|тренирую(?!сь)|тренирует|преподава|инструктор|обучаю|веду (?:занятия|группы|тренировки)|coach\b|trainer\b/iu;

function foldYo(value: string): string {
  return value.replace(/ё/gi, (char) => (char === "Ё" ? "Е" : "е"));
}

function wordPattern(word: string): string {
  const lower = foldYo(word.toLowerCase());
  if (/(?:ий|ый|ой|ая|яя|ое|ее)$/u.test(lower) && lower.length > 4) {
    return `${lower.slice(0, -2)}[а-яе]{1,6}`;
  }
  if (/й$/u.test(lower) && lower.length <= 5) {
    return `${lower.slice(0, -1)}[йюяе][а-яе]{0,2}`;
  }
  if (/[ая]$/u.test(lower) && lower.length > 4) {
    return `${lower.slice(0, -1)}[а-яе]{1,4}`;
  }
  return `${lower}[а-яе]{0,3}`;
}

function aliasRegex(alias: string): RegExp {
  const parts = alias.trim().toLowerCase().split(/\s+/).filter(Boolean).map(wordPattern);
  return new RegExp(`(?<![\\p{L}])${parts.join("[\\s-]*")}(?![\\p{L}])`, "iu");
}

function catalogPhrases(): SportHit[] {
  const phrases: SportHit[] = [];
  for (const category of TOP_LEVEL_SPORT_CATEGORIES) {
    const parents = [
      { slug: category.slug, parentSlug: category.slug, label: category.label, titleGenitive: category.titleGenitive, aliases: [category.label, ...(category.aliases || [])] },
      ...category.children.map((child) => ({
        slug: child.slug,
        parentSlug: category.slug,
        label: child.label,
        titleGenitive: child.titleGenitive || child.label,
        aliases: [child.label, ...(child.aliases || [])],
      })),
    ];
    for (const phrase of parents) {
      for (const alias of phrase.aliases) {
        if (alias.trim().length < 3) continue;
        phrases.push({ slug: phrase.slug, parentSlug: phrase.parentSlug, label: phrase.label, titleGenitive: phrase.titleGenitive, alias });
      }
    }
  }
  return phrases;
}

function matchSports(text: string): SportHit[] {
  const folded = foldYo(text);
  const found: Array<SportHit & { start: number; end: number }> = [];
  for (const phrase of catalogPhrases()) {
    const pattern = new RegExp(aliasRegex(phrase.alias).source, "giu");
    for (const match of folded.matchAll(pattern)) {
      const start = match.index ?? 0;
      found.push({ ...phrase, start, end: start + match[0].length });
    }
  }
  found.sort((a, b) => (b.end - b.start) - (a.end - a.start) || a.start - b.start);
  const taken: Array<{ start: number; end: number }> = [];
  const hits: SportHit[] = [];
  const seen = new Set<string>();
  for (const hit of found) {
    if (taken.some((span) => hit.start < span.end && hit.end > span.start)) continue;
    taken.push({ start: hit.start, end: hit.end });
    const key = `${hit.parentSlug}/${hit.slug}`;
    if (seen.has(key)) continue;
    seen.add(key);
    hits.push({ slug: hit.slug, parentSlug: hit.parentSlug, label: hit.label, titleGenitive: hit.titleGenitive, alias: hit.alias });
  }
  return hits;
}

function clausesOf(text: string): string[] {
  return text.split(/\n+|(?<=[.!?])\s+/u).map((part) => part.trim()).filter(Boolean);
}

function sportIsHobbyOnly(text: string, alias: string): boolean {
  const pattern = aliasRegex(alias);
  const clauses = clausesOf(foldYo(text)).filter((clause) => pattern.test(clause));
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
      if (token === cityName) return true;
      if (cityName.length < 4 || !token.startsWith(cityName)) return false;
      return /^(?:[еуаыию]|ом|ой|ах|ях|ою)$/iu.test(token.slice(cityName.length));
    });
    if (city) found.add(city);
  }
  return [...found];
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
  const stag = text.match(/стаж\s*(\d{1,2})\s*(?:год|года|лет)/iu);
  if (stag) return Number(stag[1]);
  const more = text.match(/более\s*(\d{1,2})\s*лет/iu);
  if (more) return Number(more[1]);
  return null;
}

function matchFormats(text: string): Array<"individual" | "group"> {
  const formats: Array<"individual" | "group"> = [];
  if (/индивидуальн|персональн/iu.test(text)) formats.push("individual");
  if (/группов/iu.test(text)) formats.push("group");
  return formats;
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

function assertUniqueNick(handle: string, slug: string, rawPath: string) {
  let names: string[] = [];
  try {
    names = readdirSync(DRAFT_DIR).filter((name) => name.endsWith(".json") && name !== "index.json");
  } catch {
    return;
  }
  for (const name of names) {
    if (name === `${handle}.json`) continue;
    let other: { handle?: string; slug?: string } = {};
    try {
      other = JSON.parse(readFileSync(join(DRAFT_DIR, name), "utf8")) as { handle?: string; slug?: string };
    } catch {
      continue;
    }
    const otherNick = String(other.slug || other.handle || "").trim().toLowerCase();
    const otherHandle = String(other.handle || "").trim().toLowerCase();
    if (otherNick === slug || otherHandle === handle) {
      fail(rawPath, `Nick ${slug} is already used by ${other.handle || name}.`);
    }
  }
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

  const pinnedAbout = (resolved.about || []).map(cleanLine);
  if (pinnedAbout.length !== pins.length) fail(rawPath, "about must contain one entry per pinned post, in the same order.");
  pins.forEach((post, index) => {
    const caption = cleanLine(post.caption || "");
    if (pinnedAbout[index] !== caption) fail(rawPath, `about[${index}] must be the pinned caption, copied without changes.`);
    const postSource = `${post.ogDescription || ""}\n${post.heading || ""}\n${post.visibleText || ""}`;
    if (caption && !includesNorm(postSource, caption)) fail(rawPath, `Pinned caption ${index + 1} is not in that post.`);
  });
  const aboutFrames = (raw.aboutFrames || []).map(cleanLine).filter(Boolean);
  const aboutProfile = (resolved.aboutProfile || []).map(cleanLine);
  if (aboutProfile.join("\n") !== aboutFrames.join("\n")) {
    fail(rawPath, "aboutProfile must copy aboutFrames, one verbatim frame at a time.");
  }
  const about = [...aboutFrames, ...pinnedAbout];

  const sportQuotes = (resolved.sportQuotes || []).map(cleanLine).filter(Boolean);
  for (const quote of sportQuotes) {
    if (!includesNorm(corpus, quote)) fail(rawPath, `Sport quote is not in the source: ${quote}`);
  }
  const evidence = [profileSurface, ...aboutFrames, ...pins.map((post) => `${post.caption || ""}\n${post.visibleText || ""}`)].join("\n");
  const expected = matchSports(evidence);
  const bySlug = new Map(expected.map((sport) => [sport.slug, sport]));
  const readRoles = (roles: SportRole[] | undefined, label: string) => (roles || []).map((role) => {
    const slug = cleanLine(role.slug || "");
    const quote = cleanLine(role.quote || "");
    const sport = bySlug.get(slug);
    if (!sport) fail(rawPath, `${label} slug ${slug || "empty"} is not a sport phrase in the profile, about text, or pinned posts.`);
    if (!quote || !includesNorm(evidence, quote)) fail(rawPath, `${label} quote for ${slug} is not in the source.`);
    const aliases = catalogPhrases().filter((phrase) => phrase.slug === slug).map((phrase) => phrase.alias);
    if (!aliases.some((alias) => aliasRegex(alias).test(foldYo(quote)))) {
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
    if (sportIsHobbyOnly(evidence, role.sport.alias)) {
      fail(rawPath, `${role.sport.label} is only something this person does, not a sport they coach. Quote: ${role.quote}`);
    }
  }
  const primarySlug = cleanLine(resolved.primarySportSlug || "");
  const primary = coached.find((role) => role.slug === primarySlug)?.sport || null;
  if (coached.length && !primary) fail(rawPath, "primarySportSlug must be one of the coached sports.");
  if (!coached.length && primarySlug) fail(rawPath, "No coached sport, so primarySportSlug stays empty.");
  const sports = coached.map((role) => role.sport);

  const cityHits = matchCities(corpus, settlements);
  const cued = cityHits.filter((name) => cityNamedAsPlace(corpus, name));
  const cities = cued.length === 1 ? cued : cityHits;
  const city = cleanLine(resolved.city || "");
  if (cities.length === 1 && city !== cities[0]) fail(rawPath, `City in the text is ${cities[0]}.`);
  if (cities.length !== 1 && city) fail(rawPath, `City is ambiguous or absent (${cityHits.join(", ") || "none"}). Leave it empty.`);

  const priceInText = matchPrice(corpus);
  const priceFrom = resolved.priceFrom ?? null;
  if (priceFrom !== priceInText) fail(rawPath, `Price must be ${priceInText ?? "empty"}, matching the text.`);

  const contactSurface = [
    corpus,
    ...(raw.contacts?.phones || []),
    ...(raw.contacts?.emails || []),
    ...(raw.contacts?.telegrams || []),
  ].join("\n");
  const phonesInText = [...new Set([...matchPhones(contactSurface), ...(raw.contacts?.phones || []).map((item) => formatBelarusPhone(item)).filter(Boolean)])];
  const phone = formatBelarusPhone(resolved.phone || "");
  if (phonesInText.length === 0 && phone) fail(rawPath, "Phone is not in the profile.");
  if (phonesInText.length === 1 && phone !== phonesInText[0]) fail(rawPath, `Phone in the profile is ${phonesInText[0]}. Save it without confirmation.`);
  if (phonesInText.length > 1 && !phonesInText.includes(phone)) fail(rawPath, `Phone must be one of: ${phonesInText.join(", ")}.`);

  const emailsInText = [...new Set([...matchEmails(contactSurface), ...(raw.contacts?.emails || []).map((item) => item.trim().toLowerCase()).filter(Boolean)])];
  const email = cleanLine(resolved.email || "").toLowerCase();
  if (emailsInText.length === 0 && email) fail(rawPath, "Email is not in the profile.");
  if (emailsInText.length === 1 && email !== emailsInText[0]) fail(rawPath, `Email in the profile is ${emailsInText[0]}. Save it without confirmation.`);
  if (emailsInText.length > 1 && !emailsInText.includes(email)) fail(rawPath, `Email must be one of: ${emailsInText.join(", ")}.`);

  const telegramsInText = [...new Set([...matchTelegrams(contactSurface), ...(raw.contacts?.telegrams || []).map((item) => {
    const handleMatch = item.match(/(?:t\.me|telegram\.me)\/([A-Za-z0-9_]{3,32})/i);
    return handleMatch ? `https://t.me/${handleMatch[1]}` : "";
  }).filter(Boolean)])];
  const telegram = cleanLine(resolved.telegram || "");
  const telegramKey = (value: string) => value.replace(/\/$/, "").toLowerCase();
  if (telegramsInText.length === 0 && telegram) fail(rawPath, "Telegram is not in the profile.");
  if (telegramsInText.length === 1 && telegramKey(telegram) !== telegramKey(telegramsInText[0])) {
    fail(rawPath, `Telegram in the profile is ${telegramsInText[0]}.`);
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

  const experienceInText = matchExperience(evidence);
  const experienceYears = resolved.experienceYears ?? null;
  if (experienceYears !== experienceInText) fail(rawPath, `Experience must be ${experienceInText ?? "empty"}, matching the text.`);

  const formatsInText = matchFormats(evidence);
  const formats = resolved.formats || [];
  if (formats.join("|") !== formatsInText.join("|")) fail(rawPath, "Formats do not match the text.");

  const avatarPath = writeAvatar(handle, raw);
  const fullName = [firstName, lastName].filter(Boolean).join(" ");
  const gender = inferTrainerGender(firstName, corpus);
  const slug = handle.trim().toLowerCase().replace(/[^a-z0-9._]/g, "").slice(0, 30);
  if (!slug) fail(rawPath, "Instagram nick is empty.");
  assertUniqueNick(handle, slug, rawPath);

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
    !emailValue ? "email" : "",
    !telegramValue ? "telegram" : "",
    !gender ? "gender" : "",
    pins.length === 0 ? "pinnedPosts" : "",
  ].filter(Boolean);

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
    headline: primary ? `Тренер по ${primary.titleGenitive}` : "",
    bio: stripPhones(bio),
    about: about.map(stripPhones).filter(Boolean),
    pinned: pins.map((post) => ({ url: post.url || "", caption: cleanLine(post.caption || "") })),
    sports: [primary, ...sports.filter((sport) => sport.slug !== primary?.slug)].filter((sport): sport is SportHit => Boolean(sport)).slice(0, 4).map((sport) => ({
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
    cityCandidates: cities,
    priceFrom,
    experienceYears,
    formats,
    languages,
    avatarPath,
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
