import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { EmissionDatabasePersistenceService } from './core/services/emission-database-persistence.service';
import { ProjectPersistenceService } from './core/services/project-persistence.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideAnimationsAsync(),
    provideAppInitializer(() => {
      const projects = inject(ProjectPersistenceService);
      const emissions = inject(EmissionDatabasePersistenceService);
      return Promise.all([projects.init(), emissions.init()]);
    }),
  ],
};
