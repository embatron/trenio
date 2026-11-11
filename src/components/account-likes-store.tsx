import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";

import { sameList } from "@/lib/cabinet/live";
import { listAccountLikesFn, toggleAccountLikeFn, type AccountLikeMark } from "@/lib/catalog/account-likes";

type AccountLikesState = {
  marks: AccountLikeMark[];
  ready: boolean;
  toggle: (slug: string) => Promise<{ liked: boolean; count: number | null }>;
  replaceMarks: (marks: AccountLikeMark[]) => void;
};

const AccountLikesContext = createContext<AccountLikesState | null>(null);

export function AccountLikesProvider({
  userId,
  enabled,
  children,
}: {
  userId: string | null;
  enabled: boolean;
  children: ReactNode;
}) {
  const [marks, setMarks] = useState<AccountLikeMark[]>([]);
  const [ready, setReady] = useState(!userId || !enabled);
  const marksRef = useRef(marks);
  const tickets = useRef(new Map<string, number>());
  marksRef.current = marks;

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

  const replaceMarks = useCallback((marks: AccountLikeMark[]) => {
    if (tickets.current.size > 0) return;
    setMarks((current) => {
      const next = marks.map((mark) => `${mark.slug}:${mark.count}`);
      const prev = current.map((mark) => `${mark.slug}:${mark.count}`);
      return sameList(prev, next) ? current : marks;
    });
  }, []);

  const toggle = useCallback(async (slug: string) => {
    const ticket = (tickets.current.get(slug) ?? 0) + 1;
    tickets.current.set(slug, ticket);
    const previous = marksRef.current.find((mark) => mark.slug === slug);
    setMarks((current) => current.filter((mark) => mark.slug !== slug));
    try {
      const result = await toggleAccountLikeFn({ data: { slug } });
      if (tickets.current.get(slug) !== ticket) return result;
      setMarks((current) => {
        const rest = current.filter((mark) => mark.slug !== slug);
        if (!result.liked || result.count == null) return rest;
        return [{ slug, count: result.count }, ...rest];
      });
      return result;
    } catch (error) {
      if (tickets.current.get(slug) === ticket) {
        setMarks((current) => {
          const rest = current.filter((mark) => mark.slug !== slug);
          return previous ? [previous, ...rest] : rest;
        });
      }
      throw error;
    }
  }, []);

  return (
    <AccountLikesContext.Provider value={{ marks, ready, toggle, replaceMarks }}>
      {children}
    </AccountLikesContext.Provider>
  );
}

export function useAccountLikes() {
  const value = useContext(AccountLikesContext);
  if (!value) throw new Error("Лайкосы доступны только внутри кабинета сайта.");
  return value;
}
