import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FolderTreeResponse } from '../models/models';

@Injectable({ providedIn: 'root' })
export class FoldersService {
  constructor(private http: HttpClient) {}

  tree(topicId: string) {
    return this.http.get<FolderTreeResponse>(`/api/folders/topic/${topicId}`);
  }

  createSubfolder(topicId: string, parentId: string, nombre: string) {
    return this.http.post(`/api/folders`, { topicId, parentId, nombre });
  }

  rename(id: string, nombre: string) {
    return this.http.put(`/api/folders/${id}`, { nombre });
  }

  delete(id: string) {
    return this.http.delete<void>(`/api/folders/${id}`);
  }

  uploadFile(folderId: string, nombre: string, contenidoTexto: string | null, archivo: File | null) {
    const form = new FormData();
    form.append('nombre', nombre);
    if (contenidoTexto) form.append('contenidoTexto', contenidoTexto);
    if (archivo) form.append('archivo', archivo);
    return this.http.post(`/api/folders/${folderId}/archivos`, form);
  }

  marcarCompletado(folderId: string) {
    return this.http.post(`/api/folders/${folderId}/progreso`, {});
  }

  desmarcarCompletado(folderId: string) {
    return this.http.delete<void>(`/api/folders/${folderId}/progreso`);
  }
}
