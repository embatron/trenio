import { createFileRoute, Link, redirect, useRouteContext, useRouter } from "@tanstack/react-router";
import { useRef, useState } from "react";

import { AuthStyles } from "@/components/auth-styles";
import { HoneypotField, honeypotFromForm } from "@/components/auth/honeypot-field";
import { PasswordStrength } from "@/components/auth/password-strength";
import { CabinetNotice, CabinetStyles } from "@/components/cabinet";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { TrainerCardFields, type TrainerCardValues } from "@/components/trainer-card-fields";
import { storedBelarusPhone } from "@/lib/auth/phone";
import { MAX_TRAINER_SPORTS } from "@/lib/catalog/sport-taxonomy";
import { AuthAlert, useAuthServerFn, useAuthSubmit } from "@/lib/auth/use-auth-form";
import { hasAnyRole, isStaff } from "@/lib/auth/roles";
import { isStandInAccountName } from "@/lib/auth/phone-label";
import { reviewPlainText } from "@/lib/catalog/review-html";
import type { TrainerCertificate } from "@/lib/catalog/certificate-file";
import { becomeTrainerFn, signupTrainerAccountFn } from "@/lib/catalog/trainer-account.functions";
import { NOINDEX_FOLLOW } from "@/lib/seo/head";

export const Route = createFileRoute("/join/account")({
  beforeLoad: ({ context }) => {
    const user = context.user;
    if (!user) return;
    if (isStaff(user.roles)) throw redirect({ to: "/admin" });
    if (hasAnyRole(user.roles, ["trainer"])) throw redirect({ to: "/me/profile" });
    if (hasAnyRole(user.roles, ["club"])) throw redirect({ to: "/me" });
  },
  head: () => ({
    meta: [
      { title: "Создать профиль тренера — Я ищу тренера на trenio.by" },
      NOINDEX_FOLLOW,
      { name: "description", content: "Профиль тренера без Instagram: фото, о себе, виды спорта, адреса, цена и контакты. Подтверждение приходит на почту." },
    ],
  }),
  component: TrainerAccountPage,
});

function TrainerAccountPage() {
  const { user } = useRouteContext({ from: "__root__" });
  return (
    <div className="auth-page join-account">
      <AuthStyles />
      <CabinetStyles />
      <SiteHeader />
      <main className="auth-main">
        <div className="auth-card auth-card--wide">
          <nav className="join-account__crumbs" aria-label="Хлебные крошки">
            <Link to="/">Главная</Link>
            <span aria-hidden="true">/</span>
            <Link to="/join/trainer">Тренерам</Link>
            <span aria-hidden="true">/</span>
            <span className="is-current" aria-current="page">Профиль</span>
          </nav>
          <div className="auth-card__head">
            <h1 className="auth-title">Создать профиль тренера</h1>
          </div>
          {user ? <UpgradeForm firstName={user.firstName} lastName={user.lastName ?? ""} /> : <SignupForm />}
        </div>
      </main>
      <SiteFooter />
      <style>{`
        .join-account__crumbs { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin: 0 0 16px; color: var(--muted); font-size: 14px; }
        .join-account__crumbs a { color: var(--muted); text-decoration: none; }
        .join-account__crumbs a:hover { color: var(--primary); }
        .join-account .join-names { display: grid; grid-template-columns: 1fr; gap: 16px; }
        .join-account .join-names > .auth-field { min-width: 0; }
        .join-account .join-basics { display: grid; gap: 16px; }
        .join-account .join-basics > div { display: grid; gap: 6px; }
        .join-account .cabinet-form { padding: 0; }
        .join-account .auth-check { align-items: center; min-height: 44px; }
        .join-account .auth-check input { width: 22px; height: 22px; margin-top: 0; flex: 0 0 auto; }
        .join-account .auth-foot a { display: inline-flex; align-items: center; min-height: 44px; }
        .join-account .cabinet-modal { position: fixed; inset: 0; z-index: 420; display: grid; place-items: center; overflow: auto; padding: max(16px, env(safe-area-inset-top)) max(16px, env(safe-area-inset-right)) max(16px, env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left)); background: rgba(var(--dark-rgb), 0.45); }
        .join-account .cabinet-modal__card { width: min(440px, 100%); display: grid; gap: 12px; padding: 20px; border-radius: var(--card-radius); background: var(--white); }
        .join-account .cabinet-modal__card h2 { margin: 0; font-size: 18px; color: var(--dark); }
        .join-account .cabinet-modal__card p { margin: 0; color: var(--text); line-height: 1.45; }
        .join-account .cabinet-modal__card button { justify-self: start; min-height: 44px; padding: 0 16px; border: 0; border-radius: 999px; background: var(--primary); color: #fff; font: inherit; font-weight: var(--fw-title); cursor: pointer; }
        @media (min-width: 768px) {
          .join-account .join-names { grid-template-columns: 1fr 1fr; }
        }
        @media (max-width: 767px) {
          .join-account .entity-input input,
          .join-account .cabinet-section input,
          .join-account .cabinet-section textarea,
          .join-account .review-editor .rsw-ce { font-size: 16px; }
        }
      `}</style>
    </div>
  );
}

function SignupForm() {
  const signup = useAuthServerFn(signupTrainerAccountFn);
  const { error, pending, run, setError } = useAuthSubmit();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const [basics, setBasics] = useState(emptyBasics);
  const [bioInvalid, setBioInvalid] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [popup, setPopup] = useState(false);

  return (
    <>
    <form
      className="auth-form"
      onSubmit={(event) => {
        event.preventDefault();
        if (password !== passwordConfirm) {
          setError("Пароли не совпадают.");
          return;
        }
        if (!privacy) {
          setError("Примите политику конфиденциальности.");
          return;
        }
        const basicsError = validateBasics(basics);
        setBioInvalid(basicsError === "Напишите, как вас представить.");
        if (basicsError) {
          setError(basicsError);
          return;
        }
        void run(
          () => signup({
            data: {
              firstName,
              lastName,
              email,
              password,
              passwordConfirm,
              privacy: true,
              honeypot: honeypotFromForm(event.currentTarget),
              ...profilePayload(basics),
            },
          }),
          (result) => {
            if (result && "message" in result) {
              setNotice("Мы отправили письмо со ссылкой. Откройте его и подтвердите создание аккаунта. После этого откроется кабинет с этим профилем.");
              setPopup(true);
            }
          },
        );
      }}
    >
      <HoneypotField />
      <AuthAlert message={error} />
      {notice ? <p className="auth-alert auth-alert--note">{notice}</p> : null}
      {notice ? null : (
        <>
          <NameFields
            firstName={firstName}
            lastName={lastName}
            onFirst={setFirstName}
            onLast={setLastName}
          />
          <ProfileFields
            values={basics}
            bioInvalid={bioInvalid}
            onChange={(next) => {
              if (reviewPlainText(next.bio)) setBioInvalid(false);
              setBasics(next);
            }}
          />
          <label className="auth-field">
            <span className="auth-field__label">Email</span>
            <input
              type="email"
              required
              autoComplete="email"
              inputMode="email"
              placeholder="you@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <PasswordFields
            password={password}
            passwordConfirm={passwordConfirm}
            show={showPassword}
            onPassword={setPassword}
            onConfirm={setPasswordConfirm}
            onToggle={() => setShowPassword((value) => !value)}
          />
          <PrivacyConsent privacy={privacy} onPrivacy={setPrivacy} />
          <button type="submit" className="auth-submit" disabled={pending}>
            {pending ? "Создание…" : "Создать аккаунт"}
          </button>
        </>
      )}
    </form>
    {popup && notice ? (
      <CabinetNotice
        title="Проверьте почту"
        message={notice}
        onClose={() => setPopup(false)}
      />
    ) : null}
    <p className="auth-foot">
      <Link to="/auth/login" search={{ redirect: "/join/account" }}>
        У меня уже есть аккаунт
      </Link>
    </p>
    </>
  );
}

function UpgradeForm({ firstName: initialFirst, lastName: initialLast }: { firstName: string; lastName: string }) {
  const become = useAuthServerFn(becomeTrainerFn);
  const router = useRouter();
  const [firstName, setFirstName] = useState(isStandInAccountName(initialFirst) ? "" : initialFirst);
  const [lastName, setLastName] = useState(initialLast);
  const [basics, setBasics] = useState(emptyBasics);
  const [bioInvalid, setBioInvalid] = useState(false);
  const { error, pending, run, redirectTo, setError } = useAuthSubmit();

  return (
    <form
      className="auth-form"
      onSubmit={(event) => {
        event.preventDefault();
        const basicsError = validateBasics(basics);
        setBioInvalid(basicsError === "Напишите, как вас представить.");
        if (basicsError) {
          setError(basicsError);
          return;
        }
        void run(
          () => become({ data: { firstName, lastName, ...profilePayload(basics) } }),
          async (result) => {
            if (!result || !("redirectTo" in result)) return;
            await router.invalidate();
            redirectTo(result.redirectTo);
          },
        );
      }}
    >
      <AuthAlert message={error} />
      <p className="auth-sub">Этот аккаунт станет кабинетом тренера. Instagram не нужен.</p>
      <NameFields firstName={firstName} lastName={lastName} onFirst={setFirstName} onLast={setLastName} />
      <ProfileFields
        values={basics}
        bioInvalid={bioInvalid}
        onChange={(next) => {
          if (reviewPlainText(next.bio)) setBioInvalid(false);
          setBasics(next);
        }}
      />
      <button type="submit" className="auth-submit" disabled={pending}>
        {pending ? "Открываем…" : "Открыть кабинет тренера"}
      </button>
    </form>
  );
}

function NameFields({
  firstName,
  lastName,
  onFirst,
  onLast,
}: {
  firstName: string;
  lastName: string;
  onFirst: (value: string) => void;
  onLast: (value: string) => void;
}) {
  return (
    <div className="join-names">
      <label className="auth-field">
        <span className="auth-field__label">Имя</span>
        <input type="text" required autoComplete="given-name" value={firstName} onChange={(event) => onFirst(event.target.value)} />
      </label>
      <label className="auth-field">
        <span className="auth-field__label">Фамилия</span>
        <input type="text" autoComplete="family-name" value={lastName} onChange={(event) => onLast(event.target.value)} />
      </label>
    </div>
  );
}

function PasswordFields({
  password,
  passwordConfirm,
  show,
  onPassword,
  onConfirm,
  onToggle,
}: {
  password: string;
  passwordConfirm: string;
  show: boolean;
  onPassword: (value: string) => void;
  onConfirm: (value: string) => void;
  onToggle: () => void;
}) {
  const mismatch = passwordConfirm.length > 0 && password !== passwordConfirm;
  return (
    <>
      <label className="auth-field">
        <span className="auth-field__label">Пароль</span>
        <div className="auth-field__input-wrap">
          <input
            type={show ? "text" : "password"}
            required
            minLength={8}
            maxLength={128}
            autoComplete="new-password"
            value={password}
            onChange={(event) => onPassword(event.target.value)}
          />
          <button type="button" className="auth-field__toggle" onClick={onToggle}>
            {show ? "Скрыть" : "Показать"}
          </button>
        </div>
        <PasswordStrength password={password} />
      </label>
      <label className="auth-field">
        <span className="auth-field__label">Пароль ещё раз</span>
        <input
          type={show ? "text" : "password"}
          required
          minLength={8}
          maxLength={128}
          autoComplete="new-password"
          aria-invalid={mismatch}
          value={passwordConfirm}
          onChange={(event) => onConfirm(event.target.value)}
        />
        {mismatch ? <span className="auth-field__hint auth-field__hint--block">Пароли пока не совпадают.</span> : null}
      </label>
    </>
  );
}

type SignupPhoto = { path: string; image: string };
type SignupCertificate = TrainerCertificate & { fileName: string; dataUrl: string };

type JoinProfile = TrainerCardValues & {
  phone: string;
  photos: SignupPhoto[];
  certificates: SignupCertificate[];
};

const emptyBasics: JoinProfile = {
  firstName: "",
  lastName: "",
  headline: "",
  bio: "",
  about: "",
  sportSlugs: [],
  city: "",
  district: "",
  places: [],
  priceFrom: null,
  experienceYears: 0,
  instagram: "",
  telegram: "",
  email: "",
  phone: "",
  formats: [],
  audiences: [],
  photos: [],
  certificates: [],
};

function validateBasics(values: JoinProfile): string | null {
  if (!reviewPlainText(values.bio)) return "Напишите, как вас представить.";
  if (values.sportSlugs.length < 1) return "Выберите хотя бы один вид спорта.";
  if (values.sportSlugs.length > MAX_TRAINER_SPORTS) return "Можно выбрать не больше пяти видов спорта.";
  if (!values.city.trim()) return "Выберите город из списка населённых пунктов Беларуси.";
  if (values.formats.length < 1) return "Выберите формат тренировок.";
  if (values.audiences.length < 1) return "Выберите, с кем вы работаете.";
  if (values.photos.length < 1) return "Загрузите хотя бы одно фото.";
  const typedPhone = values.phone.trim();
  if (typedPhone && typedPhone !== "+375" && !storedBelarusPhone(typedPhone)) {
    return "Введите мобильный номер Беларуси или оставьте поле пустым.";
  }
  return null;
}

function profilePayload(values: JoinProfile) {
  const phone = storedBelarusPhone(values.phone) ?? "";
  return {
    headline: values.headline,
    bio: values.bio,
    about: values.about,
    sportSlugs: values.sportSlugs,
    city: values.city,
    places: values.places.map((place) => ({
      city: place.city,
      district: place.district,
      address: place.address,
      lat: place.lat,
      lng: place.lng,
    })),
    priceFrom: values.priceFrom,
    experienceYears: values.experienceYears,
    phone,
    instagram: values.instagram,
    telegram: values.telegram,
    formats: values.formats,
    audiences: values.audiences,
    photos: values.photos.map((item) => item.image),
    certificates: values.certificates.map((item) => ({
      fileName: item.fileName,
      caption: item.caption,
      dataUrl: item.dataUrl,
    })),
  };
}

function ProfileFields({
  values,
  bioInvalid,
  onChange,
}: {
  values: JoinProfile;
  bioInvalid: boolean;
  onChange: (values: JoinProfile) => void;
}) {
  const latest = useRef(values);
  latest.current = values;
  function commit(partial: Partial<JoinProfile>) {
    const next = { ...latest.current, ...partial };
    latest.current = next;
    onChange(next);
  }
  return (
    <div className="cabinet-form">
    <TrainerCardFields
      signup
      priceLabel="Сколько у меня стоит разовое занятие (персональная тренировка), BYN?"
      values={values}
      bioInvalid={bioInvalid}
      onChange={(next) => {
        const { photos: _photos, certificates: _certificates, phone: _phone, ...rest } = next as JoinProfile;
        commit(rest);
      }}
      phone={{ linked: false, value: values.phone, onChange: (phone) => commit({ phone }) }}
      photos={{
        initial: values.photos.map((item) => item.path),
        onUpload: async (image) => {
          const path = `/signup-photo/${crypto.randomUUID()}`;
          commit({ photos: [...latest.current.photos, { path, image }] });
          return path;
        },
        onRemove: async (path) => {
          const target = path.split("?")[0];
          commit({ photos: latest.current.photos.filter((item) => item.path !== target) });
        },
        onReorder: async (paths) => {
          const order = new Map(latest.current.photos.map((item) => [item.path, item]));
          commit({
            photos: paths.map((item) => order.get(item.split("?")[0])).filter((item): item is SignupPhoto => Boolean(item)),
          });
        },
      }}
      certificates={{
        initial: values.certificates.map((item) => ({ path: item.path, caption: item.caption })),
        onUpload: async (file, caption) => {
          const path = `/signup-certificate/${crypto.randomUUID()}`;
          commit({
            certificates: [...latest.current.certificates, { path, caption, fileName: file.name, dataUrl: file.dataUrl }],
          });
          return { path, caption };
        },
        onCaption: async (path, caption) => {
          const target = path.split("?")[0];
          commit({
            certificates: latest.current.certificates.map((item) => item.path === target ? { ...item, caption } : item),
          });
        },
        onRemove: async (path) => {
          const target = path.split("?")[0];
          commit({ certificates: latest.current.certificates.filter((item) => item.path !== target) });
        },
      }}
    />
    </div>
  );
}

function PrivacyConsent({ privacy, onPrivacy }: { privacy: boolean; onPrivacy: (value: boolean) => void }) {
  return (
    <label className="auth-check">
      <input type="checkbox" required checked={privacy} onChange={(event) => onPrivacy(event.target.checked)} />
      <span>Согласен на обработку данных по <Link to="/privacy">политике конфиденциальности</Link></span>
    </label>
  );
}
