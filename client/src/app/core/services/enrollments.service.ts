import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Enrollment, StudentInfo } from '../models/models';

@Injectable({ providedIn: 'root' })
export class EnrollmentsService {
  constructor(private http: HttpClient) {}

  listByCourse(courseId: string) {
    return this.http.get<Enrollment[]>('/api/enrollments', { params: { courseId } });
  }

  enroll(studentId: string, courseId: string) {
    return this.http.post<Enrollment>('/api/enrollments', { studentId, courseId });
  }

  unenroll(id: string) {
    return this.http.delete<void>(`/api/enrollments/${id}`);
  }

  listStudents() {
    return this.http.get<StudentInfo[]>('/api/auth/estudiantes');
  }

  createStudent(name: string, email: string, password: string) {
    return this.http.post<StudentInfo>('/api/auth/register-estudiante', { name, email, password });
  }

  // Elimina la cuenta del estudiante por completo (todas sus matrículas y
  // cursos, no solo esta unidad). No se puede deshacer.
  deleteStudent(studentId: string) {
    return this.http.delete<void>(`/api/auth/estudiantes/${studentId}`);
  }
}
