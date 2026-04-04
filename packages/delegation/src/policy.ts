/* eslint-disable */
export interface DelegationPolicy {
  allowEmbedDelegation: boolean;
  allowANNDelegation: boolean;
  allowSigVerifyDelegation: boolean;
  delegateOnlyChannels: boolean;
  allowedChannels: Set<string>;
}

export interface DelegationPolicyConfig {
  defaultPolicy: DelegationPolicy;
  channelOverrides: PolicyStorage;
  storage: PolicyStorage;
}

export interface PolicyStorage {
  get(channelID: string): Promise<DelegationPolicy | null>;
  set(channelID: string, policy: DelegationPolicy): Promise<void>;
  delete(channelID: string): Promise<void>;
  getDefault(): Promise<DelegationPolicy>;
  setDefault(policy: DelegationPolicy): Promise<void>;
}

export class DelegationPolicyManager {
  private config: DelegationPolicyConfig;
  private defaultPolicy: DelegationPolicy;

  constructor(config: DelegationPolicyConfig) {
    this.config = config;
    this.defaultPolicy = config.defaultPolicy;
  }

  async getPolicy(channelID?: string): Promise<DelegationPolicy> {
    if (!channelID) {return this.defaultPolicy;}
    const override = await this.config.channelOverrides.get(channelID);
    return override ?? this.defaultPolicy;
  }

  async canDelegate(
    service: 'embed' | 'ann_query' | 'sig_verify',
    channelID?: string
  ): Promise<boolean> {
    const policy = await this.getPolicy(channelID);
    switch (service) {
      case 'embed':
        return policy.allowEmbedDelegation;
      case 'ann_query':
        return policy.allowANNDelegation;
      case 'sig_verify':
        return policy.allowSigVerifyDelegation;
    }
  }

  async shouldDelegate(
    channelID: string,
    _service: 'embed' | 'ann_query' | 'sig_verify'
  ): Promise<boolean> {
    const policy = await this.getPolicy(channelID);
    if (!policy.delegateOnlyChannels) {return true;}
    return policy.allowedChannels.has(channelID);
  }

  async setChannelPolicy(channelID: string, policy: Partial<DelegationPolicy>): Promise<void> {
    const current = await this.getPolicy(channelID);
    const merged: DelegationPolicy = {
      ...current,
      ...policy,
      allowedChannels: policy.allowedChannels ?? current.allowedChannels,
    };
    await this.config.channelOverrides.set(channelID, merged);
    await this.config.storage.set(channelID, merged);
  }

  async clearChannelPolicy(channelID: string): Promise<void> {
    await this.config.channelOverrides.delete(channelID);
    await this.config.storage.delete(channelID);
  }

  async setDefaultPolicy(policy: Partial<DelegationPolicy>): Promise<void> {
    this.defaultPolicy = {
      ...this.defaultPolicy,
      ...policy,
      allowedChannels: policy.allowedChannels ?? this.defaultPolicy.allowedChannels,
    };
    await this.config.storage.setDefault(this.defaultPolicy);
  }

  async addAllowedChannel(channelID: string): Promise<void> {
    const policy = await this.getPolicy(channelID);
    const newAllowedChannels = new Set(policy.allowedChannels);
    newAllowedChannels.add(channelID);
    await this.setChannelPolicy(channelID, { allowedChannels: newAllowedChannels });
  }

  async removeAllowedChannel(channelID: string): Promise<void> {
    const policy = await this.getPolicy(channelID);
    const newAllowedChannels = new Set(policy.allowedChannels);
    newAllowedChannels.delete(channelID);
    await this.setChannelPolicy(channelID, { allowedChannels: newAllowedChannels });
  }

  getDefaultPolicy(): DelegationPolicy {
    return { ...this.defaultPolicy };
  }
}

export function createMinimalPolicy(): DelegationPolicy {
  return {
    allowEmbedDelegation: false,
    allowANNDelegation: false,
    allowSigVerifyDelegation: false,
    delegateOnlyChannels: false,
    allowedChannels: new Set(),
  };
}

const FORBIDDEN_PATTERNS = [
  /\b(password|passwd|secret)\s*[:=]\s*\S+/i,
  /\b(api[_-]?key|token)\s*[:=]\s*\S+/i,
  /BEGIN\s+(RSA\s+)?PRIVATE\s+KEY/i,
  /BEGIN\s+CERTIFICATE/i,
];

export function isChannelDescriptionSafe(text: string): boolean {
  return !FORBIDDEN_PATTERNS.some((pattern) => pattern.test(text));
}

const SENSITIVE_PATTERNS = [
  { pattern: /\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/g, replacement: '[PHONE]' },
  { pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, replacement: '[EMAIL]' },
  { pattern: /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, replacement: '[IP]' },
];

export function sanitizeForDelegation(text: string): string {
  let sanitized = text;
  for (const { pattern, replacement } of SENSITIVE_PATTERNS) {
    sanitized = sanitized.replace(pattern, replacement);
  }
  return sanitized;
}
