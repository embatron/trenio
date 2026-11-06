import { useEffect, useState } from "react";

export const TABLE_PAGE_SIZE = 50;

export function useTablePage<T>(items: T[], resetKey = "", pageSize = TABLE_PAGE_SIZE) {
  const size = pageSize > 0 ? pageSize : TABLE_PAGE_SIZE;
  const [page, setPage] = useState(1);
  const pages = Math.max(1, Math.ceil(items.length / size));
  const current = Math.min(page, pages);

  useEffect(() => {
    setPage(1);
  }, [resetKey]);

  useEffect(() => {
    if (page > pages) setPage(pages);
  }, [page, pages]);

  const start = (current - 1) * size;
  return {
    page: current,
    pages,
    total: items.length,
    rows: items.slice(start, start + size),
    setPage,
    from: items.length === 0 ? 0 : start + 1,
    to: Math.min(start + size, items.length),
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
  if (total === 0) return null;
  return (
    <nav className="cabinet-pager" aria-label="Страницы">
      <p className="cabinet-pager__summary">Показаны {from}–{to} из {total}</p>
      {pages > 1 ? (
        <div className="cabinet-pager__nav">
          <button type="button" disabled={page <= 1} onClick={() => onPage(page - 1)}>Назад</button>
          <span>{page} из {pages}</span>
          <button type="button" disabled={page >= pages} onClick={() => onPage(page + 1)}>Дальше</button>
        </div>
      ) : null}
    </nav>
  );
}
