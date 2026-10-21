import { useEffect, useState } from "react";

export const TABLE_PAGE_SIZE = 50;

export function useTablePage<T>(items: T[], resetKey = "") {
  const [page, setPage] = useState(1);
  const pages = Math.max(1, Math.ceil(items.length / TABLE_PAGE_SIZE));
  const current = Math.min(page, pages);

  useEffect(() => {
    setPage(1);
  }, [resetKey]);

  useEffect(() => {
    if (page > pages) setPage(pages);
  }, [page, pages]);

  const start = (current - 1) * TABLE_PAGE_SIZE;
  return {
    page: current,
    pages,
    total: items.length,
    rows: items.slice(start, start + TABLE_PAGE_SIZE),
    setPage,
    from: items.length === 0 ? 0 : start + 1,
    to: Math.min(start + TABLE_PAGE_SIZE, items.length),
  };
}

export function TablePager({
  page,
  pages,
  total,
  from,
  to,
  onPage,
}: {
  page: number;
  pages: number;
  total: number;
  from: number;
  to: number;
  onPage: (page: number) => void;
}) {
  if (total <= TABLE_PAGE_SIZE) return null;
  return (
    <nav className="cabinet-pager" aria-label="Страницы">
      <p>Показаны {from}–{to} из {total}</p>
      <div className="cabinet-pager__nav">
        <button type="button" disabled={page <= 1} onClick={() => onPage(page - 1)}>Назад</button>
        <span>{page} из {pages}</span>
        <button type="button" disabled={page >= pages} onClick={() => onPage(page + 1)}>Дальше</button>
      </div>
    </nav>
  );
}
