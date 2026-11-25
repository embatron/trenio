/** A check in a rounded square. Green when the account is confirmed and the card is verified. */
export function AccountSeal({ trusted, className }: { trusted: boolean; className?: string }) {
  const label = trusted ? "Аккаунт подтверждён" : "Аккаунт не подтверждён";
  return (
    <span
      className={`account-seal${trusted ? " is-ready" : ""}${className ? ` ${className}` : ""}`}
      title={label}
      role="img"
      aria-label={label}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M20.2 6.7a1.15 1.15 0 0 1 0 1.63l-9.15 9.15a1.15 1.15 0 0 1-1.63 0L3.8 11.86a1.15 1.15 0 1 1 1.63-1.63l4.8 4.8 8.34-8.33a1.15 1.15 0 0 1 1.63 0z" />
      </svg>
    </span>
  );
}
