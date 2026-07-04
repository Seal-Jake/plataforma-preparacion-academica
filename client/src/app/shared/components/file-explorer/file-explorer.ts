import { Component, Input, OnInit, inject, signal } from '@angular/core';
import { FoldersService } from '../../../core/services/folders.service';
import { FolderNode, FolderTreeResponse } from '../../../core/models/models';
import { FolderNodeComponent } from './folder-node';

@Component({
  selector: 'app-file-explorer',
  imports: [FolderNodeComponent],
  templateUrl: './file-explorer.html',
  styleUrl: './file-explorer.css',
})
export class FileExplorer implements OnInit {
  private foldersSvc = inject(FoldersService);

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
}
