export const HONEYPOT_FIELD = "company_website";

export function HoneypotField() {
  return (
    <input
      className="auth-hp"
      tabIndex={-1}
      autoComplete="off"
      name={HONEYPOT_FIELD}
      defaultValue=""
      aria-hidden
    />
  );
}

export function honeypotFromForm(form: HTMLFormElement): string {
  const value = new FormData(form).get(HONEYPOT_FIELD);
  return typeof value === "string" ? value : "";
}
