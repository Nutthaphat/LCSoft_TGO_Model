import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-feature-placeholder',
  template: `
    <section class="page">
      <header class="page__header">
        <h1 class="page__title">{{ title() }}</h1>
        <p class="page__subtitle">{{ subtitle() }}</p>
      </header>
      <div class="placeholder-page">
        <h2>{{ title() }} is scaffolded</h2>
        <p>
          This page is ready for the next implementation step. The app currently runs on
          Angular mock data with LCSoft Excel import support.
        </p>
      </div>
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FeaturePlaceholder {
  readonly title = input.required<string>();
  readonly subtitle = input.required<string>();
}
