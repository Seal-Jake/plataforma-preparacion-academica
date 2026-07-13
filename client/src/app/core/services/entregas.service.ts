import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Entrega } from '../models/models';

@Injectable({ providedIn: 'root' })
export class EntregasService {
  constructor(private http: HttpClient) {}

  mine(sessionId: string) {
    return this.http.get<Entrega>(`/api/entregas/mine/${sessionId}`);
  }

  submitMine(sessionId: string, contenidoTexto: string | null, archivo: File | null) {
    const form = new FormData();
    if (contenidoTexto) form.append('contenidoTexto', contenidoTexto);
    if (archivo) form.append('archivo', archivo);
    return this.http.put<Entrega>(`/api/entregas/mine/${sessionId}`, form);
  }

  listBySession(sessionId: string) {
    return this.http.get<Entrega[]>(`/api/entregas/session/${sessionId}`);
  }

  calificar(sessionId: string, studentId: string, nota: number, feedback?: string) {
    return this.http.patch<Entrega>(`/api/entregas/${sessionId}/${studentId}/calificar`, { nota, feedback });
  }

  reabrir(sessionId: string, studentId: string) {
    return this.http.post<{ ok: boolean }>(`/api/entregas/${sessionId}/${studentId}/reabrir`, {});
  }

  archivoUrl(sessionId: string, studentId?: string) {
    const suffix = studentId ? `?studentId=${studentId}` : '';
    return `/api/entregas/mine/${sessionId}/archivo${suffix}`;
  }
}
