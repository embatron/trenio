import "dotenv/config";

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { formatBelarusPhone } from "../lib/auth/phone";
import { closeDb } from "./index";
import { upsertImportedTrainer, type ImportedTrainerDraft } from "./trainer-profiles";
import { PUBLISHED_TRAINERS } from "../lib/catalog/published-trainers";
import { joinTrainerName } from "../lib/catalog/trainer-name";

type DraftFile = {
  handle: string;
  slug: string;
  sourceUrl: string;
  status?: ImportedTrainerDraft["status"];
  claimStatus?: ImportedTrainerDraft["claimStatus"];
  createdSource?: ImportedTrainerDraft["createdSource"];
  firstName: string;
  lastName: string;
  fullName: string;
  gender?: "male" | "female" | "";
  headline: string;
  bio: string;
  about?: string[];
  pinned?: Array<{ url: string; caption: string }>;
  sports?: ImportedTrainerDraft["sports"];
  primarySport?: ImportedTrainerDraft["primarySport"];
  city: string;
  priceFrom?: number | null;
  experienceYears?: number | null;
  formats?: ImportedTrainerDraft["formats"];
  languages?: string[];
  avatarPath?: string;
  contacts?: { instagram?: string; phone?: string; email?: string; telegram?: string; website?: string };
};

const DRAFT_DIR = join(process.cwd(), "data/instagram-trainers");

function publishedExtras(instagramUrl: string) {
  return PUBLISHED_TRAINERS.find((trainer) => trainer.instagram === instagramUrl);
}

async function sync() {
  const files = readdirSync(DRAFT_DIR).filter((name) => name.endsWith(".json") && name !== "index.json");
  for (const file of files) {
    const draft = JSON.parse(readFileSync(join(DRAFT_DIR, file), "utf8")) as DraftFile;
    const instagramUrl = draft.contacts?.instagram || draft.sourceUrl;
    const published = publishedExtras(instagramUrl);
    const saved = await upsertImportedTrainer({
      handle: draft.handle,
      slug: draft.slug,
      sourceUrl: draft.sourceUrl,
      status: draft.status ?? "draft",
      claimStatus: draft.claimStatus ?? "unclaimed",
      createdSource: draft.createdSource ?? "import",
      firstName: draft.firstName,
      lastName: draft.lastName,
      fullName: joinTrainerName(draft.firstName, draft.lastName) || draft.fullName,
      gender: draft.gender,
      headline: draft.headline,
      bio: draft.bio || published?.bio || "",
      sourceBio: draft.bio,
      about: draft.about ?? [],
      pinned: draft.pinned ?? [],
      sports: draft.sports ?? [],
      primarySport: draft.primarySport ?? null,
      audiences: published?.audiences?.length ? published.audiences : ["adult"],
      formats: draft.formats?.length ? draft.formats : published?.formats ?? [],
      city: draft.city,
      citySlug: published?.city.slug,
      district: published?.district ?? "",
      priceFrom: draft.priceFrom ?? published?.priceFrom ?? null,
      languages: draft.languages ?? [],
      avatarPath: draft.avatarPath || published?.photo || "",
      phone: formatBelarusPhone(draft.contacts?.phone || published?.phone || ""),
      email: draft.contacts?.email || "",
      telegram: draft.contacts?.telegram || "",
      website: draft.contacts?.website || "",
      instagramUrl,
      experienceYears: draft.experienceYears || published?.experience || 0,
    });
    console.info(`${saved.created ? "created" : "updated"} ${draft.handle} ${saved.claimPath}`);
  }
}

sync()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDb();
  });
