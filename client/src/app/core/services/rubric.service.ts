import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FilaPlanilla, PendientesCalificacion, RubricaResultado } from '../models/models';

@Injectable({ providedIn: 'root' })
export class RubricService {
  constructor(private http: HttpClient) {}

  getCurso(courseId: string, studentId?: string) {
    const params = studentId ? { studentId } : undefined;
    return this.http.get<RubricaResultado>(`/api/rubric/course/${courseId}`, { params });
  }

  getPlanillaCurso(courseId: string) {
    return this.http.get<FilaPlanilla[]>(`/api/rubric/course/${courseId}/planilla`);
  }

  getPendientesCurso(courseId: string) {
    return this.http.get<PendientesCalificacion>(`/api/rubric/course/${courseId}/pendientes`);
  }
}
