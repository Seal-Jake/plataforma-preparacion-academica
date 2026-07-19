import { Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { CoursesService } from '../../../core/services/courses.service';
import { SessionsService } from '../../../core/services/sessions.service';
import { QuestionsService } from '../../../core/services/questions.service';
import { EnrollmentsService } from '../../../core/services/enrollments.service';
import { EntregasService } from '../../../core/services/entregas.service';
import { ConfirmDialogService } from '../../../core/services/confirm-dialog.service';
import { Icon } from '../../../shared/components/icon/icon';
import { EmptyState } from '../../../shared/components/empty-state/empty-state';
import { CalificarAbiertas } from '../../../shared/components/calificar-abiertas/calificar-abiertas';
import {
  ayudaTipoSesionFijo,
  esSesionDeEvidencia,
  etiquetaCantidadPreguntas,
  etiquetaNivel,
  etiquetaTipoSesionFijo,
  tiposTareaDeAmbito,
} from '../../../core/utils/labels';
import { AcademicSession, Entrega, Enrollment, Question, Unit } from '../../../core/models/models';

@Component({
  selector: 'app-unit-detail',
  imports: [ReactiveFormsModule, FormsModule, RouterLink, DatePipe, Icon, EmptyState, CalificarAbiertas],
  templateUrl: './unit-detail.html',
  styleUrl: './unit-detail.css',
})
export class UnitDetail implements OnInit {
  private route = inject(ActivatedRoute);
  private coursesSvc = inject(CoursesService);
  private sessionsSvc = inject(SessionsService);
  private questionsSvc = inject(QuestionsService);
  private enrollmentsSvc = inject(EnrollmentsService);
  private entregasSvc = inject(EntregasService);
  private confirmSvc = inject(ConfirmDialogService);
  private fb = inject(FormBuilder);

  etiquetaTipoSesionFijo = etiquetaTipoSesionFijo;
  ayudaTipoSesionFijo = ayudaTipoSesionFijo;
  esSesionDeEvidencia = esSesionDeEvidencia;
  etiquetaNivel = etiquetaNivel;
  etiquetaCantidadPreguntas = etiquetaCantidadPreguntas;

  tiposDisponibles = tiposTareaDeAmbito('unidad');

  unit = signal<Unit | null>(null);
  sessions = signal<AcademicSession[]>([]); // tareas de ámbito unidad (Examen de Unidad, Investigación de Unidad)
  enrollments = signal<Enrollment[]>([]);

  editingSessionId = signal<string | null>(null);
  topicFilter = signal<string>('');
  availableQuestions = signal<Question[]>([]);
  selectedQuestionIds = signal<Set<string>>(new Set());
  assignedQuestions = signal<Question[]>([]);
  showAbiertasPanel = signal(false);

  showCreateForm = signal(false);
  createForm = this.fb.group({
    tipo: ['', Validators.required],
    title: ['', Validators.required],
    dueDate: [''],
    timeLimitMinutes: [null as number | null],
  });

  entregasSessionId = signal<string | null>(null);
  entregasSessionVencido = signal(false);
  entregas = signal<Entrega[]>([]);
  notaEdit: Record<string, number> = {};
  feedbackEdit: Record<string, string> = {};
  guardadoStudentId = signal<string | null>(null);

  sessionEditForm = this.fb.group({
    dueDate: [''],
    timeLimitMinutes: [null as number | null],
  });

  private unitId!: string;

  ngOnInit() {
    this.unitId = this.route.snapshot.paramMap.get('unitId')!;
    this.coursesSvc.getUnit(this.unitId).subscribe((unit) => {
      this.unit.set(unit);
      const courseId = unit.courseId;
      if (courseId) this.enrollmentsSvc.listByCourse(courseId).subscribe((e) => this.enrollments.set(e));
    });
    this.reloadSessions();
  }

  reloadSessions() {
    this.sessionsSvc.list({ unitId: this.unitId, soloDirectas: true }).subscribe((s) => this.sessions.set(s));
  }

  tipoSeleccionadoEsExamen(): boolean {
    const tipo = this.createForm.controls.tipo.value;
    return this.tiposDisponibles.find((t) => t.tipo === tipo)?.modo === 'examen';
  }

  crearTarea() {
    if (this.createForm.invalid) {
      this.createForm.markAllAsTouched();
      return;
    }
    const { tipo, title, dueDate, timeLimitMinutes } = this.createForm.getRawValue();
    this.sessionsSvc
      .create({
        tipo: tipo as AcademicSession['tipoFijo'],
        unitId: this.unitId,
        title: title!,
        dueDate: dueDate || null,
        timeLimitMinutes: this.tipoSeleccionadoEsExamen() ? timeLimitMinutes : null,
      })
      .subscribe(() => {
        this.createForm.reset({ tipo: '', title: '', dueDate: '', timeLimitMinutes: null });
        this.showCreateForm.set(false);
        this.reloadSessions();
      });
  }

  duplicarTarea(s: AcademicSession) {
    this.createForm.reset({ tipo: s.tipoFijo, title: `${s.title} (copia)`, dueDate: '', timeLimitMinutes: null });
    this.showCreateForm.set(true);
  }

  async eliminarTarea(s: AcademicSession) {
    if (!(await this.confirmSvc.confirm(`¿Eliminar "${s.title}"? Se borrarán también todas las respuestas y entregas asociadas.`)))
      return;
    this.sessionsSvc.delete(s.id).subscribe(() => {
      if (this.editingSessionId() === s.id) this.editingSessionId.set(null);
      this.reloadSessions();
    });
  }

  // --- Configuración de la tarea ---

  startEditSession(s: AcademicSession) {
    this.editingSessionId.set(s.id);
    this.sessionEditForm.reset({
      dueDate: s.dueDate ? s.dueDate.slice(0, 16) : '',
      timeLimitMinutes: s.timeLimitMinutes ?? null,
    });
    this.selectedQuestionIds.set(new Set(s.questionIds));
    this.topicFilter.set('');
    this.availableQuestions.set([]);
    this.showAbiertasPanel.set(false);
    this.assignedQuestions.set([]);
    if (!esSesionDeEvidencia(s.tipoFijo)) {
      this.questionsSvc.list({ sessionId: s.id }).subscribe((qs) => this.assignedQuestions.set(qs));
    }
  }

  tieneAbiertas(): boolean {
    return this.assignedQuestions().some((q) => q.modoRespuesta === 'abierta');
  }

  onTopicFilterChange(topicId: string) {
    this.topicFilter.set(topicId);
    if (!topicId) {
      this.availableQuestions.set([]);
      return;
    }
    this.questionsSvc.list({ topicId }).subscribe((qs) => this.availableQuestions.set(qs));
  }

  toggleQuestion(id: string) {
    const set = new Set(this.selectedQuestionIds());
    if (set.has(id)) set.delete(id);
    else set.add(id);
    this.selectedQuestionIds.set(set);
  }

  saveSessionEdit(s: AcademicSession) {
    const value = this.sessionEditForm.getRawValue();
    const esEvidencia = esSesionDeEvidencia(s.tipoFijo);
    this.sessionsSvc
      .update(s.id, {
        dueDate: value.dueDate || null,
        timeLimitMinutes: esEvidencia ? null : value.timeLimitMinutes,
        questionIds: esEvidencia ? undefined : Array.from(this.selectedQuestionIds()),
      })
      .subscribe(() => {
        this.editingSessionId.set(null);
        this.reloadSessions();
      });
  }

  toggleApertura(s: AcademicSession) {
    this.sessionsSvc.toggleApertura(s.id, !s.abiertoParaTodos).subscribe(() => this.reloadSessions());
  }

  // --- Entregas (Investigación de Unidad) ---

  verEntregas(s: AcademicSession) {
    this.entregasSessionId.set(s.id);
    this.entregasSessionVencido.set(!!s.vencido);
    this.entregasSvc.listBySession(s.id).subscribe((e) => {
      this.entregas.set(e);
      this.syncEditState();
    });
  }

  private syncEditState() {
    for (const en of this.enrollments()) {
      const entrega = this.entregaDe(en.studentId);
      this.notaEdit[en.studentId] = entrega?.nota ?? 0;
      this.feedbackEdit[en.studentId] = entrega?.feedback ?? '';
    }
  }

  entregaDe(studentId: string): Entrega | undefined {
    return this.entregas().find((e) => e.studentId === studentId);
  }

  // "vencida_sin_entrega": la tarea venció y el alumno no entregó nada — el
  // backend ya la calificó en 0 automáticamente (ver rubric.data.ts), pero
  // eso no crea una fila de Entrega, así que hay que distinguirlo aquí de
  // "sin_responder" a secas para no dar a entender que todavía está a tiempo.
  estadoEntrega(studentId: string): 'sin_responder' | 'vencida_sin_entrega' | 'pendiente' | 'calificado' {
    const e = this.entregaDe(studentId);
    if (e?.nota !== null && e?.nota !== undefined) return 'calificado';
    if (e?.entregadoAt) return 'pendiente';
    if (this.entregasSessionVencido()) return 'vencida_sin_entrega';
    return 'sin_responder';
  }

  guardarCalificacionInline(studentId: string) {
    const sessionId = this.entregasSessionId();
    if (!sessionId) return;
    const nota = this.notaEdit[studentId];
    if (nota === null || nota === undefined || nota < 0 || nota > 20) return;
    const feedback = this.feedbackEdit[studentId];
    this.entregasSvc.calificar(sessionId, studentId, nota, feedback || undefined).subscribe(() => {
      this.guardadoStudentId.set(studentId);
      setTimeout(() => this.guardadoStudentId.set(null), 2000);
      this.entregasSvc.listBySession(sessionId).subscribe((e) => {
        this.entregas.set(e);
        this.syncEditState();
      });
    });
  }

  async reabrirEntrega(studentId: string) {
    const sessionId = this.entregasSessionId();
    if (!sessionId) return;
    const nombre = this.studentName(studentId);
    if (
      !(await this.confirmSvc.confirm(
        `¿Reabrir la entrega de ${nombre}? Se borrará por completo (texto, archivo y nota) para que pueda volver a entregar desde cero.`,
        { confirmLabel: 'Reabrir' }
      ))
    )
      return;
    this.entregasSvc.reabrir(sessionId, studentId).subscribe(() => {
      this.entregasSvc.listBySession(sessionId).subscribe((e) => {
        this.entregas.set(e);
        this.syncEditState();
      });
    });
  }

  studentName(id: string): string {
    return this.enrollments().find((e) => e.studentId === id)?.student?.name ?? id;
  }
}
