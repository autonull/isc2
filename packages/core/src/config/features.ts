/**
 * ISC Configuration & Feature Flags
 * 
 * Enables modular deployment for different trust environments:
 * - Private communities (minimal features)
 * - Federated networks (reputation + moderation)
 * - Public networks (full feature set)
 */

/**
 * Deployment mode determines default feature configuration
 */
export type DeploymentMode = 
  | 'private'      // Trusted community, minimal overhead
  | 'federated'    // Interconnected communities
  | 'public';      // Open network, full security

/**
 * Feature flag configuration
 */
export interface FeatureFlags {
  // Core features (always enabled)
  semanticMatching: boolean;
  encryptedChat: boolean;
  channels: boolean;
  
  // Reputation system (Phase 2)
  reputationSystem: boolean;
  webOfTrust: boolean;
  sybilResistance: boolean;
  
  // Stake signaling (Phase 2.2)
  stakeBonding: boolean;
  slashing: boolean;
  
  // Moderation (Phase 2.3)
  communityCourts: boolean;
  reporting: boolean;
  juryDuty: boolean;
  
  // Social features
  posts: boolean;
  feeds: boolean;
  follows: boolean;
  videoCalls: boolean;
  audioSpaces: boolean;
  
  // Discovery
  publicDiscovery: boolean;
  inviteOnly: boolean;
  bootstrapDiscovery: boolean;
  
  // Privacy
  ephemeralAnnouncements: boolean;
  persistentProfiles: boolean;
  
  // Economic
  tipping: boolean;
  treasury: boolean;
}

/**
 * Preset configurations for deployment modes
 */
export const DEPLOYMENT_PRESETS: Record<DeploymentMode, FeatureFlags> = {
  /**
   * Private Community Mode
   * 
   * For trusted networks with pre-existing social trust.
   * Minimal overhead, no Sybil protection needed.
   * 
   * Use cases:
   * - Company internal communication
   * - Private research groups
   * - Invite-only communities (<500 users)
   */
  private: {
    // Core (always on)
    semanticMatching: true,
    encryptedChat: true,
    channels: true,
    
    // Reputation (minimal - just for UX)
    reputationSystem: false,       // Not needed with trust
    webOfTrust: false,
    sybilResistance: false,
    
    // Stake (not needed)
    stakeBonding: false,
    slashing: false,
    
    // Moderation (lightweight)
    communityCourts: false,        // Admin moderation instead
    reporting: true,               // Basic reporting to admins
    juryDuty: false,
    
    // Social (optional)
    posts: true,
    feeds: true,
    follows: true,
    videoCalls: true,
    audioSpaces: true,
    
    // Discovery (restricted)
    publicDiscovery: false,
    inviteOnly: true,
    bootstrapDiscovery: false,
    
    // Privacy
    ephemeralAnnouncements: true,
    persistentProfiles: false,
    
    // Economic (optional)
    tipping: true,
    treasury: false,
  },
  
  /**
   * Federated Network Mode
   * 
   * For interconnected communities with reputation bridges.
   * Balanced security and usability.
   * 
   * Use cases:
   * - University networks
   * - Professional associations
   * - Community organizations (500-10k users)
   */
  federated: {
    // Core (always on)
    semanticMatching: true,
    encryptedChat: true,
    channels: true,
    
    // Reputation (enabled)
    reputationSystem: true,
    webOfTrust: true,
    sybilResistance: true,
    
    // Stake (optional)
    stakeBonding: false,
    slashing: false,
    
    // Moderation (community-based)
    communityCourts: true,
    reporting: true,
    juryDuty: true,
    
    // Social (full)
    posts: true,
    feeds: true,
    follows: true,
    videoCalls: true,
    audioSpaces: true,
    
    // Discovery (semi-open)
    publicDiscovery: false,
    inviteOnly: false,
    bootstrapDiscovery: true,
    
    // Privacy
    ephemeralAnnouncements: true,
    persistentProfiles: true,
    
    // Economic
    tipping: true,
    treasury: false,
  },
  
  /**
   * Public Network Mode
   * 
   * For open participation with full security.
   * Maximum Sybil resistance and moderation.
   * 
   * Use cases:
   * - Public social network
   * - Open communities (10k+ users)
   * - Civilization-scale deployment
   */
  public: {
    // Core (always on)
    semanticMatching: true,
    encryptedChat: true,
    channels: true,
    
    // Reputation (full)
    reputationSystem: true,
    webOfTrust: true,
    sybilResistance: true,
    
    // Stake (required)
    stakeBonding: true,
    slashing: true,
    
    // Moderation (full)
    communityCourts: true,
    reporting: true,
    juryDuty: true,
    
    // Social (full)
    posts: true,
    feeds: true,
    follows: true,
    videoCalls: true,
    audioSpaces: true,
    
    // Discovery (open)
    publicDiscovery: true,
    inviteOnly: false,
    bootstrapDiscovery: true,
    
    // Privacy
    ephemeralAnnouncements: true,
    persistentProfiles: true,
    
    // Economic (full)
    tipping: true,
    treasury: true,
  },
};

/**
 * Default deployment mode
 */
export const DEFAULT_DEPLOYMENT_MODE: DeploymentMode = 'federated';

/**
 * Get feature flags for current deployment
 */
export function getFeatureFlags(mode: DeploymentMode = DEFAULT_DEPLOYMENT_MODE): FeatureFlags {
  return DEPLOYMENT_PRESETS[mode];
}

/**
 * Check if a feature is enabled
 */
export function isFeatureEnabled(
  feature: keyof FeatureFlags,
  mode: DeploymentMode = DEFAULT_DEPLOYMENT_MODE
): boolean {
  const flags = getFeatureFlags(mode);
  return flags[feature] as boolean;
}

/**
 * Custom configuration builder
 */
export class FeatureFlagBuilder {
  private flags: Partial<FeatureFlags> = {};
  
  constructor(baseMode: DeploymentMode = DEFAULT_DEPLOYMENT_MODE) {
    this.flags = { ...DEPLOYMENT_PRESETS[baseMode] };
  }
  
  enable(feature: keyof FeatureFlags): this {
    this.flags[feature] = true;
    return this;
  }
  
  disable(feature: keyof FeatureFlags): this {
    this.flags[feature] = false;
    return this;
  }
  
  build(): FeatureFlags {
    return {
      ...DEPLOYMENT_PRESETS[DEFAULT_DEPLOYMENT_MODE],
      ...this.flags,
    } as FeatureFlags;
  }
}

/**
 * Validate configuration compatibility
 */
export function validateConfiguration(flags: FeatureFlags): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Stake requires reputation
  if (flags.stakeBonding && !flags.reputationSystem) {
    errors.push('stakeBonding requires reputationSystem to be enabled');
  }
  
  // Slashing requires stake bonding
  if (flags.slashing && !flags.stakeBonding) {
    errors.push('slashing requires stakeBonding to be enabled');
  }
  
  // Jury duty requires community courts
  if (flags.juryDuty && !flags.communityCourts) {
    errors.push('juryDuty requires communityCourts to be enabled');
  }
  
  // Web of Trust requires reputation system
  if (flags.webOfTrust && !flags.reputationSystem) {
    errors.push('webOfTrust requires reputationSystem to be enabled');
  }
  
  // Public discovery incompatible with invite-only
  if (flags.publicDiscovery && flags.inviteOnly) {
    errors.push('publicDiscovery and inviteOnly are mutually exclusive');
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Get minimum requirements for deployment mode
 */
export function getDeploymentRequirements(mode: DeploymentMode): {
  minUsers: number;
  maxUsers: number;
  requiredFeatures: (keyof FeatureFlags)[];
  recommendedFeatures: (keyof FeatureFlags)[];
} {
  switch (mode) {
    case 'private':
      return {
        minUsers: 1,
        maxUsers: 500,
        requiredFeatures: ['semanticMatching', 'encryptedChat', 'channels'],
        recommendedFeatures: ['reporting', 'videoCalls'],
      };
    case 'federated':
      return {
        minUsers: 100,
        maxUsers: 10000,
        requiredFeatures: ['reputationSystem', 'communityCourts', 'webOfTrust'],
        recommendedFeatures: ['sybilResistance', 'tipping', 'persistentProfiles'],
      };
    case 'public':
      return {
        minUsers: 1000,
        maxUsers: Infinity,
        requiredFeatures: [
          'reputationSystem',
          'webOfTrust',
          'sybilResistance',
          'stakeBonding',
          'slashing',
          'communityCourts',
          'juryDuty',
        ],
        recommendedFeatures: ['treasury', 'tipping', 'bootstrapDiscovery'],
      };
  }
}

/**
 * Export configuration for documentation
 */
export function exportConfiguration(mode: DeploymentMode): string {
  const flags = getFeatureFlags(mode);
  const requirements = getDeploymentRequirements(mode);
  
  return JSON.stringify({
    mode,
    features: flags,
    requirements,
    timestamp: new Date().toISOString(),
  }, null, 2);
}
