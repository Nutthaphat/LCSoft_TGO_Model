import { Routes } from '@angular/router';
import { Shell } from './core/layout/shell';

export const routes: Routes = [
  {
    path: '',
    component: Shell,
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/dashboard/pages/dashboard.page').then((m) => m.DashboardPage),
      },
      {
        path: 'projects',
        loadComponent: () =>
          import('./features/projects/pages/projects.page').then((m) => m.ProjectsPage),
      },
      {
        path: 'streams',
        loadComponent: () =>
          import('./features/streams/pages/streams.page').then((m) => m.StreamsPage),
      },
      {
        path: 'equipment',
        loadComponent: () =>
          import('./features/equipment/pages/equipment.page').then((m) => m.EquipmentPage),
      },
      {
        path: 'database',
        loadComponent: () =>
          import('./features/database/pages/database.page').then((m) => m.DatabasePage),
      },
      {
        path: 'calculation',
        loadComponent: () =>
          import('./features/calculation/pages/calculation.page').then(
            (m) => m.CalculationPage,
          ),
      },
      {
        path: 'diagram',
        loadComponent: () =>
          import('./features/diagram/pages/diagram.page').then((m) => m.DiagramPage),
      },
      {
        path: 'reports',
        loadComponent: () =>
          import('./features/reports/pages/reports.page').then((m) => m.ReportsPage),
      },
      {
        path: 'settings',
        loadComponent: () =>
          import('./features/settings/pages/settings.page').then((m) => m.SettingsPage),
      },
    ],
  },
  { path: '**', redirectTo: 'dashboard' },
];
