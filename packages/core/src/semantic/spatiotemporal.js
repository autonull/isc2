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
export function haversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in kilometers
    const toRad = (deg) => (deg * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) *
            Math.cos(toRad(lat2)) *
            Math.sin(dLon / 2) *
            Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}
/**
 * Computes location overlap score between two locations.
 *
 * @param a - First location
 * @param b - Second location
 * @returns Overlap score in [0, 1], where 1 = identical, 0 = no overlap
 */
export function locationOverlap(a, b) {
    const distance = haversineDistance(a.lat, a.lon, b.lat, b.lon);
    // Use the larger radius for overlap calculation
    const radiusA = a.radius ?? 50; // Default 50km
    const radiusB = b.radius ?? 50;
    const maxRadius = Math.max(radiusA, radiusB);
    // If distance is 0, perfect overlap
    if (distance === 0) {
        return 1;
    }
    // If distance exceeds combined radii, no overlap
    if (distance >= radiusA + radiusB) {
        return 0;
    }
    // Partial overlap: 1 - (distance / maxRadius), clamped to [0, 1]
    const overlap = 1 - distance / maxRadius;
    return Math.max(0, Math.min(1, overlap));
}
/**
 * Computes time window overlap score.
 *
 * @param a - First time window
 * @param b - Second time window
 * @returns Overlap score in [0, 1], where 1 = identical, 0 = no overlap
 */
export function timeOverlap(a, b) {
    // No overlap if one ends before the other starts
    if (a.end <= b.start || b.end <= a.start) {
        return 0;
    }
    // Compute overlap duration
    const overlapStart = Math.max(a.start, b.start);
    const overlapEnd = Math.min(a.end, b.end);
    const overlapDuration = overlapEnd - overlapStart;
    // Compute total duration (union)
    const totalStart = Math.min(a.start, b.start);
    const totalEnd = Math.max(a.end, b.end);
    const totalDuration = totalEnd - totalStart;
    if (totalDuration === 0) {
        return 1; // Both are instantaneous at the same time
    }
    return overlapDuration / totalDuration;
}
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
export function spatiotemporalSimilarity(locationA, locationB, timeA, timeB, locationWeight = 0.5) {
    let score = 0;
    let totalWeight = 0;
    if (locationA && locationB) {
        score += locationOverlap(locationA, locationB) * locationWeight;
        totalWeight += locationWeight;
    }
    if (timeA && timeB) {
        const timeWeight = 1 - locationWeight;
        score += timeOverlap(timeA, timeB) * timeWeight;
        totalWeight += timeWeight;
    }
    if (totalWeight === 0) {
        return 0; // No spatiotemporal data
    }
    return score / totalWeight;
}
//# sourceMappingURL=spatiotemporal.js.map