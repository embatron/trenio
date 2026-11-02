import { GoogleIcon } from "@/components/brand-icons";

/** Starts the Google redirect. The same address signs in or creates the account. */
export function GoogleLoginButton({ returnPath, disabled = false }: { returnPath?: string; disabled?: boolean }) {
  const next = returnPath ? `?redirect=${encodeURIComponent(returnPath)}` : "";
  const label = (
    <>
      <GoogleIcon />
      Войти через Google
    </>
  );
  if (disabled) {
    return (
      <span className="auth-google is-disabled" aria-disabled="true">
        {label}
      </span>
    );
  }
  return (
    <a className="auth-google" href={`/auth/google${next}`}>
      {label}
    </a>
  );
}
