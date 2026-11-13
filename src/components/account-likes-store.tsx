import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";

import { sameList } from "@/lib/cabinet/live";
import { listAccountLikesFn, toggleAccountLikeFn, type AccountLikeMark } from "@/lib/catalog/account-likes";

type AccountLikesState = {
  marks: AccountLikeMark[];
  counts: Record<string, number>;
  ready: boolean;
  toggle: (slug: string) => Promise<{ liked: boolean; count: number }>;
  replaceMarks: (marks: AccountLikeMark[]) => void;
};

const AccountLikesContext = createContext<AccountLikesState | null>(null);

export function AccountLikesProvider({
  userId,
  enabled,
  counts: initialCounts,
  children,
}: {
  userId: string | null;
  enabled: boolean;
  counts: Record<string, number>;
  children: ReactNode;
}) {
  const [marks, setMarks] = useState<AccountLikeMark[]>([]);
  const [counts, setCounts] = useState(initialCounts);
  const [ready, setReady] = useState(!userId || !enabled);
  const marksRef = useRef(marks);
  const countsRef = useRef(counts);
  const tickets = useRef(new Map<string, number>());
  marksRef.current = marks;
  countsRef.current = counts;

  useEffect(() => {
    if (!userId || !enabled) {
      setMarks([]);
      setReady(true);
      return;
    }
    let cancelled = false;
    setReady(false);
    void listAccountLikesFn()
      .then((result) => {
        if (cancelled || tickets.current.size > 0) return;
        setMarks(result.marks);
      })
      .catch(() => {
        if (cancelled || tickets.current.size > 0) return;
        setMarks([]);
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, userId]);

  useEffect(() => {
    if (tickets.current.size > 0) return;
    setCounts(initialCounts);
  }, [initialCounts]);

  const replaceMarks = useCallback((marks: AccountLikeMark[]) => {
    if (tickets.current.size > 0) return;
    setMarks((current) => {
      const next = marks.map((mark) => `${mark.slug}:${mark.count}`);
      const prev = current.map((mark) => `${mark.slug}:${mark.count}`);
      return sameList(prev, next) ? current : marks;
    });
    setCounts((current) => {
      const next = { ...current };
      for (const mark of marks) next[mark.slug] = mark.count;
      return next;
    });
  }, []);

  const toggle = useCallback(async (slug: string) => {
    const ticket = (tickets.current.get(slug) ?? 0) + 1;
    tickets.current.set(slug, ticket);
    const previous = marksRef.current.find((mark) => mark.slug === slug);
    const previousCount = countsRef.current[slug] ?? 0;
    setMarks((current) => current.filter((mark) => mark.slug !== slug));
    setCounts((current) => ({
      ...current,
      [slug]: Math.max(0, previousCount + (previous ? -1 : 1)),
    }));
    try {
      const result = await toggleAccountLikeFn({ data: { slug } });
      if (tickets.current.get(slug) !== ticket) return result;
      setMarks((current) => {
        const rest = current.filter((mark) => mark.slug !== slug);
        if (!result.liked) return rest;
        return [{ slug, count: result.count }, ...rest];
      });
      setCounts((current) => ({ ...current, [slug]: result.count }));
      return result;
    } catch (error) {
      if (tickets.current.get(slug) === ticket) {
        setMarks((current) => {
          const rest = current.filter((mark) => mark.slug !== slug);
          return previous ? [previous, ...rest] : rest;
        });
        setCounts((current) => ({ ...current, [slug]: previousCount }));
      }
      throw error;
    } finally {
      if (tickets.current.get(slug) === ticket) tickets.current.delete(slug);
    }
  }, []);

  return (
    <AccountLikesContext.Provider value={{ marks, counts, ready, toggle, replaceMarks }}>
      {children}
    </AccountLikesContext.Provider>
  );
}

export function useAccountLikes() {
  const value = useContext(AccountLikesContext);
  if (!value) throw new Error("Лайкосы доступны только внутри кабинета сайта.");
  return value;
}
