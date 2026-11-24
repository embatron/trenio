import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

import {
  MAP_PEOPLE_ROW_ESTIMATE,
  mapPeopleColumns,
  mapPeopleGap,
  mapPeopleWindow,
} from "@/lib/catalog/map-window";

type WindowBox = {
  scrollTop: number;
  listTop: number;
  viewHeight: number;
  width: number;
  rowHeight: number;
};

function readFrame(frame: HTMLElement | null, rowHeight: number): WindowBox {
  if (typeof window === "undefined" || !frame) {
    return {
      scrollTop: 0,
      listTop: 0,
      viewHeight: 800,
      width: 1024,
      rowHeight,
    };
  }
  return {
    scrollTop: Math.round(window.scrollY),
    listTop: Math.round(frame.getBoundingClientRect().top + window.scrollY),
    viewHeight: window.innerHeight,
    width: window.innerWidth,
    rowHeight,
  };
}

function firstRowHeight(frame: HTMLElement, width: number) {
  const columns = mapPeopleColumns(width);
  const cards = [...frame.querySelectorAll<HTMLElement>(".map-person")].slice(0, columns);
  return cards.reduce((max, card) => Math.max(max, card.offsetHeight), 0);
}

/** Mounts only the card rows that sit in the viewport. The page still loads 12 at a time. */
export function MapPeopleWindow({
  count,
  children,
}: {
  count: number;
  children: (start: number, end: number) => ReactNode;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<WindowBox>(() => readFrame(null, MAP_PEOPLE_ROW_ESTIMATE));
  const gap = mapPeopleGap(box.width);
  const slice = mapPeopleWindow({
    count,
    columns: mapPeopleColumns(box.width),
    scrollTop: box.scrollTop,
    listTop: box.listTop,
    viewHeight: box.viewHeight,
    rowHeight: box.rowHeight,
    gap,
  });

  useLayoutEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    let alive = true;
    const place = (measureRow: boolean) => {
      if (!alive) return;
      setBox((current) => {
        const width = window.innerWidth;
        const measured = measureRow || width !== current.width ? firstRowHeight(frame, width) : 0;
        const next = readFrame(frame, measured > 0 ? measured : current.rowHeight);
        if (
          current.scrollTop === next.scrollTop
          && current.listTop === next.listTop
          && current.viewHeight === next.viewHeight
          && current.width === next.width
          && current.rowHeight === next.rowHeight
        ) return current;
        return next;
      });
    };
    place(true);
    void document.fonts?.ready.then(() => place(true));
    const onScroll = () => {
      const scrollTop = Math.round(window.scrollY);
      setBox((current) => {
        if (current.scrollTop === scrollTop) return current;
        const columns = mapPeopleColumns(current.width);
        const shared = {
          count,
          columns,
          listTop: current.listTop,
          viewHeight: current.viewHeight,
          rowHeight: current.rowHeight,
          gap: mapPeopleGap(current.width),
        };
        const before = mapPeopleWindow({ ...shared, scrollTop: current.scrollTop });
        const after = mapPeopleWindow({ ...shared, scrollTop });
        if (before.start === after.start && before.end === after.end) return current;
        return { ...current, scrollTop };
      });
    };
    const onResize = () => place(true);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    const parent = frame.parentElement;
    const observer = parent ? new ResizeObserver(() => place(false)) : null;
    if (parent && observer) observer.observe(parent);
    return () => {
      alive = false;
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      observer?.disconnect();
    };
  }, [count]);

  return (
    <div ref={frameRef} className="map-people-frame" style={{ height: slice.height }}>
      <div className="map-people" style={{ transform: `translateY(${slice.offset}px)` }}>
        {children(slice.start, slice.end)}
      </div>
    </div>
  );
}
