/**
 * Location representation for spatiotemporal matching.
 */
export interface Location {
    lat: number;
    lon: number;
    radius?: number;
}
/**
 * Time window representation for spatiotemporal matching.
 */
export interface TimeWindow {
    start: number;
    end: number;
}
/**
 * Computes the great-circle distance between two points on Earth using the Haversine formula.
 *
 * @param lat1 - Latitude of first point (degrees)
 * @param lon1 - Longitude of first point (degrees)
 * @param lat2 - Latitude of second point (degrees)
 * @param lon2 - Longitude of second point (degrees)
 * @returns Distance in kilometers
 *
 * @example
 * ```typescript
 * // Tokyo to Osaka
 * haversineDistance(35.6895, 139.6917, 34.6937, 135.5023); // ~403 km
 * ```
 */
export declare function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number;
/**
 * Computes location overlap score between two locations.
 *
 * @param a - First location
 * @param b - Second location
 * @returns Overlap score in [0, 1], where 1 = identical, 0 = no overlap
 */
export declare function locationOverlap(a: Location, b: Location): number;
/**
 * Computes time window overlap score.
 *
 * @param a - First time window
 * @param b - Second time window
 * @returns Overlap score in [0, 1], where 1 = identical, 0 = no overlap
 */
export declare function timeOverlap(a: TimeWindow, b: TimeWindow): number;
/**
 * Computes combined spatiotemporal similarity score.
 *
 * @param locationA - First location (optional)
 * @param locationB - Second location (optional)
 * @param timeA - First time window (optional)
 * @param timeB - Second time window (optional)
 * @param locationWeight - Weight for location similarity (default: 0.5)
 * @returns Combined spatiotemporal score in [0, 1]
 */
export declare function spatiotemporalSimilarity(locationA?: Location, locationB?: Location, timeA?: TimeWindow, timeB?: TimeWindow, locationWeight?: number): number;
//# sourceMappingURL=spatiotemporal.d.ts.map