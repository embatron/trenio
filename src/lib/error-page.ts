/**
 * Same document as `public/maintenance.html`. Nginx serves that file when the
 * process is down. This copy is the answer when the process is up but the page throws.
 */
export function renderErrorPage(): string {
  return `<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <meta name="theme-color" content="#f04b50">
  <meta name="robots" content="noindex, nofollow">
  <meta http-equiv="refresh" content="8">
  <title>Сайт на минуту закрыт — trenio.by</title>
  <style>
    html, body { height: 100%; margin: 0; }
    body {
      min-height: 100vh;
      min-height: 100dvh;
      width: 100%;
      display: grid;
      place-items: center;
      background:
        radial-gradient(circle at calc(100% - 12px) 22px, #ffd166 0 36px, transparent 38px),
        linear-gradient(145deg, #ff6a4a 0%, #f04b50 46%, #9b1d3a 100%);
      color: #fff;
      font: 16px/1.5 system-ui, sans-serif;
    }
    body::before {
      content: "";
      position: fixed;
      inset: auto -8% -30% 40%;
      height: 70%;
      border: 18px solid rgba(255, 255, 255, 0.16);
      border-radius: 50%;
      pointer-events: none;
    }
    main {
      position: relative;
      width: 100%;
      box-sizing: border-box;
      padding:
        max(28px, env(safe-area-inset-top))
        max(20px, env(safe-area-inset-right))
        max(28px, env(safe-area-inset-bottom))
        max(20px, env(safe-area-inset-left));
      text-align: center;
    }
    .kicker {
      display: inline-block;
      margin: 0 0 16px;
      padding: 6px 12px;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.16);
      font-size: 13px;
      font-weight: 650;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
    h1 {
      margin: 0 auto 12px;
      max-width: 12ch;
      font-size: clamp(32px, 4.4vw, 48px);
      font-weight: 700;
      letter-spacing: -0.03em;
      line-height: 1.05;
    }
    .lead { margin: 0 auto; max-width: 36ch; color: rgba(255, 255, 255, 0.9); }
    @media (max-width: 720px) {
      body::before { inset: auto -46% -48% 18%; height: 70%; border-width: 14px; }
    }
  </style>
</head>
<body>
  <main>
    <p class="kicker">Обновление</p>
    <h1>Сайт на минуту закрыт</h1>
    <p class="lead">Обновляем trenio.by. Подождите немного: страница откроется сама.</p>
  </main>
</body>
</html>`;
}
