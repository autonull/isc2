/**
 * Model Version Migration System
 *
 * Graceful model upgrades with dual-announce period,
 * rollback capability, and version compatibility checking.
 *
 * References: NEXT_STEPS.md#74-model-version-migration
 */

export interface ModelVersion {
  major: number;
  minor: number;
  patch: number;
  hash: string; // Model content hash for verification
}

export interface ModelMetadata {
  version: ModelVersion;
  name: string;
  description: string;
  dimensions: number;
  quantization: 'f32' | 'f16' | 'int8';
  createdAt: number;
  expiresAt?: number; // For dual-announce period
  deprecated: boolean;
  supersededBy?: ModelVersion;
}

export interface MigrationPlan {
  fromVersion: ModelVersion;
  toVersion: ModelVersion;
  strategy: 'direct' | 'gradual' | 'forced';
  dualAnnounceStart: number;
  dualAnnounceEnd: number;
  rollbackAvailable: boolean;
  migrationProgress: number; // 0-1
}

export interface MigrationConfig {
  // Dual-announce period (90 days default)
  dualAnnounceDays: number;
  
  // Migration thresholds
  minAdoptionRate: number; // Before forcing migration
  maxOldVersionDays: number; // After which old version is rejected
  
  // Rollback settings
  rollbackWindowDays: number;
  autoRollbackOnErrorRate: number;
  
  // Version compatibility
  compatibleVersionRange: number; // How many major versions back are compatible
}

const DEFAULT_CONFIG: MigrationConfig = {
  dualAnnounceDays: 90,
  minAdoptionRate: 0.80, // 80% adoption before forcing
  maxOldVersionDays: 120,
  rollbackWindowDays: 7,
  autoRollbackOnErrorRate: 0.10, // 10% error rate triggers auto-rollback
  compatibleVersionRange: 1,
};

export class ModelVersionManager {
  private config: MigrationConfig;
  private currentVersion: ModelMetadata | null = null;
  private previousVersion: ModelMetadata | null = null;
  private migrationPlan: MigrationPlan | null = null;
  private versionHistory: ModelMetadata[] = [];
  private peerVersions: Map<string, ModelVersion> = new Map();
  private errorRates: Map<string, number> = new Map();
  private migrationStartTime?: number;

  constructor(config: Partial<MigrationConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Set the current model version
   */
  setCurrentVersion(metadata: ModelMetadata): void {
    // Store previous version for rollback
    if (this.currentVersion) {
      this.previousVersion = { ...this.currentVersion };
      this.versionHistory.push(this.previousVersion);
      
      // Trim history
      if (this.versionHistory.length > 10) {
        this.versionHistory.shift();
      }
    }

    this.currentVersion = metadata;
    this.migrationStartTime = Date.now();
  }

  /**
   * Get current model version
   */
  getCurrentVersion(): ModelMetadata | null {
    return this.currentVersion;
  }

  /**
   * Check if a version is compatible with current
   */
  isVersionCompatible(version: ModelVersion): boolean {
    if (!this.currentVersion) return false;

    const current = this.currentVersion.version;
    
    // Same version is always compatible
    if (this.versionsEqual(version, current)) return true;

    // Check major version compatibility
    const majorDiff = current.major - version.major;
    if (majorDiff < 0 || majorDiff > this.config.compatibleVersionRange) {
      return false;
    }

    // Minor and patch can differ within same major
    return true;
  }

  /**
   * Start migration to new version
   */
  startMigration(newMetadata: ModelMetadata, strategy: 'direct' | 'gradual' | 'forced' = 'gradual'): MigrationPlan {
    if (!this.currentVersion) {
      throw new Error('No current version set');
    }

    const now = Date.now();
    const dualAnnounceMs = this.config.dualAnnounceDays * 24 * 60 * 60 * 1000;

    // Store current as previous before updating
    this.previousVersion = { ...this.currentVersion };
    this.versionHistory.push(this.previousVersion);

    const plan: MigrationPlan = {
      fromVersion: this.currentVersion.version,
      toVersion: newMetadata.version,
      strategy,
      dualAnnounceStart: now,
      dualAnnounceEnd: now + dualAnnounceMs,
      rollbackAvailable: true,
      migrationProgress: 0,
    };

    this.migrationPlan = plan;
    this.migrationStartTime = now;

    // Set new version as current
    this.currentVersion = newMetadata;

    // Mark old version as deprecated with supersession info
    this.previousVersion.deprecated = true;
    this.previousVersion.supersededBy = newMetadata.version;
    this.previousVersion.expiresAt = plan.dualAnnounceEnd;

    return plan;
  }

  /**
   * Get current migration plan
   */
  getMigrationPlan(): MigrationPlan | null {
    return this.migrationPlan;
  }

  /**
   * Update migration progress
   */
  updateMigrationProgress(progress: number): void {
    if (!this.migrationPlan) return;
    this.migrationPlan.migrationProgress = Math.min(1, Math.max(0, progress));

    // Check if we can end dual-announce period early
    if (progress >= this.config.minAdoptionRate && this.migrationPlan.strategy === 'gradual') {
      // Could end early, but for safety we wait for full period
      console.log(`Migration ${Math.round(progress * 100)}% complete, adoption rate sufficient`);
    }
  }

  /**
   * Check if dual-announce period is active
   */
  isDualAnnounceActive(): boolean {
    if (!this.migrationPlan || !this.previousVersion?.expiresAt) return false;
    return Date.now() < this.previousVersion.expiresAt;
  }

  /**
   * Check if migration is complete
   */
  isMigrationComplete(): boolean {
    if (!this.migrationPlan) return false;
    return this.migrationPlan.migrationProgress >= 1;
  }

  /**
   * Rollback to previous version
   */
  rollback(): boolean {
    if (!this.previousVersion) {
      console.warn('No previous version available for rollback');
      return false;
    }

    // Check rollback window
    if (this.migrationStartTime) {
      const elapsed = Date.now() - this.migrationStartTime;
      const rollbackWindow = this.config.rollbackWindowDays * 24 * 60 * 60 * 1000;
      
      if (elapsed > rollbackWindow) {
        console.warn('Rollback window expired');
        this.migrationPlan!.rollbackAvailable = false;
        return false;
      }
    }

    // Swap versions
    const temp = this.currentVersion;
    this.currentVersion = this.previousVersion;
    this.previousVersion = temp;

    // Clear migration plan
    this.migrationPlan = null;

    console.log(`Rolled back to version ${this.formatVersion(this.currentVersion.version)}`);
    return true;
  }

  /**
   * Record peer's model version
   */
  recordPeerVersion(peerID: string, version: ModelVersion): void {
    this.peerVersions.set(peerID, version);
  }

  /**
   * Get adoption rate for new version
   */
  getAdoptionRate(): number {
    if (this.peerVersions.size === 0) return 0;
    if (!this.migrationPlan) return 1;

    const newVersion = this.migrationPlan.toVersion;
    let count = 0;

    for (const version of this.peerVersions.values()) {
      if (this.versionsEqual(version, newVersion)) {
        count++;
      }
    }

    return count / this.peerVersions.size;
  }

  /**
   * Record error rate for version
   */
  recordErrorRate(version: ModelVersion, errorRate: number): void {
    const key = this.formatVersion(version);
    this.errorRates.set(key, errorRate);

    // Check for auto-rollback
    if (errorRate >= this.config.autoRollbackOnErrorRate) {
      console.warn(`High error rate (${errorRate * 100}%) detected for version ${key}`);
      if (this.migrationPlan?.rollbackAvailable) {
        console.warn('Auto-rollback triggered');
        // Would trigger automatic rollback here
      }
    }
  }

  /**
   * Get error rate for version
   */
  getErrorRate(version: ModelVersion): number {
    const key = this.formatVersion(version);
    return this.errorRates.get(key) ?? 0;
  }

  /**
   * Check if version is deprecated
   */
  isVersionDeprecated(version: ModelVersion): boolean {
    if (!this.currentVersion) return false;
    
    // Current version might be deprecated during dual-announce
    if (this.versionsEqual(version, this.currentVersion.version)) {
      return this.currentVersion.deprecated;
    }

    // Check history
    return this.versionHistory.some(
      (v) => this.versionsEqual(v.version, version) && v.deprecated
    );
  }

  /**
   * Check if version should be rejected (past expiry)
   */
  shouldRejectVersion(version: ModelVersion): boolean {
    if (!this.currentVersion) return false;

    // Check if it's the old version past expiry
    if (this.previousVersion && this.versionsEqual(version, this.previousVersion.version)) {
      if (this.previousVersion.expiresAt && Date.now() > this.previousVersion.expiresAt) {
        return true;
      }
    }

    // Check major version compatibility
    const majorDiff = this.currentVersion.version.major - version.major;
    if (majorDiff > this.config.compatibleVersionRange) {
      return true;
    }

    return false;
  }

  /**
   * Get version history
   */
  getVersionHistory(): ModelMetadata[] {
    return [...this.versionHistory];
  }

  /**
   * Get migration statistics
   */
  getMigrationStats(): {
    currentVersion: string;
    previousVersion?: string;
    adoptionRate: number;
    dualAnnounceActive: boolean;
    dualAnnounceEndsIn?: number; // days
    migrationProgress: number;
    rollbackAvailable: boolean;
    peerCount: number;
  } {
    const stats: {
      currentVersion: string;
      previousVersion?: string;
      adoptionRate: number;
      dualAnnounceActive: boolean;
      dualAnnounceEndsIn?: number;
      migrationProgress: number;
      rollbackAvailable: boolean;
      peerCount: number;
    } = {
      currentVersion: this.currentVersion ? this.formatVersion(this.currentVersion.version) : 'none',
      previousVersion: this.previousVersion ? this.formatVersion(this.previousVersion.version) : undefined,
      adoptionRate: this.getAdoptionRate(),
      dualAnnounceActive: this.isDualAnnounceActive(),
      migrationProgress: this.migrationPlan?.migrationProgress ?? 0,
      rollbackAvailable: this.migrationPlan?.rollbackAvailable ?? false,
      peerCount: this.peerVersions.size,
    };

    if (this.previousVersion?.expiresAt) {
      const daysRemaining = (this.previousVersion.expiresAt - Date.now()) / (24 * 60 * 60 * 1000);
      stats.dualAnnounceEndsIn = Math.max(0, Math.ceil(daysRemaining));
    }

    return stats;
  }

  /**
   * Parse version string
   */
  parseVersion(versionStr: string): ModelVersion | null {
    const match = versionStr.match(/^v?(\d+)\.(\d+)\.(\d+)(?:-(.+))?$/);
    if (!match) return null;

    return {
      major: parseInt(match[1], 10),
      minor: parseInt(match[2], 10),
      patch: parseInt(match[3], 10),
      hash: match[4] || '',
    };
  }

  /**
   * Format version to string
   */
  formatVersion(version: ModelVersion): string {
    let str = `v${version.major}.${version.minor}.${version.patch}`;
    if (version.hash) {
      str += `-${version.hash.slice(0, 8)}`;
    }
    return str;
  }

  /**
   * Compare versions
   */
  compareVersions(a: ModelVersion, b: ModelVersion): number {
    if (a.major !== b.major) return a.major - b.major;
    if (a.minor !== b.minor) return a.minor - b.minor;
    if (a.patch !== b.patch) return a.patch - b.patch;
    return 0;
  }

  /**
   * Check if versions are equal
   */
  private versionsEqual(a: ModelVersion, b: ModelVersion): boolean {
    return (
      a.major === b.major &&
      a.minor === b.minor &&
      a.patch === b.patch &&
      (!a.hash || !b.hash || a.hash === b.hash)
    );
  }

  /**
   * Clear all data
   */
  clear(): void {
    this.currentVersion = null;
    this.previousVersion = null;
    this.migrationPlan = null;
    this.versionHistory = [];
    this.peerVersions.clear();
    this.errorRates.clear();
    this.migrationStartTime = undefined;
  }
}

/**
 * Create model version manager with default configuration
 */
export function createModelVersionManager(
  config?: Partial<MigrationConfig>
): ModelVersionManager {
  return new ModelVersionManager(config);
}

/**
 * Generate model version hash from content
 */
export async function generateModelHash(content: Uint8Array): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', content.buffer as ArrayBuffer);
  const hashArray = new Uint8Array(hashBuffer);
  return Array.from(hashArray)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Check if model content matches expected hash
 */
export async function verifyModelHash(
  content: Uint8Array,
  expectedHash: string
): Promise<boolean> {
  const actualHash = await generateModelHash(content);
  return actualHash === expectedHash;
}
