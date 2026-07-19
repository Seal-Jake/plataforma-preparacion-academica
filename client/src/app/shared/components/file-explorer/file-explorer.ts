import { Component, Input, OnInit, inject, signal } from '@angular/core';
import { FoldersService } from '../../../core/services/folders.service';
import { ConfirmDialogService } from '../../../core/services/confirm-dialog.service';
import { FolderNode, FolderTreeResponse } from '../../../core/models/models';
import { FolderNodeComponent } from './folder-node';
import { Icon } from '../icon/icon';

@Component({
  selector: 'app-file-explorer',
  imports: [FolderNodeComponent, Icon],
  templateUrl: './file-explorer.html',
  styleUrl: './file-explorer.css',
})
export class FileExplorer implements OnInit {
  private foldersSvc = inject(FoldersService);
  private confirmSvc = inject(ConfirmDialogService);

  @Input({ required: true }) topicId!: string;
  @Input({ required: true }) modo!: 'docente' | 'estudiante';

  tree = signal<FolderNode[]>([]);
  progreso = signal<FolderTreeResponse['progreso'] | null>(null);
  cargando = signal(true);

  ngOnInit() {
    this.reload();
  }

  reload() {
    this.foldersSvc.tree(this.topicId).subscribe((res) => {
      this.tree.set(res.tree);
      this.progreso.set(res.progreso);
      this.cargando.set(false);
    });
  }

  tieneContenido(): boolean {
    return this.tree().some((f) => f.archivos.length > 0 || f.children.length > 0);
  }

  async vaciarTema() {
    if (
      !(await this.confirmSvc.confirm(
        '¿Vaciar TODO el contenido de este tema? Se borrarán todos los archivos y subcarpetas de las 4 carpetas fijas, en todos los niveles. Las carpetas fijas seguirán existiendo, vacías.',
        { confirmLabel: 'Vaciar todo' }
      ))
    )
      return;
    this.foldersSvc.vaciarTema(this.topicId).subscribe(() => this.reload());
  }
}
