/** Handset already used for a confirmed phone. Stroke follows the method tab. */
const PHONE_PATH =
  "M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.3 1.8.5 2.7a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.4-1.4a2 2 0 0 1 2.1-.5c.9.2 1.8.4 2.7.5A2 2 0 0 1 22 16.9z";

export const SMS_METHOD_LABEL = "Войти через SMS";

export function SmsMethodIcon() {
  return (
    <svg className="auth-role__icon" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d={PHONE_PATH}
        fill="none"
        stroke="currentColor"
        strokeWidth="var(--icon-stroke)"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
