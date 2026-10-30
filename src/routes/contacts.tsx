import { createFileRoute, Link } from "@tanstack/react-router";

import { InfoPage } from "@/components/info-page";
import { infoPageCopy, infoPageHead } from "@/lib/seo/pages";

const page = infoPageCopy("contacts");

export const Route = createFileRoute("/contacts")({
  head: () => infoPageHead("contacts"),
  component: ContactsPage,
});

function ContactsPage() {
  return (
    <InfoPage
      title={page.crumb}
      lead="Один адрес для вопросов по каталогу, карточке тренера и персональным данным."
    >
      <section>
        <h2>Почта</h2>
        <p>
          <a className="info-mail" href="mailto:hello@trenio.by">hello@trenio.by</a>
        </p>
        <p>Ответ придёт на ту же почту. Отдельного телефона поддержки нет: занятие и запись согласуют напрямую с тренером.</p>
      </section>
      <section>
        <h2>О чём писать</h2>
        <ul>
          <li>ошибка в карточке или просьба её скрыть;</li>
          <li>чужой профиль, который собрали по открытому Instagram;</li>
          <li>доступ к аккаунту, если письмо или код не дошли;</li>
          <li>вопрос по <Link to="/offer">договору оферты</Link> или <Link to="/privacy">политике конфиденциальности</Link>.</li>
        </ul>
      </section>
      <section>
        <h2>Тренер хочет карточку</h2>
        <p>
          Для новой карточки форма короче письма: <Link to="/join/trainer">оставить Instagram</Link>.
          Если черновик уже собран, откройте персональную ссылку из сообщения и примите оферту там.
        </p>
      </section>
    </InfoPage>
  );
}
