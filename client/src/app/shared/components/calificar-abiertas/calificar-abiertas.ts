import { Component, Input, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SessionsService } from '../../../core/services/sessions.service';
import { Enrollment, SessionResult } from '../../../core/models/models';
import { Icon } from '../icon/icon';

@Component({
  selector: 'app-calificar-abiertas',
  imports: [FormsModule, Icon],
  templateUrl: './calificar-abiertas.html',
  styleUrl: './calificar-abiertas.css',
})
export class CalificarAbiertas implements OnInit {
  private sessionsSvc = inject(SessionsService);

  @Input({ required: true }) sessionId!: string;
  @Input({ required: true }) enrollments!: Enrollment[];

  selectedStudentId = signal<string>('');
  result = signal<SessionResult | null>(null);
  notasEnEdicion: Record<string, number> = {};
  guardadoQuestionId = signal<string | null>(null);

  ngOnInit() {
    if (this.enrollments.length) this.selectStudent(this.enrollments[0].studentId);
  }

  selectStudent(studentId: string) {
    this.selectedStudentId.set(studentId);
    this.result.set(null);
    if (!studentId) return;
    this.sessionsSvc.result(this.sessionId, studentId).subscribe((r) => {
      this.result.set(r);
      this.notasEnEdicion = {};
      for (const resp of r.respuestas) {
        if (resp.modoRespuesta === 'abierta') {
          this.notasEnEdicion[resp.questionId] = resp.puntaje !== null ? Math.round(resp.puntaje * 20 * 100) / 100 : 0;
        }
      }
    });
  }

  respuestasAbiertas() {
    return this.result()?.respuestas.filter((r) => r.modoRespuesta === 'abierta') ?? [];
  }

  estadoDe(resp: { respondida: boolean; puntaje: number | null }): 'sin_responder' | 'pendiente' | 'calificado' {
    if (resp.puntaje !== null) return 'calificado';
    if (resp.respondida) return 'pendiente';
    return 'sin_responder';
  }

  calificadasCount(): number {
    return this.respuestasAbiertas().filter((r) => r.puntaje !== null).length;
  }

  archivoUrl(questionId: string): string {
    return this.sessionsSvc.archivoRespuestaUrl(this.sessionId, questionId, this.selectedStudentId());
  }

  guardarNota(questionId: string) {
    const nota = this.notasEnEdicion[questionId];
    const studentId = this.selectedStudentId();
    if (nota === undefined || nota === null || !studentId) return;
    this.sessionsSvc.calificarRespuesta(this.sessionId, questionId, studentId, nota).subscribe(() => {
      this.guardadoQuestionId.set(questionId);
      setTimeout(() => this.guardadoQuestionId.set(null), 2000);
      this.selectStudent(studentId);
    });
  }

  studentName(id: string): string {
    return this.enrollments.find((e) => e.studentId === id)?.student?.name ?? id;
  }
}
