import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

import {
  MAP_PEOPLE_ROW_ESTIMATE,
  mapPeopleColumns,
  mapPeopleWindow,
} from "@/lib/catalog/map-window";

type WindowBox = {
  scrollTop: number;
  listTop: number;
  viewHeight: number;
  width: number;
  rowHeight: number;
};

function readBox(frame: HTMLElement | null, rowHeight: number): WindowBox {
  if (typeof window === "undefined") {
    return { scrollTop: 0, listTop: 0, viewHeight: 800, width: 1024, rowHeight };
  }
  const grid = frame?.querySelector<HTMLElement>(".map-people");
  const cards = grid ? [...grid.querySelectorAll<HTMLElement>(".map-person")] : [];
  const measured = cards.reduce((max, card) => Math.max(max, card.offsetHeight), 0);
  return {
    scrollTop: Math.round(window.scrollY),
    listTop: frame ? Math.round(frame.getBoundingClientRect().top + window.scrollY) : 0,
    viewHeight: window.innerHeight,
    width: window.innerWidth,
    rowHeight: Math.max(rowHeight, measured),
  };
}

/** Mounts only the card rows that sit in the viewport. The page still loads 12 at a time. */
export function MapPeopleWindow({
  count,
  pending = false,
  children,
}: {
  count: number;
  pending?: boolean;
  children: (start: number, end: number) => ReactNode;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<WindowBox>(() => readBox(null, MAP_PEOPLE_ROW_ESTIMATE));
  const slice = mapPeopleWindow({
    count,
    columns: mapPeopleColumns(box.width),
    scrollTop: box.scrollTop,
    listTop: box.listTop,
    viewHeight: box.viewHeight,
    rowHeight: box.rowHeight,
  });

  useLayoutEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    let frameId = 0;
    const read = () => {
      setBox((current) => {
        const next = readBox(frame, current.rowHeight);
        const before = mapPeopleWindow({
          count,
          columns: mapPeopleColumns(current.width),
          scrollTop: current.scrollTop,
          listTop: current.listTop,
          viewHeight: current.viewHeight,
          rowHeight: current.rowHeight,
        });
        const after = mapPeopleWindow({
          count,
          columns: mapPeopleColumns(next.width),
          scrollTop: next.scrollTop,
          listTop: next.listTop,
          viewHeight: next.viewHeight,
          rowHeight: next.rowHeight,
        });
        if (
          before.start === after.start
          && before.end === after.end
          && before.offset === after.offset
          && before.height === after.height
          && current.width === next.width
          && current.rowHeight === next.rowHeight
        ) return current;
        return next;
      });
    };
    const schedule = () => {
      cancelAnimationFrame(frameId);
      frameId = requestAnimationFrame(read);
    };
    read();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    const observer = new ResizeObserver(schedule);
    observer.observe(frame);
    const grid = frame.querySelector(".map-people");
    if (grid) observer.observe(grid);
    if (frame.parentElement) observer.observe(frame.parentElement);
    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      observer.disconnect();
    };
  }, [count]);

  return (
    <div ref={frameRef} className="map-people-frame" style={{ height: slice.height }}>
      <div className={`map-people${pending ? " is-pending" : ""}`} style={{ transform: `translateY(${slice.offset}px)` }}>
        {children(slice.start, slice.end)}
      </div>
    </div>
  );
}
