import { YandexIcon } from "@/components/brand-icons";
import { openProviderInShell } from "@/lib/native/shell";

/** Starts the Yandex redirect. The same address signs in or creates the account. */
export function YandexLoginButton({
  returnPath,
  door = false,
  browse = false,
  disabled = false,
  onBlocked,
}: {
  returnPath?: string;
  /** Claim the imported trainer card opened by the short link. */
  door?: boolean;
  /** Header sign-in. A client returns to the public page. A trainer still opens the cabinet. */
  browse?: boolean;
  disabled?: boolean;
  onBlocked?: () => void;
}) {
  const params = new URLSearchParams();
  if (returnPath) params.set("redirect", returnPath);
  if (door) params.set("door", "1");
  if (browse) params.set("browse", "1");
  const next = params.size > 0 ? `?${params.toString()}` : "";
  const label = (
    <>
      <YandexIcon />
      Войти через Яндекс
    </>
  );
  if (disabled) {
    return (
      <button type="button" className="auth-google" onClick={onBlocked}>
        {label}
      </button>
    );
  }
  return (
    <a className="auth-google" href={`/auth/yandex${next}`} onClick={(event) => openProviderInShell(event, `/auth/yandex${next}`)}>
      {label}
    </a>
  );
}
