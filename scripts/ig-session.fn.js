() => {
  const text = (document.body?.innerText || "").slice(0, 1500);
  const field = document.querySelector('input[name="username"]');
  const username = field instanceof HTMLInputElement ? field.value.trim() : "";
  const loginWall = !username && /log in|sign up|войти|зарегистрир/i.test(text);
  return { username, loginWall, title: document.title || "" };
}
