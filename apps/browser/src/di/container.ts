/**
 * Dependency Injection Container
 *
 * Provides typed interfaces for all browser app services.
 */

export interface SettingsService {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T): Promise<void>;
  getAll(): Promise<Record<string, any>>;
  update(updates: Record<string, any>): Promise<void>;
}

export interface IdentityService {
  getIdentity(): any;
  update(updates: any): Promise<void>;
  export(): any;
  import(identityData: any): Promise<void>;
  getFingerprint(): string | null;
  clear(): Promise<void>;
}

export interface ChatService {
  getConversations(): any[];
  getMessages(peerId: string): any[];
  markAsRead(peerId: string): void;
  sendMessage(peerId: string, content: string): Promise<any>;
  deleteConversation(peerId: string): void;
}

export interface VideoService {
  startCall(peerId: string): Promise<void>;
  endCall(): void;
  getLocalStream(): MediaStream | null;
  getRemoteStream(): MediaStream | null;
  isInCall(): boolean;
}

export interface AppDependencies {
  settingsService: SettingsService;
  identityService: IdentityService;
  chatService: ChatService;
  videoService: VideoService;
}

let _container: AppDependencies | null = null;

export function registerServices(deps: AppDependencies): void {
  _container = deps;
}

export function getContainer(): AppDependencies {
  if (!_container) {
    _container = {
      settingsService: null as unknown as SettingsService,
      identityService: null as unknown as IdentityService,
      chatService: null as unknown as ChatService,
      videoService: null as unknown as VideoService,
    };
  }
  return _container;
}
