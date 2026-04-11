export interface CharacterProfile {
  name: string;
  bio: string;
  interests: string[];
}

export class SimulationAgent {
  public profile: CharacterProfile;
  public peerId: string;
  public currentTopic: string = "";

  constructor(profile: CharacterProfile) {
    this.profile = profile;
    this.peerId = "agent-" + Math.random().toString(36).substring(2, 9);
  }
}
