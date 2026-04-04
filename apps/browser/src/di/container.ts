/**
 * Dependency Injection Container
 *
 * Provides typed interfaces for all browser app services.
 */

export interface SettingsService {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T): Promise<void>;
  getAll(): Promise<Record<string, unknown>>;
  update(updates: Record<string, unknown>): Promise<void>;
}

export interface IdentityService {
  isInitialized(): Promise<boolean>;
  initialize(passphrase?: string): Promise<void>;
  getIdentity(): Promise<CryptoKeyPair | null>;
  update(updates: Record<string, unknown>): Promise<void>;
  export(): Promise<CryptoKeyPair | null>;
  import(identityData: Record<string, unknown>): Promise<void>;
  getFingerprint(): Promise<string | null>;
  clear(): Promise<void>;
}

export interface ChatService {
  getConversations(): Array<Record<string, unknown>>;
  getMessages(peerId: string): Array<Record<string, unknown>>;
  markAsRead(peerId: string): void;
  sendMessage(peerId: string, content: string): Promise<Record<string, unknown>>;
  deleteConversation(peerId: string): void;
}

export interface VideoService {
  startCall(peerId: string): Promise<Record<string, unknown> | null>;
  endCall(callId: string): Promise<void>;
  getActiveCall(): Promise<Record<string, unknown> | null>;
  getCallHistory(): Promise<Array<Record<string, unknown>>>;
}

export interface AppDependencies {
  settingsService: SettingsService;
  identityService: IdentityService;
  chatService: ChatService;
  videoService: VideoService;
}

interface LazyContainer<T> {
  get(): T;
}

function lazy<T>(factory: () => T): LazyContainer<T> {
  let value: T | undefined;
  return { get: () => { value ??= factory(); return value; } };
}

const _containers = new Map<string, LazyContainer<unknown>>();

export function registerService<K extends keyof AppDependencies>(
  key: K,
  factory: () => AppDependencies[K]
): void {
  _containers.set(key, lazy(factory));
}

export function getService<K extends keyof AppDependencies>(key: K): AppDependencies[K] {
  const container = _containers.get(key);
  if (!container) {
    throw new Error(`Service "${key}" not registered`);
  }
  return container.get() as AppDependencies[K];
}

export function getContainer(): AppDependencies {
  return {
    settingsService: getService('settingsService'),
    identityService: getService('identityService'),
    chatService: getService('chatService'),
    videoService: getService('videoService'),
  };
}
