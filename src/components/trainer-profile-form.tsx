import { useState } from "react";

import { InstagramIcon, TelegramIcon } from "@/components/brand-icons";
import { CabinetNotice } from "@/components/cabinet";
import { CityEntityInput } from "@/components/city-entity-input";
import { SportEntityInput } from "@/components/sport-entity-input";
import { TrainerMediaField } from "@/components/trainer-media-field";
import { addAdminTrainerCertificateFn, MAX_TRAINER_CERTIFICATES, removeAdminTrainerCertificateFn } from "@/lib/admin/trainers";
import { authErrorMessage } from "@/lib/auth/errors";
import { saveOwnTrainerProfileFn, type OwnTrainerProfile } from "@/lib/catalog/trainer-own";
import { useAuthServerFn } from "@/lib/auth/use-auth-form";

type Profile = OwnTrainerProfile;

function atLeastOne(raw: string, max: number) {
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1) return 1;
  return Math.min(value, max);
}

async function fileToJpeg(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Не удалось прочитать изображение."));
      img.src = url;
    });
    const max = 960;
    const scale = Math.min(1, max / Math.max(image.width, image.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Не удалось обработать изображение.");
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.86);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function TrainerProfileForm({ profile }: { profile: Profile }) {
  const save = useAuthServerFn(saveOwnTrainerProfileFn);
  const addCertificate = useAuthServerFn(addAdminTrainerCertificateFn);
  const removeCertificate = useAuthServerFn(removeAdminTrainerCertificateFn);
  const [form, setForm] = useState(profile);
  const [image, setImage] = useState<string | undefined>();
  const [preview, setPreview] = useState(profile.avatarPath);
  const [pending, setPending] = useState(false);
  const [popup, setPopup] = useState<{ title: string; message: string } | null>(null);

  function setField<K extends "fullName" | "headline" | "bio" | "about" | "district" | "phone" | "instagram" | "telegram">(key: K, value: Profile[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  return (
    <>
      <form
        className="cabinet-form"
        onSubmit={(event) => {
          event.preventDefault();
          setPending(true);
          const { avatarPath: _avatarPath, slug: _slug, certificates: _certificates, ...fields } = form;
          void save({ data: { ...fields, image } })
            .then((result) => {
              const payload = result as { message: string; avatarPath: string };
              setPopup({ title: "Готово", message: payload.message });
              if (payload.avatarPath) setPreview(payload.avatarPath);
              setImage(undefined);
            })
            .catch((err: unknown) => setPopup({ title: "Не получилось", message: authErrorMessage(err) }))
            .finally(() => setPending(false));
        }}
      >
        <div className="cabinet-avatar">
          {preview ? <img className="cabinet-avatar__photo" src={preview} alt="" /> : <span className="cabinet-avatar__mark" aria-hidden="true">{form.fullName.slice(0, 1) || "?"}</span>}
          <label className="cabinet-edit">
            Фото карточки
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (!file) return;
                void fileToJpeg(file).then((data) => {
                  setImage(data);
                  setPreview(data);
                }).catch((err: unknown) => setPopup({ title: "Не получилось", message: authErrorMessage(err) }));
              }}
            />
          </label>
        </div>
        <label><span>Имя и фамилия</span><input value={form.fullName} maxLength={200} onChange={(event) => setField("fullName", event.target.value)} /></label>
        <label><span>Заголовок</span><input value={form.headline} maxLength={200} placeholder="Тренер по боксу" onChange={(event) => setField("headline", event.target.value)} /></label>
        <label><span>О себе</span><textarea value={form.bio} maxLength={4000} onChange={(event) => setField("bio", event.target.value)} /></label>
        {form.slug ? (
          <div className="cabinet-media-block">
            <span className="cabinet-media__label">Сертификаты и дипломы</span>
            <TrainerMediaField
              initial={form.certificates}
              max={MAX_TRAINER_CERTIFICATES}
              addLabel="Загрузить документ"
              doneLabel="Документ загружен"
              onUpload={async (image) => {
                const result = await addCertificate({ data: { slug: form.slug, image } }) as { certificate: string };
                return result.certificate;
              }}
              onRemove={async (path) => {
                await removeCertificate({ data: { slug: form.slug, path } });
              }}
            />
          </div>
        ) : null}
        <label><span>О занятиях</span><textarea value={form.about} maxLength={8000} placeholder="Каждый закреплённый пост — с новой строки, абзацы через пустую строку" onChange={(event) => setField("about", event.target.value)} /></label>
        <p className="cabinet-note">Более подробное описание позволит лучше раскрыть вас и собрать отклики.</p>
        <label>
          <span>Виды спорта</span>
          <SportEntityInput value={form.sportSlugs} onChange={(sportSlugs) => setForm((current) => ({ ...current, sportSlugs }))} />
        </label>
        <p className="cabinet-note">Не больше четырёх, из категорий второго уровня.</p>
        <label>
          <span>Город</span>
          <CityEntityInput value={form.city} onChange={(city) => setForm((current) => ({ ...current, city }))} />
        </label>
        <p className="cabinet-note">Только населённый пункт Беларуси.</p>
        <label><span>Район</span><input value={form.district} maxLength={120} onChange={(event) => setField("district", event.target.value)} /></label>
        <label>
          <span>Цена от, BYN</span>
          <input type="number" inputMode="numeric" min={1} max={1000000} step={1} value={form.priceFrom} onChange={(event) => setForm((current) => ({ ...current, priceFrom: atLeastOne(event.target.value, 1_000_000) }))} />
        </label>
        <label><span>Телефон на карточке</span><input value={form.phone} maxLength={32} onChange={(event) => setField("phone", event.target.value)} /></label>
        <label>
          <span>Instagram</span>
          <div className="cabinet-brand-field">
            <InstagramIcon />
            <input value={form.instagram} maxLength={300} placeholder="https://instagram.com/…" onChange={(event) => setField("instagram", event.target.value)} />
          </div>
        </label>
        <label>
          <span>Telegram</span>
          <div className="cabinet-brand-field">
            <TelegramIcon />
            <input value={form.telegram} maxLength={300} placeholder="https://t.me/…" onChange={(event) => setField("telegram", event.target.value)} />
          </div>
        </label>
        <label>
          <span>Общий тренерский стаж, лет</span>
          <input type="number" inputMode="numeric" min={1} max={80} step={1} value={form.experienceYears} onChange={(event) => setForm((current) => ({ ...current, experienceYears: atLeastOne(event.target.value, 80) }))} />
        </label>
        <button className="cabinet-form__submit" type="submit" disabled={pending}>{pending ? "Сохранение…" : "Сохранить профиль"}</button>
        <p className="cabinet-note">Это публичная карточка. Параметры аккаунта — имя для входа, почта, телефон и пароль — в соседнем разделе.</p>
      </form>
      {popup ? <CabinetNotice title={popup.title} message={popup.message} onClose={() => setPopup(null)} /> : null}
    </>
  );
}
