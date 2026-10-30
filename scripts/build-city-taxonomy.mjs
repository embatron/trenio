/**
 * Writes src/lib/catalog/city-taxonomy.ts from the GeoNames Belarus dump.
 * Cities are capitals, oblast and rayon centers, plus towns with 10k+ people.
 * Requires .cache/geonames-BY.zip (npm run settlements:import downloads it).
 */
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const zipPath = path.join(root, ".cache/geonames-BY.zip");
const outPath = path.join(root, "src/lib/catalog/city-taxonomy.ts");

const RU = /^[А-ЯЁ][а-яё]+(?:[ \-][А-ЯЁ][а-яё]+)*$/;
const BY_LETTERS = new Set("іўґІЎҐ");
const SKIP_NAMES = new Set(["Брест-Литовск", "Берестя", "Гародня", "Игумен", "Минскай"]);
const SKIP_GEONAMES = new Set(["Kalodzishchy", "Lyasny", "Machulishchy", "Kastsyukowka", "Rahozna"]);

const PREFERRED = {
  Bobruysk: "Бобруйск",
  "Homyel'": "Гомель",
  Hrodna: "Гродно",
  Mahilyow: "Могилёв",
  Mazyr: "Мозырь",
  Vaukavysk: "Волковыск",
  Volozhin: "Воложин",
  Novogrudok: "Новогрудок",
  Novopolotsk: "Новополоцк",
  Polotsk: "Полоцк",
  Pastavy: "Поставы",
  Rahachow: "Рогачёв",
  Soligorsk: "Солигорск",
  Svetlogorsk: "Светлогорск",
  Tolochin: "Толочин",
  Stowbtsy: "Столбцы",
  Voronovo: "Вороново",
  Oshmyany: "Ошмяны",
  Astraviec: "Островец",
  Dokshytsy: "Докшицы",
  Klimovichi: "Климовичи",
  Logoysk: "Логойск",
  Lyakhovichi: "Ляховичи",
  Mscislau: "Мстиславль",
  Miory: "Миоры",
  Slawharad: "Славгород",
  Shchuchyn: "Щучин",
  Chausy: "Чаусы",
  Gorodok: "Городок",
  Hantsavichy: "Ганцевичи",
  "Maladziečna": "Молодечно",
  Malorita: "Малорита",
  Mosty: "Мосты",
  Bykhov: "Быхов",
  Korma: "Корма",
  Krasnapollye: "Краснополье",
  Liozno: "Лиозно",
  Byelaazyorsk: "Белоозёрск",
  "Buda-Kashalyova": "Буда-Кошелёво",
  "Červień": "Червень",
  Svislach: "Свислочь",
  "Žytkavičy": "Житковичи",
  Kalinkovichi: "Калинковичи",
  Korelichi: "Кореличи",
  "Kopyl’": "Копыль",
  Kamenets: "Каменец",
  Dzyarzhynsk: "Дзержинск",
  Dyatlovo: "Дятлово",
  Glusk: "Глуск",
  Hlybokaye: "Глубокое",
  Krugloye: "Круглое",
  Myadzyel: "Мядель",
  Narovlya: "Наровля",
  Rossony: "Россоны",
  "Smaliavičy": "Смолевичи",
  "Vyalikaya Byerastavitsa": "Большая Берестовица",
  "Mar’ina Gorka": "Марьина Горка",
  "Staryye Dorogi": "Старые Дороги",
  "Horad Krychaw": "Кричев",
  "Horad Zhodzina": "Жодино",
  "Baran’": "Барань",
  Byaroza: "Берёза",
  Byarozawka: "Берёзовка",
  "Zel’va": "Зельва",
  Kobryn: "Кобрин",
  "Lel’chitsy": "Лельчицы",
  "Lyuban’": "Любань",
  "Lyepyel’": "Лепель",
  "Novolukoml’": "Новолукомль",
  Belynichi: "Белыничи",
  Ushachi: "Ушачи",
  Senno: "Сенно",
  Baranovichi: "Барановичи",
  Barysaw: "Борисов",
  Orsha: "Орша",
  Zhlobin: "Жлобин",
  Lida: "Лида",
  Slutsk: "Слуцк",
  Slonim: "Слоним",
  Rechytsa: "Речица",
  Minsk: "Минск",
  Brest: "Брест",
  Vitebsk: "Витебск",
  Horki: "Горки",
  Pinsk: "Пинск",
};

function candidates(alts) {
  const seen = new Set();
  const out = [];
  for (const part of alts.split(",")) {
    const name = part.trim();
    if (!name || [...name].some((ch) => BY_LETTERS.has(ch)) || SKIP_NAMES.has(name)) continue;
    if (RU.test(name) && !seen.has(name)) {
      seen.add(name);
      out.push(name);
    }
  }
  return out;
}

function pickName(latin, alts) {
  if (PREFERRED[latin]) return PREFERRED[latin];
  const list = candidates(alts).filter(
    (name) =>
      !listHasSofterForm(name, candidates(alts)),
  );
  list.sort((a, b) => Number(b.includes("ё") || b.includes("ь")) - Number(a.includes("ё") || a.includes("ь")) || b.length - a.length);
  return list[0] ?? null;
}

function listHasSofterForm(name, list) {
  return list.some((other) => other !== name && (other === `${name}ь` || (other.includes("ё") && other.replaceAll("ё", "е") === name)));
}

const text = execFileSync("unzip", ["-p", zipPath, "BY.txt"], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
const places = [];
const seen = new Set();

for (const line of text.split("\n")) {
  if (!line) continue;
  const cols = line.split("\t");
  if (cols[6] !== "P") continue;
  const latin = cols[1];
  const code = cols[7];
  const population = Number(cols[14] || 0);
  if (SKIP_GEONAMES.has(latin)) continue;
  if (!["PPLC", "PPLA", "PPLA2"].includes(code) && !(code === "PPL" && population >= 10000)) continue;
  const name = pickName(latin, cols[3] ?? "");
  if (!name || seen.has(name)) continue;
  seen.add(name);
  places.push({ name, code, population });
}

const oblastCenter = new Set(["PPLC", "PPLA"]);
places.sort((a, b) => {
  const group = Number(!oblastCenter.has(a.code)) - Number(!oblastCenter.has(b.code));
  if (group !== 0) return group;
  return b.population - a.population || a.name.localeCompare(b.name, "ru");
});

const names = places.map((place) => place.name);
const oblastCenters = places.filter((place) => oblastCenter.has(place.code)).map((place) => place.name);
const quick = names.slice(0, 10);
const list = (items) => items.map((name) => `  ${JSON.stringify(name)},`).join("\n");
const source = `import { foldSearchText, leadingTarget, rankTargets } from "@/lib/catalog/query-flex";

/** Belarus cities for filters and search. Generated by scripts/build-city-taxonomy.mjs.
 * Oblast centers come first, largest to smallest, then every other city the same way. */
export const BELARUS_CITIES = [
${list(names)}
] as const;

export type BelarusCityName = (typeof BELARUS_CITIES)[number];

/** Regional centers, largest first. */
export const BELARUS_OBLAST_CENTERS = [
${list(oblastCenters)}
] as const;

/** Oblast centers and the next largest cities. Shown before the visitor types. */
export const BELARUS_QUICK_CITIES = [
${list(quick)}
] as const;

function cityQuery(query: string): string {
  let text = foldSearchText(query);
  for (let pass = 0; pass < 3; pass += 1) {
    const next = text.replace(/^(?:в|г)\\s+/, "");
    if (next === text) break;
    text = next;
  }
  return text;
}

export function filterBelarusCities(query: string, limit = 8): string[] {
  const q = cityQuery(query);
  if (!q) return [...BELARUS_QUICK_CITIES];
  return rankTargets(q, BELARUS_CITIES, (name) => ({ label: name }))
    .slice(0, limit)
    .map((row) => row.item);
}

/** One Belarus city the typed query clearly means. A shared prefix stays unresolved. */
export function resolveBelarusCity(query: string): string | null {
  const q = cityQuery(query);
  if (!q) return null;
  return leadingTarget(rankTargets(q, BELARUS_CITIES, (name) => ({ label: name })), q);
}
`;

writeFileSync(outPath, source);
console.log(`Wrote ${names.length} cities → ${path.relative(root, outPath)}`);
