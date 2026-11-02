/** Live password meter shared by the trainer door and the plain-user credentials step. */
export function PasswordStrength({ password }: { password: string }) {
  const met = [password.length >= 8, /\d/.test(password), /[A-ZА-ЯЁ]/.test(password)].filter(Boolean).length;
  const level = password.length === 0 ? 0 : Math.max(met, 1);
  const width = password.length === 0 ? 0 : met === 0 ? 16 : (met / 3) * 100;
  return (
    <>
      <div className={`door-strength is-${level}`} aria-hidden="true">
        <svg className="door-strength__mark" viewBox="0 0 24 24">
          <path d="M5 16v3" />
          <path d="M12 11v8" />
          <path d="M19 6v13" />
        </svg>
        <span className="door-strength__track">
          <span style={{ width: `${width}%` }} />
        </span>
      </div>
      <style>{`
        .door-strength { display: flex; align-items: center; gap: 10px; min-height: 28px; }
        .door-strength__mark { width: 28px; height: 28px; flex: 0 0 auto; }
        .door-strength__mark path { fill: none; stroke: rgba(var(--dark-rgb), 0.18); stroke-width: var(--icon-stroke); stroke-linecap: round; }
        .door-strength.is-1 .door-strength__mark path:nth-child(-n+1),
        .door-strength.is-2 .door-strength__mark path:nth-child(-n+2),
        .door-strength.is-3 .door-strength__mark path { stroke: currentColor; }
        .door-strength.is-1 { color: #d97706; }
        .door-strength.is-2 { color: #ca8a04; }
        .door-strength.is-3 { color: #15803d; }
        .door-strength__track { flex: 1; height: 6px; border-radius: 999px; background: rgba(var(--dark-rgb), 0.1); overflow: hidden; }
        .door-strength__track > span { display: block; height: 100%; border-radius: inherit; background: currentColor; }
      `}</style>
    </>
  );
}
