import { useRouter, useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";

import { useAccountLikes } from "@/components/account-likes-store";
import { useFavorites } from "@/components/favorites-store";
import { isAuthorizationRequired } from "@/lib/auth/errors";
import { redirectToLogin } from "@/lib/auth/return-path";
import { CABINET_HINT_GAP_MS, cabinetLiveDelay, cabinetLiveDetail } from "@/lib/cabinet/live";
import { getCabinetLiveFn, type CabinetLiveSnapshot } from "@/lib/cabinet/live-fns";
import { subscribeCabinet } from "@/lib/messages/live-client";

const CabinetLiveContext = createContext<CabinetLiveSnapshot | null>(null);
const CabinetTickContext = createContext(0);

export function useCabinetLive() {
  return useContext(CabinetLiveContext);
}

export function useCabinetTick() {
  return useContext(CabinetTickContext);
}

/** Refetch the open cabinet's lists when the live count and the loaded count disagree. */
export function useCabinetReload(liveCount: number | null, shown: number) {
  const router = useRouter();
  useEffect(() => {
    if (liveCount == null || liveCount === shown) return;
    void router.invalidate();
  }, [liveCount, shown, router]);
}

export function CabinetLive({ userId, children }: { userId: string | null; children: ReactNode }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const load = useServerFn(getCabinetLiveFn);
  const loadRef = useRef(load);
  loadRef.current = load;
  const { replaceKeys } = useFavorites();
  const { replaceMarks } = useAccountLikes();
  const replaceKeysRef = useRef(replaceKeys);
  const replaceMarksRef = useRef(replaceMarks);
  replaceKeysRef.current = replaceKeys;
  replaceMarksRef.current = replaceMarks;
  const [snapshot, setSnapshot] = useState<CabinetLiveSnapshot | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    setSnapshot(null);
    setTick(0);
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    let stop = false;
    let timer = 0;
    let generation = 0;
    let failures = 0;
    let running = false;
    let queued = false;
    let wantFresh = false;
    let lastOk = 0;
    let plannedAt = 0;
    const detail = cabinetLiveDetail(pathname);

    const plan = (delay: number) => {
      const at = Date.now() + delay;
      if (plannedAt !== 0 && at >= plannedAt) return;
      plannedAt = at;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        plannedAt = 0;
        void run();
      }, delay);
    };

    const run = async () => {
      if (stop) return;
      if (document.visibilityState === "hidden") {
        plan(cabinetLiveDelay(failures));
        return;
      }
      if (running) {
        queued = true;
        return;
      }
      running = true;
      const fresh = wantFresh;
      wantFresh = false;
      const ticket = ++generation;
      try {
        const next = await loadRef.current({ data: { detail, fresh } });
        if (stop || ticket !== generation) return;
        failures = 0;
        lastOk = Date.now();
        replaceKeysRef.current(next.favorites);
        replaceMarksRef.current(next.marks);
        setSnapshot(next);
        setTick((current) => current + 1);
      } catch (error) {
        if (stop || ticket !== generation) return;
        if (isAuthorizationRequired(error)) {
          stop = true;
          redirectToLogin();
          return;
        }
        failures = Math.min(failures + 1, 6);
      } finally {
        running = false;
        if (stop) return;
        if (queued) {
          queued = false;
          void run();
          return;
        }
        plan(cabinetLiveDelay(failures));
      }
    };

    const onVisible = () => {
      if (document.visibilityState === "visible") void run();
    };
    const onHint = () => {
      wantFresh = true;
      if (document.visibilityState === "hidden") return;
      plan(Math.max(0, CABINET_HINT_GAP_MS - (Date.now() - lastOk)));
    };
    document.addEventListener("visibilitychange", onVisible);
    const unsubscribe = subscribeCabinet(onHint);
    void run();
    return () => {
      stop = true;
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
      unsubscribe();
    };
  }, [pathname, userId]);

  return (
    <CabinetTickContext.Provider value={tick}>
      <CabinetLiveContext.Provider value={snapshot}>{children}</CabinetLiveContext.Provider>
    </CabinetTickContext.Provider>
  );
}
