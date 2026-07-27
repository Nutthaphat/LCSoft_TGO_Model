import { DatePipe, DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Router } from '@angular/router';
import { toast } from 'ngx-sonner';
import { ProjectStore } from '../../../core/stores/project.store';
import { ProjectListItem } from '../../../models/domain.model';

@Component({
  selector: 'app-projects-page',
  imports: [ReactiveFormsModule, DatePipe, DecimalPipe],
  templateUrl: './projects.page.html',
  styleUrl: './projects.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectsPage {
  private readonly projectStore = inject(ProjectStore);
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);

  readonly projects = this.projectStore.projectList;
  readonly activeProject = this.projectStore.project;
  readonly showCreateForm = signal(false);
  readonly editingId = signal<string | null>(null);

  readonly createForm = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    description: [''],
    seedDemoData: [false],
  });

  readonly editForm = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    description: [''],
  });

  readonly activeId = computed(() => this.activeProject().id);

  openCreateForm(): void {
    this.showCreateForm.set(true);
    this.createForm.reset({
      name: '',
      description: '',
      seedDemoData: false,
    });
  }

  cancelCreate(): void {
    this.showCreateForm.set(false);
  }

  createProject(): void {
    if (this.createForm.invalid) {
      this.createForm.markAllAsTouched();
      return;
    }

    const value = this.createForm.getRawValue();
    const project = this.projectStore.createProject({
      name: value.name,
      description: value.description,
      selectedEmissionSourceIds: this.activeProject().selectedEmissionSourceIds,
      seedDemoData: value.seedDemoData,
    });

    this.showCreateForm.set(false);
    toast.success(`Created project "${project.name}"`);
  }

  openProject(item: ProjectListItem): void {
    const ok = this.projectStore.openProject(item.id);
    if (!ok) {
      toast.error('Could not open project');
      return;
    }
    toast.success(`Opened "${item.name}"`);
    void this.router.navigateByUrl('/dashboard');
  }

  startEdit(item: ProjectListItem): void {
    this.editingId.set(item.id);
    this.editForm.reset({
      name: item.name,
      description: item.description,
    });
  }

  cancelEdit(): void {
    this.editingId.set(null);
  }

  saveEdit(item: ProjectListItem): void {
    if (this.editForm.invalid) {
      this.editForm.markAllAsTouched();
      return;
    }

    const value = this.editForm.getRawValue();
    const ok = this.projectStore.updateStoredProjectMeta(item.id, {
      name: value.name,
      description: value.description,
    });

    if (!ok) {
      toast.error('Could not update project');
      return;
    }

    this.editingId.set(null);
    toast.success('Project updated');
  }

  saveActive(): void {
    this.projectStore.saveProject();
    toast.success('Project saved locally');
  }

  duplicate(item: ProjectListItem): void {
    const copy = this.projectStore.duplicateProject(item.id);
    if (!copy) {
      toast.error('Could not duplicate project');
      return;
    }
    toast.success(`Duplicated as "${copy.name}"`);
  }

  delete(item: ProjectListItem): void {
    const confirmed = window.confirm(
      `Delete project "${item.name}"? This cannot be undone.`,
    );
    if (!confirmed) {
      return;
    }
    this.projectStore.deleteProject(item.id);
    toast.success(`Deleted "${item.name}"`);
  }

  exportActive(): void {
    const json = this.projectStore.exportActiveProject();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    const safeName = this.activeProject().name.replace(/[^\w\-]+/g, '_');
    anchor.href = url;
    anchor.download = `${safeName || 'project'}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    toast.success('Exported active project');
  }

  async importProject(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }

    try {
      const raw = await file.text();
      const project = this.projectStore.importProjectFromJson(raw);
      toast.success(`Imported "${project.name}"`);
      void this.router.navigateByUrl('/dashboard');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Import failed';
      toast.error(message);
    } finally {
      input.value = '';
    }
  }
}
