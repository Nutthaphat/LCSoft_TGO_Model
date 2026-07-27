import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toast } from 'ngx-sonner';
import { ExcelImportService } from '../../../core/services/excel-import.service';
import { ProjectStore } from '../../../core/stores/project.store';
import { ProcessStream } from '../../../models/domain.model';

@Component({
  selector: 'app-streams-page',
  imports: [DecimalPipe],
  templateUrl: './streams.page.html',
  styleUrl: './streams.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StreamsPage {
  private readonly projectStore = inject(ProjectStore);
  private readonly excelImport = inject(ExcelImportService);

  readonly streams = this.projectStore.streams;
  readonly importing = signal(false);
  readonly selectedStreamId = signal<string | null>(null);

  readonly selectedStream = computed(() => {
    const id = this.selectedStreamId();
    if (!id) {
      return null;
    }
    return this.streams().find((stream) => stream.id === id) ?? null;
  });

  selectStream(stream: ProcessStream): void {
    this.selectedStreamId.set(stream.id);
  }

  clearSelection(): void {
    this.selectedStreamId.set(null);
  }

  async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }

    this.importing.set(true);
    try {
      const count = await this.excelImport.importStreamFile(file);
      this.clearSelection();
      toast.success(`Imported ${count} streams from ${file.name}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Stream import failed';
      toast.error(message);
    } finally {
      this.importing.set(false);
      input.value = '';
    }
  }
}
