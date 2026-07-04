import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Nivel, Question, Seccion, TipoPregunta } from '../models/models';

export interface QuestionFilter {
  topicId: string;
  nivel?: Nivel;
  tipo?: TipoPregunta;
  section?: Seccion;
  q?: string;
}

@Injectable({ providedIn: 'root' })
export class QuestionsService {
  constructor(private http: HttpClient) {}

  list(filter: QuestionFilter) {
    const params: Record<string, string> = { topicId: filter.topicId };
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

  importCsv(topicId: string, csv: string) {
    return this.http.post<{ importadas: number; errores: { fila: number; error: string }[] }>(
      '/api/questions/import',
      { topicId, csv }
    );
  }
}
