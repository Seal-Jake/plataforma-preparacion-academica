import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { AcademicSession, SessionQuestionsResponse, SessionResult } from '../models/models';

@Injectable({ providedIn: 'root' })
export class SessionsService {
  constructor(private http: HttpClient) {}

  listByUnit(unitId: string) {
    return this.http.get<AcademicSession[]>('/api/sessions', { params: { unitId } });
  }

  get(id: string) {
    return this.http.get<AcademicSession>(`/api/sessions/${id}`);
  }

  create(data: {
    unitId: string;
    topicId?: string | null;
    categoriaId: string;
    title: string;
    questionIds: string[];
    dueDate?: string | null;
    timeLimitMinutes?: number | null;
    requiereEvidencia?: boolean;
    pesoAciertos?: number;
    pesoEvidencia?: number;
  }) {
    return this.http.post<AcademicSession>('/api/sessions', data);
  }

  delete(id: string) {
    return this.http.delete<void>(`/api/sessions/${id}`);
  }

  toggleApertura(id: string, abiertoParaTodos: boolean) {
    return this.http.patch<AcademicSession>(`/api/sessions/${id}/apertura`, { abiertoParaTodos });
  }

  start(id: string) {
    return this.http.post(`/api/sessions/${id}/start`, {});
  }

  questions(id: string) {
    return this.http.get<SessionQuestionsResponse>(`/api/sessions/${id}/questions`);
  }

  answer(id: string, questionId: string, selectedOptionIds: string[]) {
    return this.http.patch<{ correct: boolean; puntaje: number; explicacion?: string }>(
      `/api/sessions/${id}/answer`,
      { questionId, selectedOptionIds }
    );
  }

  finish(id: string) {
    return this.http.post(`/api/sessions/${id}/finish`, {});
  }

  result(id: string, studentId?: string) {
    const params = studentId ? { studentId } : undefined;
    return this.http.get<SessionResult>(`/api/sessions/${id}/result`, { params });
  }
}
