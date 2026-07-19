import { Component, EventEmitter, Input, Output, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { FoldersService } from '../../../core/services/folders.service';
import { FilesService } from '../../../core/services/files.service';
import { ConfirmDialogService } from '../../../core/services/confirm-dialog.service';
import { FolderNode } from '../../../core/models/models';

@Component({
  selector: 'app-folder-node',
  imports: [FormsModule, FolderNodeComponent],
  templateUrl: './folder-node.html',
  styleUrl: './folder-node.css',
})
export class FolderNodeComponent {
  private foldersSvc = inject(FoldersService);
  private filesSvc = inject(FilesService);
  private confirmSvc = inject(ConfirmDialogService);

  @Input({ required: true }) folder!: FolderNode;
  @Input({ required: true }) modo!: 'docente' | 'estudiante';
  @Input() topicId!: string;
  @Output() changed = new EventEmitter<void>();

  expanded = signal(true);
  showAddSubfolder = signal(false);
  showUploadForm = signal(false);
  nuevoNombreSubcarpeta = '';
  nuevoArchivoNombre = '';
  nuevoArchivoTexto = '';
  archivoSeleccionado: File | null = null;
  renombrando = signal(false);
  nombreEditado = '';

  toggle() {
    this.expanded.set(!this.expanded());
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    this.archivoSeleccionado = input.files?.[0] ?? null;
  }

  crearSubcarpeta() {
    if (!this.nuevoNombreSubcarpeta.trim()) return;
    this.foldersSvc.createSubfolder(this.topicId, this.folder.id, this.nuevoNombreSubcarpeta.trim()).subscribe(() => {
      this.nuevoNombreSubcarpeta = '';
      this.showAddSubfolder.set(false);
      this.changed.emit();
    });
  }

  guardarArchivo() {
    if (!this.nuevoArchivoNombre.trim()) return;
    this.foldersSvc
      .uploadFile(this.folder.id, this.nuevoArchivoNombre.trim(), this.nuevoArchivoTexto.trim() || null, this.archivoSeleccionado)
      .subscribe(() => {
        this.nuevoArchivoNombre = '';
        this.nuevoArchivoTexto = '';
        this.archivoSeleccionado = null;
        this.showUploadForm.set(false);
        this.changed.emit();
      });
  }

  startRename() {
    this.nombreEditado = this.folder.nombre;
    this.renombrando.set(true);
  }

  guardarRename() {
    if (!this.nombreEditado.trim()) return;
    this.foldersSvc.rename(this.folder.id, this.nombreEditado.trim()).subscribe(() => {
      this.renombrando.set(false);
      this.changed.emit();
    });
  }

  async eliminarCarpeta() {
    if (!(await this.confirmSvc.confirm(`¿Eliminar la carpeta "${this.folder.nombre}" y todo su contenido?`))) return;
    this.foldersSvc.delete(this.folder.id).subscribe(() => this.changed.emit());
  }

  async eliminarArchivo(fileId: string) {
    if (!(await this.confirmSvc.confirm('¿Eliminar este archivo?'))) return;
    this.filesSvc.delete(fileId).subscribe(() => this.changed.emit());
  }

  descargarArchivo(fileId: string, nombre: string) {
    this.filesSvc.download(fileId, nombre);
  }

  toggleCompletado() {
    if (this.folder.completado) {
      this.foldersSvc.desmarcarCompletado(this.folder.id).subscribe(() => this.changed.emit());
    } else {
      this.foldersSvc.marcarCompletado(this.folder.id).subscribe(() => this.changed.emit());
    }
  }

  formatSize(bytes: number | null): string {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
}
