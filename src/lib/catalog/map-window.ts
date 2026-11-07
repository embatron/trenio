import { MAP_CLUSTER_CAP } from "@/lib/catalog/map-limits";

/** Same gap as `--layout-gap` on `.map-people`. */
export const MAP_PEOPLE_GAP = 24;

/** Square photo plus the name block, until a real card is measured. */
export const MAP_PEOPLE_ROW_ESTIMATE = 320;

/** Extra rows mounted above and below the viewport. */
export const MAP_PEOPLE_OVERSCAN_ROWS = 2;

/** Phone is 2 columns, a narrow phone is 1, and 720px and up is 3. Matches `.map-people`. */
export function mapPeopleColumns(viewportWidth: number) {
  if (viewportWidth < 360) return 1;
  if (viewportWidth >= 720) return 3;
  return 2;
}

export function mapPeopleWindow(input: {
  count: number;
  columns: number;
  scrollTop: number;
  listTop: number;
  viewHeight: number;
  rowHeight: number;
  gap?: number;
  overscanRows?: number;
}) {
  const columns = Math.max(1, Math.floor(input.columns));
  const count = Math.max(0, Math.floor(input.count));
  const rowHeight = Math.max(1, input.rowHeight);
  const gap = Math.max(0, input.gap ?? MAP_PEOPLE_GAP);
  const overscan = Math.max(0, input.overscanRows ?? MAP_PEOPLE_OVERSCAN_ROWS);
  if (count === 0) return { start: 0, end: 0, offset: 0, height: 0 };
  const rows = Math.ceil(count / columns);
  const stride = rowHeight + gap;
  const height = rows * rowHeight + (rows - 1) * gap;
  const viewStart = input.scrollTop - input.listTop;
  const viewEnd = viewStart + Math.max(0, input.viewHeight);
  let startRow = Math.floor(viewStart / stride) - overscan;
  let endRow = Math.ceil(viewEnd / stride) + overscan;
  if (startRow < 0) startRow = 0;
  if (endRow > rows) endRow = rows;
  if (endRow < startRow) endRow = startRow;
  return {
    start: startRow * columns,
    end: Math.min(count, endRow * columns),
    offset: startRow * stride,
    height,
  };
}

/** The map never builds a marker for every trainer in a crowded frame. */
export function capMapFeatures<T>(features: readonly T[]): T[] {
  if (features.length <= MAP_CLUSTER_CAP) return features as T[];
  return features.slice(0, MAP_CLUSTER_CAP);
}
