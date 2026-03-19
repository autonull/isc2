import { UIComponent } from '../Component.js';
import { CommunityService } from '../../social/communities/services/CommunityService.js';
import { AudioSpaceService } from '../../social/audio-spaces/services/AudioSpaceService.js';

interface CommunitiesState {
  communities: any[];
  audioSpaces: any[];
  loading: boolean;
}

export class CommunitiesScreen extends UIComponent<any, CommunitiesState> {
  constructor(props: any) {
    super('div', props, { communities: [], audioSpaces: [], loading: true });
    this.element.className = 'screen communities-screen';
    this.element.dataset.testid = 'communities-screen';
    this.element.style.display = 'flex';
    this.element.style.flexDirection = 'column';
    this.element.style.height = '100%';
    this.element.style.background = '#f5f8fa';
  }

  protected async onMount() {
    this.setState({ loading: true });

    try {
        const communitySvc = CommunityService.getInstance();
        const audioSvc = AudioSpaceService.getInstance();

        await communitySvc.initialize(); // Ensure DB is ready
        const communities = await communitySvc.getUserCommunities();
        const audioSpaces = audioSvc.getAllSpaces();

        this.setState({ communities, audioSpaces, loading: false });
    } catch (e) {
        console.error('[CommunitiesScreen] Failed to load', e);
        this.setState({ loading: false });
    }
  }

  protected render() {
      this.element.innerHTML = `
        <div class="channel-header" style="padding: 16px 20px; border-bottom: 1px solid #e1e8ed; background: white; display: flex; justify-content: space-between; align-items: center;">
          <div>
            <h2 style="font-size: 20px; font-weight: bold; margin: 0; color: #14171a;">👥 Communities</h2>
            <p style="font-size: 14px; color: #657786; margin: 4px 0 0 0;">Shared spaces based on semantic similarity.</p>
          </div>
          <button id="create-community-btn" style="padding: 8px 16px; background: #1da1f2; color: white; border: none; border-radius: 20px; font-size: 14px; font-weight: bold; cursor: pointer;">+ Create</button>
        </div>

        <div id="audio-spaces-container"></div>

        <div id="communities-content" style="flex: 1; padding: 20px; overflow-y: auto;">
           <div id="loading-state" style="text-align: center; padding: 40px 20px; color: #657786;">Loading communities...</div>
        </div>
      `;

      const createBtn = this.element.querySelector('#create-community-btn');
      if (createBtn) {
          createBtn.addEventListener('click', () => {
             // In a real implementation this would open a modal to create a community
             alert('Creating communities UI is coming in a future update.');
          });
      }
  }

  protected update(prevState: CommunitiesState) {
     if (prevState.loading !== this.state.loading || prevState.communities !== this.state.communities || prevState.audioSpaces !== this.state.audioSpaces) {

         const content = this.element.querySelector('#communities-content');
         const audioContainer = this.element.querySelector('#audio-spaces-container');
         if (!content || !audioContainer) return;

         if (this.state.loading) {
             content.innerHTML = '<div style="text-align: center; padding: 40px 20px; color: #657786;">Loading communities...</div>';
             return;
         }

         // Audio Spaces Banner
         if (this.state.audioSpaces.length > 0) {
             const activeSpace = this.state.audioSpaces[0]; // just show first for now
             audioContainer.innerHTML = `
                <div style="background: #e8f4fd; border-bottom: 1px solid #c8e1f5; padding: 12px 20px; display: flex; justify-content: space-between; align-items: center; cursor: pointer;">
                   <div style="display: flex; align-items: center; gap: 8px;">
                      <span style="font-size: 14px; font-weight: bold; color: #1da1f2;">🔴 Live Audio Space</span>
                      <span style="font-size: 13px; color: #657786;">${activeSpace.participants?.length || 1} listening</span>
                   </div>
                   <button style="padding: 6px 12px; background: #1da1f2; color: white; border: none; border-radius: 12px; font-weight: bold; font-size: 12px; cursor: pointer;">Join</button>
                </div>
             `;
         } else {
             audioContainer.innerHTML = '';
         }

         // Communities List
         if (this.state.communities.length === 0) {
             content.innerHTML = `
                <div style="text-align: center; padding: 60px 20px; color: #657786;">
                  <div style="font-size: 48px; margin-bottom: 16px;">👥</div>
                  <h3 style="margin: 0 0 8px 0; font-size: 18px;">No communities found</h3>
                  <p style="margin: 0; font-size: 14px; margin-bottom: 16px;">You are not a member of any communities yet.</p>
                </div>
             `;
         } else {
             content.innerHTML = `
                 <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 16px;">
                    ${this.state.communities.map(c => `
                        <div style="background: white; border: 1px solid #e1e8ed; border-radius: 12px; padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); display: flex; flex-direction: column;">
                           <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
                               <h3 style="margin: 0; font-size: 16px; font-weight: bold; color: #14171a;">${this.escapeHTML(c.name)}</h3>
                               <span style="background: #f5f8fa; padding: 4px 8px; border-radius: 12px; font-size: 12px; font-weight: bold; color: #657786;">${c.members?.length || 1} members</span>
                           </div>
                           <p style="margin: 0 0 16px 0; font-size: 14px; color: #657786; line-height: 1.5; flex: 1;">${this.escapeHTML(c.description)}</p>
                           <button style="width: 100%; padding: 10px; background: transparent; border: 1px solid #1da1f2; color: #1da1f2; border-radius: 20px; font-weight: bold; font-size: 14px; cursor: pointer; transition: background 0.2s;">Open</button>
                        </div>
                    `).join('')}
                 </div>
             `;
         }
     }
  }

  private escapeHTML(str: string): string {
    if (!str) return '';
    return str.replace(/[&<>'"]/g,
      tag => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;'
      }[tag] || tag)
    );
  }
}
