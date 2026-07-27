import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { toast } from 'ngx-sonner';
import { ExcelImportService } from '../../../core/services/excel-import.service';
import { ProjectStore } from '../../../core/stores/project.store';

@Component({
  selector: 'app-equipment-page',
  imports: [DecimalPipe],
  templateUrl: './equipment.page.html',
  styleUrl: './equipment.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EquipmentPage {
  private readonly projectStore = inject(ProjectStore);
  private readonly excelImport = inject(ExcelImportService);

  readonly equipment = this.projectStore.equipment;
  readonly importing = signal(false);

  async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }

    this.importing.set(true);
    try {
      const count = await this.excelImport.importEquipmentFile(file);
      toast.success(`Imported ${count} equipment items from ${file.name}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Equipment import failed';
      toast.error(message);
    } finally {
      this.importing.set(false);
      input.value = '';
    }
  }
}
