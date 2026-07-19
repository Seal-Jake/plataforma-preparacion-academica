import { Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { CoursesService } from '../../../core/services/courses.service';
import { QuestionsService } from '../../../core/services/questions.service';
import { SessionsService } from '../../../core/services/sessions.service';
import { EnrollmentsService } from '../../../core/services/enrollments.service';
import { EntregasService } from '../../../core/services/entregas.service';
import { RubricService } from '../../../core/services/rubric.service';
import { ExportService } from '../../../core/services/export.service';
import { PreferencesService } from '../../../core/services/preferences.service';
import { ConfirmDialogService } from '../../../core/services/confirm-dialog.service';
import { RubricChart } from '../../../shared/components/rubric-chart/rubric-chart';
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
import {
  AcademicSession,
  Course,
  Entrega,
  Enrollment,
  FilaPlanilla,
  PendientesCalificacion,
  Question,
  RubricaResultado,
  StudentInfo,
  Topic,
} from '../../../core/models/models';

type Tab = 'sesiones' | 'estudiantes' | 'exportar';

@Component({
  selector: 'app-course-detail',
  imports: [ReactiveFormsModule, FormsModule, RouterLink, RubricChart, Icon, EmptyState, DatePipe, CalificarAbiertas],
  templateUrl: './course-detail.html',
  styleUrl: './course-detail.css',
})
export class CourseDetail implements OnInit {
  private route = inject(ActivatedRoute);
  private coursesSvc = inject(CoursesService);
  private questionsSvc = inject(QuestionsService);
  private sessionsSvc = inject(SessionsService);
  private enrollmentsSvc = inject(EnrollmentsService);
  private entregasSvc = inject(EntregasService);
  private rubricSvc = inject(RubricService);
  private exportSvc = inject(ExportService);
  private prefs = inject(PreferencesService);
  private confirmSvc = inject(ConfirmDialogService);
  private fb = inject(FormBuilder);

  etiquetaTipoSesionFijo = etiquetaTipoSesionFijo;
  ayudaTipoSesionFijo = ayudaTipoSesionFijo;
  esSesionDeEvidencia = esSesionDeEvidencia;
  etiquetaNivel = etiquetaNivel;
  etiquetaCantidadPreguntas = etiquetaCantidadPreguntas;

  tiposDisponibles = tiposTareaDeAmbito('curso');

  tab = signal<Tab>('sesiones');

  selectTab(t: Tab) {
    this.tab.set(t);
    if (t === 'estudiantes' && this.prefs.prefs().docenteAutoAbrirPlanilla && !this.showPlanilla()) {
      this.togglePlanilla();
    }
  }

  course = signal<Course | null>(null);
  allTopics = signal<Topic[]>([]);
  sessions = signal<AcademicSession[]>([]); // tareas de ámbito curso (Examen Final, Investigación Final)
  enrollments = signal<Enrollment[]>([]);
  allStudents = signal<StudentInfo[]>([]);

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

  sessionEditForm = this.fb.group({
    dueDate: [''],
    timeLimitMinutes: [null as number | null],
  });

  selectedStudentId = signal<string | null>(null);
  selectedStudentRubrica = signal<RubricaResultado | null>(null);

  showPlanilla = signal(false);
  planilla = signal<FilaPlanilla[] | null>(null);
  pendientes = signal<PendientesCalificacion | null>(null);

  importText = '';
  importResultado = signal<{ inscritos: string[]; noEncontrados: string[] } | null>(null);

  entregasSessionId = signal<string | null>(null);
  entregasSessionVencido = signal(false);
  entregas = signal<Entrega[]>([]);
  notaEdit: Record<string, number> = {};
  feedbackEdit: Record<string, string> = {};
  guardadoStudentId = signal<string | null>(null);

  enrollForm = this.fb.group({ studentId: ['', Validators.required] });
  newStudentForm = this.fb.group({
    name: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });
  showNewStudentForm = signal(false);

  private courseId!: string;

  ngOnInit() {
    this.courseId = this.route.snapshot.paramMap.get('courseId')!;
    this.coursesSvc.list().subscribe((courses) => {
      const course = courses.find((c) => c.id === this.courseId) ?? null;
      this.course.set(course);
      const topics = (course?.units ?? []).flatMap((u) => u.topics ?? []);
      this.allTopics.set(topics);
    });
    this.reloadSessions();
    this.reloadEnrollments();
    this.enrollmentsSvc.listStudents().subscribe((s) => this.allStudents.set(s));
    this.cargarPendientes();
  }

  reloadSessions() {
    this.sessionsSvc.list({ courseId: this.courseId }).subscribe((s) => this.sessions.set(s));
  }

  reloadEnrollments() {
    this.enrollmentsSvc.listByCourse(this.courseId).subscribe((e) => this.enrollments.set(e));
  }

  cargarPendientes() {
    this.rubricSvc.getPendientesCurso(this.courseId).subscribe((p) => this.pendientes.set(p));
  }

  togglePlanilla() {
    const abierta = !this.showPlanilla();
    this.showPlanilla.set(abierta);
    // Siempre se recarga al abrir (no solo la primera vez): pudo haber
    // cambios mientras el panel estaba cerrado que onCalificacionCambiada()
    // no alcanzó a reflejar aquí.
    if (abierta) this.cargarPlanilla();
  }

  cargarPlanilla() {
    this.rubricSvc.getPlanillaCurso(this.courseId).subscribe((filas) => this.planilla.set(filas));
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
        courseId: this.courseId,
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

  // --- Entregas (Investigación Final) ---

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
      this.onCalificacionCambiada();
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
      this.onCalificacionCambiada();
    });
  }

  // Mantiene el banner de pendientes y la planilla al día tras cualquier
  // calificación o reapertura, sin obligar al docente a recargar la página.
  onCalificacionCambiada() {
    this.cargarPendientes();
    if (this.showPlanilla()) this.cargarPlanilla();
  }

  // --- Estudiantes y rúbrica ---

  verRubrica(studentId: string) {
    this.selectedStudentId.set(studentId);
    this.selectedStudentRubrica.set(null);
    this.rubricSvc.getCurso(this.courseId, studentId).subscribe((r) => this.selectedStudentRubrica.set(r));
  }

  exportarProgresoEstudiante(studentId: string) {
    this.exportSvc.exportCourseProgresoPdf(this.courseId, studentId);
  }

  async eliminarEstudiante(studentId: string) {
    const nombre = this.studentName(studentId);
    if (
      !(await this.confirmSvc.confirm(
        `¿Eliminar por completo la cuenta de ${nombre}? Esto borra su acceso a TODOS los cursos, no solo este, y no se puede deshacer.`,
        { confirmLabel: 'Eliminar cuenta' }
      ))
    )
      return;
    this.enrollmentsSvc.deleteStudent(studentId).subscribe(() => {
      if (this.selectedStudentId() === studentId) this.selectedStudentId.set(null);
      this.reloadEnrollments();
      this.enrollmentsSvc.listStudents().subscribe((s) => this.allStudents.set(s));
    });
  }

  enrolarEstudiante() {
    if (this.enrollForm.invalid) return;
    this.enrollmentsSvc.enroll(this.enrollForm.value.studentId!, this.courseId).subscribe(() => {
      this.enrollForm.reset();
      this.reloadEnrollments();
    });
  }

  // Inscribe en lote correos pegados (uno por línea, o "Nombre - correo").
  // Solo empareja contra cuentas de estudiante que ya existen: si un correo
  // no aparece en ninguna cuenta, se avisa para que el alumno se registre
  // primero en /registro o el docente lo cree individualmente.
  importarLista() {
    const emailRegex = /[^\s,;<>]+@[^\s,;<>]+\.[^\s,;<>]+/;
    const lineas = this.importText
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    if (lineas.length === 0) return;

    const noEncontrados: string[] = [];
    const matchesPorStudentId = new Map<string, string>(); // dedupe si el correo aparece repetido en la lista
    for (const linea of lineas) {
      const m = linea.match(emailRegex);
      const email = (m ? m[0] : linea).toLowerCase();
      const student = this.allStudents().find((s) => s.email.toLowerCase() === email);
      if (student) matchesPorStudentId.set(student.id, `${student.name} (${student.email})`);
      else noEncontrados.push(linea);
    }
    const matches = [...matchesPorStudentId.entries()].map(([studentId, label]) => ({ studentId, label }));

    if (matches.length === 0) {
      this.importResultado.set({ inscritos: [], noEncontrados });
      return;
    }

    forkJoin(
      matches.map((m) =>
        this.enrollmentsSvc.enroll(m.studentId, this.courseId).pipe(
          map(() => ({ ok: true, label: m.label })),
          catchError(() => of({ ok: false, label: `${m.label} — ya estaba inscrito` }))
        )
      )
    ).subscribe((resultados) => {
      const inscritos = resultados.filter((r) => r.ok).map((r) => r.label);
      const yaInscritos = resultados.filter((r) => !r.ok).map((r) => r.label);
      const noResueltos = [...yaInscritos, ...noEncontrados];
      this.importResultado.set({ inscritos, noEncontrados: noResueltos });
      // Solo se limpia el texto si no quedó nada por resolver: así el
      // docente puede corregir y reintentar los correos que fallaron sin
      // tener que volver a escribir toda la lista.
      if (noResueltos.length === 0) this.importText = '';
      this.reloadEnrollments();
    });
  }

  crearYEnrolarEstudiante() {
    if (this.newStudentForm.invalid) return;
    const { name, email, password } = this.newStudentForm.getRawValue();
    this.enrollmentsSvc.createStudent(name!, email!, password!).subscribe((student) => {
      this.enrollmentsSvc.enroll(student.id, this.courseId).subscribe(() => {
        this.newStudentForm.reset();
        this.showNewStudentForm.set(false);
        this.enrollmentsSvc.listStudents().subscribe((s) => this.allStudents.set(s));
        this.reloadEnrollments();
      });
    });
  }

  // --- Export ---

  exportarCursoCsv() {
    this.exportSvc.exportCourseCsv(this.courseId);
  }

  studentName(id: string): string {
    return this.allStudents().find((s) => s.id === id)?.name ?? id;
  }
}
