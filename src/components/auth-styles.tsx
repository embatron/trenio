const AUTH_CSS = `
.auth-page { min-height: 100vh; display: flex; flex-direction: column; background:
  radial-gradient(circle at 50% -10%, rgba(var(--primary-rgb), 0.16) 0, rgba(255,245,245,0.6) 36%, #fafafa 70%);
}
.auth-main { flex: 1; display: grid; place-items: center; padding: var(--layout-section-y) var(--layout-gutter) clamp(48px, 8vw, 80px); }
.auth-card {
  width: 100%; max-width: 460px; background: #fff; border-radius: 28px;
  padding: clamp(28px, 5vw, 40px) var(--layout-gutter); box-shadow: 0 30px 80px rgba(var(--dark-rgb), 0.10), 0 2px 0 rgba(var(--dark-rgb), 0.02);
  border: 1px solid rgba(var(--dark-rgb), 0.05);
}
.auth-card--wide { max-width: 620px; }
.auth-card__head { text-align: center; margin-bottom: 26px; }
.auth-title { margin: 0 0 8px; font-size: 30px; font-weight: 900; letter-spacing: -0.035em; color: var(--dark); }
.auth-sub { margin: 0; color: var(--muted); font-size: 15px; line-height: 1.5; }
.auth-success { width: 56px; height: 56px; margin: 0 auto 16px; border-radius: 50%; background: rgba(var(--primary-rgb), 0.12); color: var(--primary); display: grid; place-items: center; font-size: 26px; font-weight: 900; }

.auth-social { display: grid; gap: 10px; margin-bottom: 22px; }
.auth-social__btn {
  display: flex; align-items: center; justify-content: center; gap: 10px;
  height: 48px; border-radius: 14px; border: 1px solid rgba(var(--dark-rgb), 0.12);
  background: #fff; color: var(--dark); font-size: 15px; font-weight: 700; cursor: pointer;
  transition: border-color 0.18s ease, transform 0.18s ease, box-shadow 0.18s ease;
}
.auth-social__btn:hover { border-color: rgba(var(--dark-rgb), 0.3); box-shadow: 0 6px 18px rgba(var(--dark-rgb), 0.06); }
.auth-social__icon { width: 22px; height: 22px; border-radius: 50%; background: rgba(var(--dark-rgb), 0.06); display: grid; place-items: center; font-weight: 900; font-size: 13px; }

.auth-divider { display: flex; align-items: center; gap: 12px; margin: 18px 0; color: var(--muted); font-size: 13px; font-weight: 600; }
.auth-divider::before, .auth-divider::after { content: ""; flex: 1; height: 1px; background: rgba(var(--dark-rgb), 0.08); }

.auth-form { display: grid; gap: 16px; }
.auth-form--grid { grid-template-columns: 1fr 1fr; }
.auth-field { display: grid; gap: 6px; }
.auth-field--full { grid-column: 1 / -1; }
.auth-field__label { display: flex; justify-content: space-between; align-items: center; font-size: 13px; font-weight: 700; color: var(--text); }
.auth-field__hint { color: var(--primary); font-size: 13px; font-weight: 700; text-decoration: none; }
.auth-field__hint:hover { text-decoration: underline; }
.auth-field__hint--block { display: block; color: var(--muted); font-weight: 500; }
.auth-field input[type="text"], .auth-field input[type="email"], .auth-field input[type="password"], .auth-field input[type="tel"] {
  width: 100%; height: 48px; border-radius: 14px; border: 1px solid rgba(var(--dark-rgb), 0.12);
  background: #fff; padding: 0 16px; font-size: 15px; color: var(--text); outline: 0;
  transition: border-color 0.18s ease, box-shadow 0.18s ease;
}
.auth-field input:focus { border-color: var(--primary); box-shadow: 0 0 0 4px rgba(var(--primary-rgb), 0.15); }
.auth-field__input-wrap { position: relative; }
.auth-field__input-wrap input { padding-right: 88px; }
.auth-field__toggle { position: absolute; right: 10px; top: 50%; transform: translateY(-50%); border: 0; background: transparent; color: var(--muted); font-weight: 700; font-size: 13px; cursor: pointer; padding: 8px; }
.auth-field__toggle:hover { color: var(--primary); }

.auth-check { display: flex; align-items: flex-start; gap: 10px; font-size: 14px; color: var(--text); cursor: pointer; }
.auth-check input { margin-top: 3px; accent-color: var(--primary); width: 16px; height: 16px; }
.auth-check a { color: var(--primary); text-decoration: none; font-weight: 700; }
.auth-check a:hover { text-decoration: underline; }

.auth-submit {
  height: 50px; border: 0; border-radius: 14px; background: var(--primary); color: #fff;
  font-size: 15px; font-weight: 800; letter-spacing: -0.01em; cursor: pointer;
  transition: background 0.18s ease, transform 0.18s ease, box-shadow 0.18s ease;
  box-shadow: 0 12px 28px rgba(var(--primary-rgb), 0.28);
}
.auth-submit:hover { background: var(--primary-dark); transform: translateY(-1px); }
.auth-submit--ghost { background: transparent; color: var(--primary); border: 1px solid rgba(var(--primary-rgb), 0.3); box-shadow: none; }
.auth-submit--ghost:hover { background: rgba(var(--primary-rgb), 0.06); }

.auth-foot { margin: 22px 0 0; text-align: center; color: var(--muted); font-size: 14px; }
.auth-foot a { color: var(--primary); font-weight: 800; text-decoration: none; }
.auth-foot a:hover { text-decoration: underline; }

.auth-roleswitch { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 22px; }
.auth-role { text-align: left; border-radius: 16px; padding: 14px 14px; border: 2px solid rgba(var(--dark-rgb), 0.08); background: #fff; cursor: pointer; transition: border-color 0.18s ease, background 0.18s ease, transform 0.18s ease; }
.auth-role strong { display: block; font-size: 15px; font-weight: 800; color: var(--dark); margin-bottom: 4px; letter-spacing: -0.01em; }
.auth-role span { display: block; font-size: 13px; color: var(--muted); line-height: 1.35; }
.auth-role.is-active { border-color: var(--primary); background: rgba(var(--primary-rgb), 0.05); }
.auth-roleswitch--3 { grid-template-columns: repeat(3, 1fr); }
.auth-alert { padding: 12px 14px; border-radius: 12px; background: rgba(var(--primary-rgb), 0.08); border: 1px solid rgba(var(--primary-rgb), 0.2); color: var(--dark); font-size: 14px; line-height: 1.45; }
.auth-submit:disabled { opacity: 0.65; cursor: not-allowed; transform: none; }

@media (max-width: 600px) {
  .auth-card { padding: 28px 22px; border-radius: 22px; }
  .auth-title { font-size: 26px; }
  .auth-form--grid { grid-template-columns: 1fr; }
  .auth-roleswitch { grid-template-columns: 1fr; }
  .auth-roleswitch--3 { grid-template-columns: 1fr; }
}
`;

export function AuthStyles() {
  return <style dangerouslySetInnerHTML={{ __html: AUTH_CSS }} />;
}
