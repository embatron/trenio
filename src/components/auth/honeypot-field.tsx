import { HONEYPOT_FIELD } from "@/lib/auth/honeypot";

/** Visually hidden trap field. Do not label it as honeypot in the DOM. */
export function HoneypotField() {
  return (
    <div className="sr-only" aria-hidden="true">
      <label htmlFor={HONEYPOT_FIELD}>Сайт компании</label>
      <input
        id={HONEYPOT_FIELD}
        name={HONEYPOT_FIELD}
        type="text"
        tabIndex={-1}
        autoComplete="off"
        defaultValue=""
      />
    </div>
  );
}

export function honeypotFromForm(form: HTMLFormElement): string {
  const value = new FormData(form).get(HONEYPOT_FIELD);
  return typeof value === "string" ? value : "";
}
