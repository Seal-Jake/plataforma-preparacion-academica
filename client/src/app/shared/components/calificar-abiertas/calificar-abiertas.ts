import { Component, EventEmitter, Input, OnInit, Output, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SessionsService } from '../../../core/services/sessions.service';
import { ConfirmDialogService } from '../../../core/services/confirm-dialog.service';
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
  private confirmSvc = inject(ConfirmDialogService);

  @Input({ required: true }) sessionId!: string;
  @Input({ required: true }) enrollments!: Enrollment[];
  // Se emite tras calificar o reabrir, para que el contenedor pueda
  // refrescar contadores de pendientes que dependen de estos datos.
  @Output() cambiado = new EventEmitter<void>();

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
      this.cambiado.emit();
    });
  }

  async reabrirIntento() {
    const studentId = this.selectedStudentId();
    if (!studentId) return;
    const nombre = this.studentName(studentId);
    if (
      !(await this.confirmSvc.confirm(
        `¿Reabrir el intento de ${nombre}? Se borrarán todas sus respuestas de esta sesión (incluidas las ya calificadas) para que pueda rendirla de nuevo desde cero.`,
        { confirmLabel: 'Reabrir' }
      ))
    )
      return;
    // Se oculta el formulario mientras se reabre: si quedara visible con las
    // notas anteriores, un clic en "Guardar" en ese instante las volvería a
    // grabar sobre el intento recién borrado.
    this.result.set(null);
    this.sessionsSvc.reabrir(this.sessionId, studentId).subscribe(() => {
      this.selectStudent(studentId);
      this.cambiado.emit();
    });
  }

  studentName(id: string): string {
    return this.enrollments.find((e) => e.studentId === id)?.student?.name ?? id;
  }
}
