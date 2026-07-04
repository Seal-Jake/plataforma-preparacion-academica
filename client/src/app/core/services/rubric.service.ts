import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { RubricaResultado } from '../models/models';

@Injectable({ providedIn: 'root' })
export class RubricService {
  constructor(private http: HttpClient) {}

  get(unitId: string, studentId?: string) {
    const params = studentId ? { studentId } : undefined;
    return this.http.get<RubricaResultado>(`/api/rubric/unit/${unitId}`, { params });
  }
}
