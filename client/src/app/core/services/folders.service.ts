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

  vaciar(id: string) {
    return this.http.post<{ ok: boolean }>(`/api/folders/${id}/vaciar`, {});
  }

  vaciarTema(topicId: string) {
    return this.http.post<{ ok: boolean }>(`/api/folders/topic/${topicId}/vaciar`, {});
  }

  uploadFile(folderId: string, nombre: string | null, contenidoTexto: string | null, archivos: File[]) {
    const form = new FormData();
    if (nombre) form.append('nombre', nombre);
    if (contenidoTexto) form.append('contenidoTexto', contenidoTexto);
    for (const archivo of archivos) form.append('archivo', archivo);
    return this.http.post(`/api/folders/${folderId}/archivos`, form);
  }

  marcarCompletado(folderId: string) {
    return this.http.post(`/api/folders/${folderId}/progreso`, {});
  }

  desmarcarCompletado(folderId: string) {
    return this.http.delete<void>(`/api/folders/${folderId}/progreso`);
  }
}
