import { BrowserContext, Page, expect } from '@playwright/test';
import { completeOnboarding, waitForAppReady } from './waitHelpers.js';

/**
 * Defines the initial state of a test Persona.
 */
export interface PersonaConfig {
  name: string;
  bio: string;
  channelName: string;
  channelDescription: string;
}

/**
 * A wrapper class to manage an isolated browser context, page, and the actions
 * of a single user persona in E2E tests.
 */
export class Persona {
  public page: Page;

  private constructor(
    public readonly config: PersonaConfig,
    public readonly context: BrowserContext,
    page: Page
  ) {
    this.page = page;
  }

  /**
   * Factory method to create and initialize a new Persona.
   */
  static async create(
    context: BrowserContext,
    config: PersonaConfig
  ): Promise<Persona> {
    const page = await context.newPage();
    const persona = new Persona(config, context, page);
    await persona.initialize();
    return persona;
  }

  /**
   * Navigates to the app, handles onboarding, and ensures the app is ready.
   */
  async initialize(): Promise<void> {
    await this.page.goto('/');

    // In our tests, wait for either the app or the onboarding overlay
    try {
      // First, see if we can find the onboarding container quickly
      const onboardingOverlay = this.page.locator('[data-testid="onboarding-step-1"], [style*="position: fixed"]');
      await onboardingOverlay.waitFor({ state: 'visible', timeout: 5000 });

      // If we got here, onboarding is visible
      await completeOnboarding(this.page, {
        name: this.config.name,
        bio: this.config.bio,
        channel: this.config.channelName,
      });
      // the helper already sets the channel name, but the description wasn't set.
      // After onboarding completes, it usually creates a default channel.
      // We'll create our specific primary channel to be safe.
      await this.createChannel(this.config.channelName, this.config.channelDescription);

    } catch (e) {
      // Onboarding wasn't found within 5s, maybe it was skipped by another test or local storage
      console.log('Onboarding not found or skipped, proceeding to create channel manually');
      await waitForAppReady(this.page, 10000);
      await this.createChannel(this.config.channelName, this.config.channelDescription);
    }

    // Ensure we are on the main app
    await expect(this.page.locator('#app')).toBeVisible();
  }

  /**
   * Navigates to the Compose tab and creates a new channel.
   */
  async createChannel(name: string, description: string): Promise<void> {
    // Navigate to Compose screen using force to bypass overlapping elements
    await this.page.locator('[data-testid="nav-tab-compose"], [data-tab="compose"], [data-testid="create-channel-button"]').first().click({ force: true });

    // Fallback UI handling
    if (await this.page.locator('input[placeholder*="Channel Name"]').count() === 0) {
        // App is in post compose mode, so try clicking "+ New Channel"
        const newChannelBtn = this.page.locator('button:has-text("+ New Channel")');
        if (await newChannelBtn.count() > 0) {
            await newChannelBtn.first().click();
        }
    }
    await this.page.waitForTimeout(500);

    // Fill in channel details
    const nameInput = this.page.locator('[data-testid="compose-name-input"], input[placeholder*="Channel Name"], input[name="name"]');
    if (await nameInput.count() > 0) {
      await nameInput.first().fill('');
      await nameInput.first().fill(name);
    }

    const descInput = this.page.locator('[data-testid="compose-description-input"], textarea[placeholder*="thinking"], textarea[name="description"]');
    if (await descInput.count() > 0) {
      await descInput.first().fill('');
      await descInput.first().fill(description);
    }

    // Save channel
    const saveBtn = this.page.locator('[data-testid="compose-save"], button:has-text("Save"), button:has-text("Create")');
    if (await saveBtn.count() > 0) {
        await saveBtn.first().click();
    }
    await this.page.waitForTimeout(1000); // Wait for potential network/storage save
  }

  /**
   * Navigates to the Discover tab and returns text content of all matches.
   */
  async discoverPeers(): Promise<string[]> {
    await this.page.locator('[data-testid="nav-tab-discover"], [data-tab="discover"]').first().click({ force: true });
    await this.page.waitForTimeout(500);

    // Click discover button if present
    const discoverBtn = this.page.locator('button:has-text("Discover"), button:has-text("🔍")');
    if (await discoverBtn.count() > 0) {
      await discoverBtn.first().click({ force: true });
      // Wait for DHT traversal
      await this.page.waitForTimeout(5000);
    }

    // Extract text from match list
    const matchCards = this.page.locator('[data-testid="match-list"] > *');
    const count = await matchCards.count();
    const results: string[] = [];
    for (let i = 0; i < count; i++) {
      const text = await matchCards.nth(i).textContent();
      if (text) results.push(text);
    }
    return results;
  }

  /**
   * Navigates to the Now tab and broadcasts a post to the network.
   */
  async broadcastPost(content: string): Promise<void> {
    await this.page.locator('[data-testid="nav-tab-now"], [data-tab="now"]').first().click({ force: true });
    await this.page.waitForTimeout(500);

    const createBtn = this.page.locator('[data-testid="create-channel-button"], button:has-text("+ Post")');
    if (await createBtn.count() > 0) {
      await createBtn.first().click({ force: true });
      await this.page.waitForTimeout(500);
    }

    // Assume we are now on a compose screen for posts
    // Note: Adjust selector based on actual post compose UI
    const postInput = this.page.locator('textarea[placeholder*="post"], textarea[name="content"], textarea');
    if (await postInput.count() > 0) {
      await postInput.first().fill(content);
      const submitBtn = this.page.locator('button:has-text("Post"), button[type="submit"]');
      if (await submitBtn.count() > 0) {
          await submitBtn.first().click({ force: true });
      }
      await this.page.waitForTimeout(1000); // Wait for gossipsub broadcast
    }
  }

  /**
   * Navigates to the Now tab and extracts text from all visible posts in the "For You" feed.
   */
  async readFeed(): Promise<string[]> {
    await this.page.locator('[data-testid="nav-tab-now"], [data-tab="now"]').first().click({ force: true });
    await this.page.waitForTimeout(2000); // Wait for feed to load/sync

    const posts = this.page.locator('[data-component="post"], [data-testid="post"], .post');
    const count = await posts.count();
    const results: string[] = [];
    for (let i = 0; i < count; i++) {
      const text = await posts.nth(i).textContent();
      if (text) results.push(text);
    }
    return results;
  }

  /**
   * Switches the active channel in the sidebar.
   */
  async switchChannel(channelName: string): Promise<void> {
    // Try to click sidebar item by exact channel name text, ignoring specific data-testid as it might be malformed
    const channelLink = this.page.locator(`text="${channelName}"`).first();
    if (await channelLink.count() > 0) {
      await channelLink.click({ force: true });
      await this.page.waitForTimeout(1000); // Wait for context switch to propagate
    } else {
      throw new Error(`Channel ${channelName} not found in sidebar.`);
    }
  }

  async close(): Promise<void> {
    await this.context.close();
  }
}
