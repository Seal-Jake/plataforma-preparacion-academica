import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { AcademicSession, SessionQuestionsResponse, SessionResult, TipoTarea } from '../models/models';

@Injectable({ providedIn: 'root' })
export class SessionsService {
  constructor(private http: HttpClient) {}

  // El docente crea tantas tareas de cada tipo como quiera: unitId trae
  // también las tareas de los temas de esa unidad (por defecto); pasa
  // soloDirectas:true para traer solo las propias de la unidad.
  list(params: { courseId?: string; unitId?: string; topicId?: string; soloDirectas?: boolean }) {
    const httpParams: Record<string, string> = {};
    if (params.courseId) httpParams['courseId'] = params.courseId;
    if (params.unitId) httpParams['unitId'] = params.unitId;
    if (params.topicId) httpParams['topicId'] = params.topicId;
    if (params.soloDirectas) httpParams['soloDirectas'] = '1';
    return this.http.get<AcademicSession[]>('/api/sessions', { params: httpParams });
  }

  get(id: string) {
    return this.http.get<AcademicSession>(`/api/sessions/${id}`);
  }

  create(data: {
    tipo: TipoTarea;
    courseId?: string;
    unitId?: string;
    topicId?: string;
    title: string;
    dueDate?: string | null;
    timeLimitMinutes?: number | null;
  }) {
    return this.http.post<AcademicSession>('/api/sessions', data);
  }

  delete(id: string) {
    return this.http.delete<{ ok: boolean }>(`/api/sessions/${id}`);
  }

  update(
    id: string,
    data: Partial<{
      title: string;
      questionIds: string[];
      dueDate: string | null;
      timeLimitMinutes: number | null;
    }>
  ) {
    return this.http.put<AcademicSession>(`/api/sessions/${id}`, data);
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

  answerAbierta(id: string, questionId: string, respuestaTexto: string | null, archivo: File | null) {
    const form = new FormData();
    form.append('questionId', questionId);
    if (respuestaTexto) form.append('respuestaTexto', respuestaTexto);
    if (archivo) form.append('archivo', archivo);
    return this.http.patch<{ respuestaTexto: string | null; tieneArchivo: boolean }>(
      `/api/sessions/${id}/answer-abierta`,
      form
    );
  }

  archivoRespuestaUrl(sessionId: string, questionId: string, studentId?: string) {
    const suffix = studentId ? `?studentId=${studentId}` : '';
    return `/api/sessions/${sessionId}/attempts/${questionId}/archivo${suffix}`;
  }

  calificarRespuesta(sessionId: string, questionId: string, studentId: string, nota: number) {
    return this.http.patch<{ puntaje: number; correct: boolean }>(
      `/api/sessions/${sessionId}/attempts/${questionId}/calificar`,
      { studentId, nota }
    );
  }

  reabrir(id: string, studentId: string) {
    return this.http.post<{ ok: boolean }>(`/api/sessions/${id}/reabrir`, { studentId });
  }

  finish(id: string) {
    return this.http.post(`/api/sessions/${id}/finish`, {});
  }

  result(id: string, studentId?: string) {
    const params = studentId ? { studentId } : undefined;
    return this.http.get<SessionResult>(`/api/sessions/${id}/result`, { params });
  }
}
