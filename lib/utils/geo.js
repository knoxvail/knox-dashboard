// Pure-JS geometry helpers (no Google Maps dependency) so they work anywhere.

/**
 * Ray-casting point-in-polygon test.
 * @param {{lat:number,lng:number}} point
 * @param {Array<{lat:number,lng:number}>} polygon - ordered ring of vertices
 * @returns {boolean} true if the point is inside the polygon
 */
export function pointInPolygon(point, polygon) {
  if (!point || !Array.isArray(polygon) || polygon.length < 3) return false;
  const x = point.lng;
  const y = point.lat;
  let inside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].lng;
    const yi = polygon[i].lat;
    const xj = polygon[j].lng;
    const yj = polygon[j].lat;

    const intersects =
      (yi > y) !== (yj > y) &&
      x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }

  return inside;
}

/**
 * Average-of-vertices centroid for a polygon path.
 */
export function polygonCentroid(path) {
  if (!Array.isArray(path) || path.length === 0) return null;
  const sum = path.reduce(
    (acc, p) => ({ lat: acc.lat + p.lat, lng: acc.lng + p.lng }),
    { lat: 0, lng: 0 }
  );
  return { lat: sum.lat / path.length, lng: sum.lng / path.length };
}

/**
 * True if the `inner` drawing's centroid falls inside the `outer` polygon
 * (used to nest regions inside markets).
 */
export function isDrawingInside(inner, outer) {
  if (!inner?.paths || !outer?.paths) return false;
  const c = polygonCentroid(inner.paths);
  return c ? pointInPolygon(c, outer.paths) : false;
}

/**
 * Return the list of regions (drawings) that contain the given asset.
 * @param {{lat:number,lng:number}} asset
 * @param {Array<{id:string,name:string,paths:Array}>} drawings
 * @returns {Array<{id:string,name:string}>}
 */
export function getRegionsForPoint(asset, drawings) {
  if (!asset || asset.lat == null || asset.lng == null || !Array.isArray(drawings)) {
    return [];
  }
  const point = { lat: asset.lat, lng: asset.lng };
  return drawings
    .filter((d) => Array.isArray(d.paths) && pointInPolygon(point, d.paths))
    .map((d) => ({ id: d.id, name: d.name, color: d.color || '#6366f1' }));
}
