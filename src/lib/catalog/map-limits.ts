/** Trainer cards returned for one map frame. The next page arrives on scroll. */
export const MAP_PAGE_SIZE = 12;

/** Distinct places in the frame before they collapse into counted groups. */
export const MAP_PIN_CAP = 80;

/** Counted groups drawn for one frame. A wider grid is used until the frame fits. */
export const MAP_CLUSTER_CAP = 180;

/** People named inside one pin tip. The rest stay in the list. */
export const MAP_TOOLTIP_CAP = 8;

/** Grid size for one clustering attempt. A later attempt doubles it until the frame fits. */
export function mapClusterStep(zoom: number, attempt: number) {
  const base = 360 / 2 ** Math.min(18, Math.max(0, zoom));
  return Math.min(120, Math.max(0.0002, (base / 4) * 2 ** attempt));
}

/**
 * How many groups the same grid as the map query would draw.
 * The query keeps the 180 fullest groups when the grid is still finer than that.
 */
export function mapClusterCellCount(points: Array<{ lat: number; lng: number }>, zoom: number) {
  let cells = points.length;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const step = mapClusterStep(zoom, attempt);
    const groups = new Set<string>();
    for (const point of points) {
      groups.add(`${Math.round(point.lat / step)}:${Math.round(point.lng / step)}`);
    }
    cells = groups.size;
    if (cells <= MAP_CLUSTER_CAP) return cells;
  }
  return Math.min(cells, MAP_CLUSTER_CAP);
}
