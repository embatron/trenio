import { GoogleIcon } from "@/components/brand-icons";

/** Starts the Google redirect. The same address signs in or creates the account. */
export function GoogleLoginButton({
  returnPath,
  disabled = false,
  onBlocked,
}: {
  returnPath?: string;
  disabled?: boolean;
  onBlocked?: () => void;
}) {
  const next = returnPath ? `?redirect=${encodeURIComponent(returnPath)}` : "";
  const label = (
    <>
      <GoogleIcon />
      Войти через Google
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
    <a className="auth-google" href={`/auth/google${next}`}>
      {label}
    </a>
  );
}
