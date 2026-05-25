export interface CharacterProfile {
  name: string;
  bio: string;
  interests: string[];
}

import type { LocalNetworkAdapter } from '@isc/adapters';
import type { Distribution } from '@isc/core';

export class SimulationAgent {
  public profile: CharacterProfile;
  public peerId: string;
  public currentTopic: string = "";
  public networkAdapter: LocalNetworkAdapter | null = null;
  public subscribedTopics: Set<string> = new Set();
  public distributions: Distribution[] = [];

  // Keep track of recent messages for context
  public recentMessages: { peerId: string, message: string, topic: string }[] = [];

  constructor(profile: CharacterProfile) {
    this.profile = profile;
    this.peerId = "agent-" + Math.random().toString(36).substring(2, 9);
  }

  public attachNetwork(adapter: LocalNetworkAdapter) {
    this.networkAdapter = adapter;

    // Subscribe to primary interest out of the box
    if (this.profile.interests.length > 0) {
        this.subscribeToTopic(this.profile.interests[0]);
    }
  }

  public subscribeToTopic(topic: string) {
      if (!this.networkAdapter || this.subscribedTopics.has(topic)) return;

      this.subscribedTopics.add(topic);
      this.networkAdapter.subscribe(topic, (data: Uint8Array) => {
          try {
              const payload = JSON.parse(new TextDecoder().decode(data));
              this.recentMessages.push({
                  peerId: payload.peerId,
                  message: payload.message,
                  topic: topic
              });

              if (this.recentMessages.length > 10) {
                  this.recentMessages.shift();
              }
          } catch (e) {
              console.error("Agent failed to parse message", e);
          }
      });
  }
}
