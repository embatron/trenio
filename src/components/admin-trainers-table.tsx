import { useMemo, useState } from "react";

import { TRAINER_PUBLISH_LABEL, type AdminTrainer } from "@/lib/admin/trainers";
import { getSportTaxonomyChild, listSecondLevelSports, TOP_LEVEL_SPORT_CATEGORIES } from "@/lib/catalog/sport-taxonomy";

const dateFormat = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short", year: "numeric" });

export function AdminTrainersTable({ trainers }: { trainers: AdminTrainer[] }) {
  const [category, setCategory] = useState("");
  const [sport, setSport] = useState("");
  const [sort, setSort] = useState<"date-desc" | "date-asc" | "reviews" | "popularity">("date-desc");
  const sportOptions = useMemo(
    () => listSecondLevelSports().filter((item) => !category || item.parentSlug === category),
    [category],
  );
  const visible = useMemo(() => {
    const rows = trainers.filter((trainer) => {
      const parents = trainer.sportSlugs.map((slug) => getSportTaxonomyChild(slug)?.parentSlug);
      if (category && !parents.includes(category)) return false;
      if (sport && !trainer.sportSlugs.includes(sport)) return false;
      return true;
    });
    const byName = (a: AdminTrainer, b: AdminTrainer) => a.fullName.localeCompare(b.fullName, "ru");
    rows.sort((a, b) => {
      if (sort === "reviews") return b.reviews - a.reviews || byName(a, b);
      if (sort === "popularity") return b.popularity - a.popularity || byName(a, b);
      const left = a.createdAt ? Date.parse(a.createdAt) : 0;
      const right = b.createdAt ? Date.parse(b.createdAt) : 0;
      if (!left && !right) return byName(a, b);
      if (!left) return 1;
      if (!right) return -1;
      return sort === "date-asc" ? left - right : right - left;
    });
    return rows;
  }, [trainers, category, sport, sort]);

  if (trainers.length === 0) {
    return <p className="cabinet-empty">Тренеров пока нет.</p>;
  }

  return (
    <>
      <div className="cabinet-filters">
        <label>
          <span>Категория</span>
          <select
            value={category}
            onChange={(event) => {
              const next = event.target.value;
              setCategory(next);
              if (sport && getSportTaxonomyChild(sport)?.parentSlug !== next && next) setSport("");
            }}
          >
            <option value="">Все категории</option>
            {TOP_LEVEL_SPORT_CATEGORIES.map((item) => (
              <option key={item.slug} value={item.slug}>{item.label}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Тип спорта</span>
          <select value={sport} onChange={(event) => setSport(event.target.value)}>
            <option value="">Все типы</option>
            {sportOptions.map((item) => (
              <option key={item.slug} value={item.slug}>{item.label}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Сортировка</span>
          <select value={sort} onChange={(event) => setSort(event.target.value as typeof sort)}>
            <option value="date-desc">Сначала новые</option>
            <option value="date-asc">Сначала старые</option>
            <option value="reviews">По отзывам</option>
            <option value="popularity">По популярности</option>
          </select>
        </label>
        <p className="cabinet-note">Популярность: число опубликованных отзывов × 10 + средняя оценка.</p>
      </div>
      {visible.length === 0 ? <p className="cabinet-empty">Нет тренеров с таким фильтром.</p> : (
        <div className="cabinet-table-wrap">
          <table className="cabinet-table">
            <thead>
              <tr>
                <th>Тренер</th>
                <th>Город</th>
                <th>Добавлен</th>
                <th>Отзывы</th>
                <th>Популярность</th>
                <th>Публикация</th>
                <th>Аккаунт</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((trainer) => (
                <tr key={trainer.slug}>
                  <td>
                    <div className="cabinet-person">
                      {trainer.avatarPath ? (
                        <img src={trainer.avatarPath} alt="" />
                      ) : (
                        <span className="cabinet-person__mark" aria-hidden="true">{(trainer.fullName || "?").slice(0, 1)}</span>
                      )}
                      <div>
                        <a href={`/admin/trainers/${trainer.slug}`} target="_blank" rel="noopener noreferrer">
                          <strong>{trainer.fullName || trainer.slug}</strong>
                        </a>
                        <span>{trainer.sports || "вид спорта не указан"}</span>
                      </div>
                    </div>
                  </td>
                  <td>{trainer.city || "—"}</td>
                  <td>{trainer.createdAt ? dateFormat.format(new Date(trainer.createdAt)) : "—"}</td>
                  <td>{trainer.reviews}</td>
                  <td>{Number.isInteger(trainer.popularity) ? trainer.popularity : trainer.popularity.toFixed(1)}</td>
                  <td><span className={`cabinet-status cabinet-status--${trainer.status}`}>{TRAINER_PUBLISH_LABEL[trainer.status]}</span></td>
                  <td title={trainer.account ? "Пользователь, который вошёл и забрал эту карточку" : "Карточка есть в каталоге, но к ней ещё не привязан пользователь"}>
                    {trainer.account ? trainer.account.email : "не привязан"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
