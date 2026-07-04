import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Course, CourseInfoResponse, Unit, Topic } from '../models/models';

@Injectable({ providedIn: 'root' })
export class CoursesService {
  constructor(private http: HttpClient) {}

  list() {
    return this.http.get<Course[]>('/api/courses');
  }

  get(id: string) {
    return this.http.get<Course>(`/api/courses/${id}`);
  }

  create(data: { name: string; orderIndex?: number }) {
    return this.http.post<Course>('/api/courses', data);
  }

  info(id: string) {
    return this.http.get<CourseInfoResponse>(`/api/courses/${id}/info`);
  }

  updateInfo(id: string, infoEvaluacion: string) {
    return this.http.put<Course>(`/api/courses/${id}/info`, { infoEvaluacion });
  }

  getUnit(id: string) {
    return this.http.get<Unit>(`/api/units/${id}`);
  }

  createUnit(data: { courseId: string; name: string; orderIndex?: number }) {
    return this.http.post<Unit>('/api/units', data);
  }

  getTopic(id: string) {
    return this.http.get<Topic>(`/api/topics/${id}`);
  }

  createTopic(data: { unitId: string; name: string; orderIndex?: number; subtemas?: string }) {
    return this.http.post<Topic>('/api/topics', data);
  }
}
