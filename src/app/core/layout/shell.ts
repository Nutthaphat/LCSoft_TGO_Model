import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { getElectronApi } from '../electron/electron-api';
import { ProjectStore } from '../stores/project.store';

interface NavItem {
  label: string;
  path: string;
  icon: string;
}

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Shell {
  private readonly projectStore = inject(ProjectStore);

  readonly project = this.projectStore.project;
  readonly runtimeLabel = signal('Local storage · Single user');

  readonly navItems: NavItem[] = [
    { label: 'Dashboard', path: '/dashboard', icon: 'dashboard' },
    { label: 'Projects', path: '/projects', icon: 'folder' },
    { label: 'Streams', path: '/streams', icon: 'water_drop' },
    { label: 'Equipment', path: '/equipment', icon: 'build' },
    { label: 'Transportation', path: '/transportation', icon: 'local_shipping' },
    { label: 'Emission Database', path: '/database', icon: 'database' },
    { label: 'Calculation', path: '/calculation', icon: 'calculate' },
    { label: 'Diagram', path: '/diagram', icon: 'account_tree' },
    { label: 'Reports', path: '/reports', icon: 'description' },
    { label: 'Backup', path: '/settings', icon: 'backup' },
  ];

  constructor() {
    void this.resolveRuntimeLabel();
  }

  private async resolveRuntimeLabel(): Promise<void> {
    const api = getElectronApi();
    if (!api) {
      this.runtimeLabel.set('Browser · localStorage');
      return;
    }
    try {
      const info = await api.getInfo();
      this.runtimeLabel.set(``);
      console.info('[LCSoft] SQLite path:', info.dbPath);
    } catch {
      this.runtimeLabel.set('');
    }
  }
}
