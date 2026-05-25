/* eslint-disable */
/**
 * Geographic Service
 *
 * Handles geographic calculations for DHT shard placement
 * and peer proximity queries.
 */

import type { GeoLocation } from '../types/dht.js';
import { DHT_CONFIG } from '../config/dhtConfig.js';

export class GeoService {
  /**
   * Calculate distance between two locations (Haversine formula)
   */
  static calculateDistance(loc1: GeoLocation, loc2: GeoLocation): number {
    const R = DHT_CONFIG.earthRadiusKm;
    const dLat = ((loc2.latitude - loc1.latitude) * Math.PI) / 180;
    const dLon = ((loc2.longitude - loc1.longitude) * Math.PI) / 180;
    const lat1 = (loc1.latitude * Math.PI) / 180;
    const lat2 = (loc2.latitude * Math.PI) / 180;

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Calculate average location from multiple points
   */
  static calculateAverageLocation(locations: GeoLocation[]): GeoLocation | undefined {
    if (locations.length === 0) {return undefined;}

    const sumLat = locations.reduce((sum, loc) => sum + loc.latitude, 0);
    const sumLon = locations.reduce((sum, loc) => sum + loc.longitude, 0);
    const count = locations.length;

    return {
      latitude: sumLat / count,
      longitude: sumLon / count,
    };
  }

  /**
   * Check if location is within bounds
   */
  static isWithinBounds(location: GeoLocation, bounds: {
    north: number;
    south: number;
    east: number;
    west: number;
  }): boolean {
    return (
      location.latitude >= bounds.south &&
      location.latitude <= bounds.north &&
      location.longitude >= bounds.west &&
      location.longitude <= bounds.east
    );
  }

  /**
   * Find nearby locations from a list
   */
  static findNearbyLocations(
    center: GeoLocation,
    locations: GeoLocation[],
    maxDistanceKm: number,
    maxResults: number
  ): GeoLocation[] {
    return locations
      .filter(loc => this.calculateDistance(center, loc) <= maxDistanceKm)
      .slice(0, maxResults);
  }
}
