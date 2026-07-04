import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { EvaluationCategoriesResponse, EvaluationCategory, TipoEvaluacion } from '../models/models';

@Injectable({ providedIn: 'root' })
export class EvaluationCategoriesService {
  constructor(private http: HttpClient) {}

  listByUnit(unitId: string) {
    return this.http.get<EvaluationCategoriesResponse>(`/api/evaluation-categories/unit/${unitId}`);
  }

  create(data: { unitId: string; nombre: string; peso: number; tipoEvaluacion: TipoEvaluacion; promediarPorTema?: boolean }) {
    return this.http.post<EvaluationCategory>('/api/evaluation-categories', data);
  }

  update(id: string, data: Partial<EvaluationCategory>) {
    return this.http.put<EvaluationCategory>(`/api/evaluation-categories/${id}`, data);
  }

  delete(id: string) {
    return this.http.delete<void>(`/api/evaluation-categories/${id}`);
  }
}
