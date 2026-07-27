import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { toast } from 'ngx-sonner';
import { getElectronApi, isElectronRuntime } from '../../../core/electron/electron-api';

@Component({
  selector: 'app-settings-page',
  imports: [],
  templateUrl: './settings.page.html',
  styleUrl: './settings.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsPage {
  readonly isElectron = isElectronRuntime();
  readonly dbPath = signal<string>('Not available in browser mode');
  readonly backingUp = signal(false);

  constructor() {
    void this.loadInfo();
  }

  async backupDatabase(): Promise<void> {
    const api = getElectronApi();
    if (!api) {
      toast.error('SQLite backup is available only in Electron mode');
      return;
    }

    this.backingUp.set(true);
    try {
      const result = await api.backup();
      toast.success(`Backup created: ${result.backupPath}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Backup failed');
    } finally {
      this.backingUp.set(false);
    }
  }

  private async loadInfo(): Promise<void> {
    const api = getElectronApi();
    if (!api) {
      return;
    }
    const info = await api.getInfo();
    this.dbPath.set(info.dbPath);
  }
}
