import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { DashboardResponse } from '../models/models';

@Injectable({ providedIn: 'root' })
export class DashboardService {
  constructor(private http: HttpClient) {}

  get() {
    return this.http.get<DashboardResponse>('/api/dashboard');
  }
}
