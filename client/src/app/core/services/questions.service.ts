import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Nivel, Question, Seccion, TipoPregunta } from '../models/models';

export interface QuestionFilter {
  topicId?: string;
  sessionId?: string;
  nivel?: Nivel;
  tipo?: TipoPregunta;
  section?: Seccion;
  q?: string;
}

@Injectable({ providedIn: 'root' })
export class QuestionsService {
  constructor(private http: HttpClient) {}

  list(filter: QuestionFilter) {
    const params: Record<string, string> = {};
    if (filter.topicId) params['topicId'] = filter.topicId;
    if (filter.sessionId) params['sessionId'] = filter.sessionId;
    if (filter.nivel) params['nivel'] = filter.nivel;
    if (filter.tipo) params['tipo'] = filter.tipo;
    if (filter.section) params['section'] = filter.section;
    if (filter.q) params['q'] = filter.q;
    return this.http.get<Question[]>('/api/questions', { params });
  }

  create(data: Partial<Question>) {
    return this.http.post<Question>('/api/questions', data);
  }

  update(id: string, data: Partial<Question>) {
    return this.http.put<Question>(`/api/questions/${id}`, data);
  }

  delete(id: string) {
    return this.http.delete<void>(`/api/questions/${id}`);
  }

  uploadArchivo(id: string, archivo: File) {
    const form = new FormData();
    form.append('archivo', archivo);
    return this.http.post<{ id: string; tieneArchivo: boolean }>(`/api/questions/${id}/archivo`, form);
  }

  eliminarArchivo(id: string) {
    return this.http.delete<void>(`/api/questions/${id}/archivo`);
  }

  archivoUrl(id: string): string {
    return `/api/questions/${id}/archivo`;
  }
}
