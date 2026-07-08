import { DEFAULT_SETTINGS, STORAGE_KEYS } from '../shared/constants';
import { loadState, saveState } from '../shared/storage';
import type { SyncSettings } from '../shared/types';

const app = document.getElementById('app');

async function render(): Promise<void> {
  if (!app) return;
  const settings = await loadState<SyncSettings>(STORAGE_KEYS.SETTINGS, DEFAULT_SETTINGS);
  app.innerHTML = `
    <div class="shell">
      <div class="panel">
        <h1 style="margin-top:0;">CodeSync Settings</h1>
        <p class="muted">Configure GitHub sync behavior and commit style for your solutions.</p>
      </div>
      <form id="settings-form">
        <div class="panel">
          <h3>General</h3>
          <div class="grid">
            <label>Repository <input name="repository" value="${settings.repository || ''}" placeholder="owner/repo" /></label>
            <label>Branch <input name="branch" value="${settings.branch || 'main'}" /></label>
          </div>
        </div>
        <div class="panel">
          <h3>Sync Options</h3>
          <div class="grid">
            <label class="toggle"><input type="checkbox" name="autoSync" ${settings.autoSync ? 'checked' : ''} /> Auto sync</label>
            <label class="toggle"><input type="checkbox" name="notifications" ${settings.notifications ? 'checked' : ''} /> Notifications</label>
          </div>
        </div>
        <div class="panel">
          <h3>Commit Template</h3>
          <label>Template <input name="commitTemplate" value="${settings.commitTemplate || 'Solved {title}'}" /></label>
          <div class="muted" style="margin-top:6px;">Preview: ${settings.commitTemplate || 'Solved {title}'}</div>
        </div>
        <div class="panel row">
          <button type="submit">Save Changes</button>
          <button type="button" class="secondary" id="refresh">Refresh Layout</button>
        </div>
      </form>
    </div>
  `;

  document.getElementById('settings-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    const data = new FormData(form);
    const nextSettings: SyncSettings = {
      ...settings,
      repository: String(data.get('repository') ?? ''),
      branch: String(data.get('branch') ?? 'main'),
      commitTemplate: String(data.get('commitTemplate') ?? 'Solved {title}'),
      autoSync: data.get('autoSync') === 'on',
      notifications: data.get('notifications') === 'on'
    };
    await saveState(STORAGE_KEYS.SETTINGS, nextSettings);
    await render();
  });

  document.getElementById('refresh')?.addEventListener('click', () => {
    void render();
  });
}

void render();
