import { Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { CoursesService } from '../../../core/services/courses.service';
import { SessionsService } from '../../../core/services/sessions.service';
import { QuestionsService } from '../../../core/services/questions.service';
import { EnrollmentsService } from '../../../core/services/enrollments.service';
import { EntregasService } from '../../../core/services/entregas.service';
import { RubricService } from '../../../core/services/rubric.service';
import { ExportService } from '../../../core/services/export.service';
import { RubricChart } from '../../../shared/components/rubric-chart/rubric-chart';
import { Icon } from '../../../shared/components/icon/icon';
import { EmptyState } from '../../../shared/components/empty-state/empty-state';
import { CalificarAbiertas } from '../../../shared/components/calificar-abiertas/calificar-abiertas';
import { ayudaTipoSesionFijo, esSesionDeEvidencia, etiquetaCantidadPreguntas, etiquetaNivel, etiquetaTipoSesionFijo } from '../../../core/utils/labels';
import {
  AcademicSession,
  Entrega,
  Enrollment,
  FilaPlanilla,
  PendientesCalificacion,
  Question,
  RubricaResultado,
  StudentInfo,
  Unit,
} from '../../../core/models/models';

type Tab = 'sesiones' | 'estudiantes' | 'exportar';

@Component({
  selector: 'app-unit-detail',
  imports: [ReactiveFormsModule, FormsModule, RouterLink, RubricChart, DatePipe, Icon, EmptyState, CalificarAbiertas],
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
  private rubricSvc = inject(RubricService);
  private exportSvc = inject(ExportService);
  private fb = inject(FormBuilder);

  etiquetaTipoSesionFijo = etiquetaTipoSesionFijo;
  ayudaTipoSesionFijo = ayudaTipoSesionFijo;
  esSesionDeEvidencia = esSesionDeEvidencia;
  etiquetaNivel = etiquetaNivel;
  etiquetaCantidadPreguntas = etiquetaCantidadPreguntas;

  tab = signal<Tab>('sesiones');
  unit = signal<Unit | null>(null);
  sessions = signal<AcademicSession[]>([]); // Examen de Unidad + Proyecto de Investigación de Unidad
  enrollments = signal<Enrollment[]>([]);
  allStudents = signal<StudentInfo[]>([]);

  editingSessionId = signal<string | null>(null);
  topicFilter = signal<string>('');
  availableQuestions = signal<Question[]>([]);
  selectedQuestionIds = signal<Set<string>>(new Set());
  assignedQuestions = signal<Question[]>([]);
  showAbiertasPanel = signal(false);

  selectedStudentId = signal<string | null>(null);
  selectedStudentRubrica = signal<RubricaResultado | null>(null);

  showPlanilla = signal(false);
  planilla = signal<FilaPlanilla[] | null>(null);
  pendientes = signal<PendientesCalificacion | null>(null);

  importText = '';
  importResultado = signal<{ inscritos: string[]; noEncontrados: string[] } | null>(null);

  entregasSessionId = signal<string | null>(null);
  entregas = signal<Entrega[]>([]);
  gradingStudentId = signal<string | null>(null);
  gradeForm = this.fb.group({
    nota: [0, [Validators.required, Validators.min(0), Validators.max(20)]],
    feedback: [''],
  });

  sessionEditForm = this.fb.group({
    dueDate: [''],
    timeLimitMinutes: [null as number | null],
    pesoAciertos: [40],
    pesoEvidencia: [60],
  });

  enrollForm = this.fb.group({ studentId: ['', Validators.required] });
  newStudentForm = this.fb.group({
    name: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });
  showNewStudentForm = signal(false);

  private unitId!: string;

  ngOnInit() {
    this.unitId = this.route.snapshot.paramMap.get('unitId')!;
    this.coursesSvc.getUnit(this.unitId).subscribe((unit) => {
      this.unit.set(unit);
      this.reloadEnrollments();
    });
    this.reloadSessions();
    this.enrollmentsSvc.listStudents().subscribe((s) => this.allStudents.set(s));
    this.cargarPendientes();
  }

  reloadSessions() {
    this.sessionsSvc.list({ unitId: this.unitId, soloDirectas: true }).subscribe((s) => this.sessions.set(s));
  }

  cargarPendientes() {
    this.rubricSvc.getPendientesUnidad(this.unitId).subscribe((p) => this.pendientes.set(p));
  }

  togglePlanilla() {
    this.showPlanilla.set(!this.showPlanilla());
    if (this.showPlanilla() && !this.planilla()) this.cargarPlanilla();
  }

  cargarPlanilla() {
    this.rubricSvc.getPlanillaUnidad(this.unitId).subscribe((filas) => this.planilla.set(filas));
  }

  reloadEnrollments() {
    const courseId = this.unit()?.courseId;
    if (!courseId) return;
    this.enrollmentsSvc.listByCourse(courseId).subscribe((e) => this.enrollments.set(e));
  }

  // --- Sesiones fijas de la unidad ---

  startEditSession(s: AcademicSession) {
    this.editingSessionId.set(s.id);
    this.sessionEditForm.reset({
      dueDate: s.dueDate ? s.dueDate.slice(0, 16) : '',
      timeLimitMinutes: s.timeLimitMinutes ?? null,
      pesoAciertos: s.pesoAciertos,
      pesoEvidencia: s.pesoEvidencia,
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
        pesoAciertos: value.pesoAciertos!,
        pesoEvidencia: value.pesoEvidencia!,
      })
      .subscribe(() => {
        this.editingSessionId.set(null);
        this.reloadSessions();
      });
  }

  toggleApertura(s: AcademicSession) {
    this.sessionsSvc.toggleApertura(s.id, !s.abiertoParaTodos).subscribe(() => this.reloadSessions());
  }

  // --- Entregas (proyecto de unidad) ---

  verEntregas(s: AcademicSession) {
    this.entregasSessionId.set(s.id);
    this.entregasSvc.listBySession(s.id).subscribe((e) => this.entregas.set(e));
  }

  entregaDe(studentId: string): Entrega | undefined {
    return this.entregas().find((e) => e.studentId === studentId);
  }

  estadoEntrega(studentId: string): 'sin_responder' | 'pendiente' | 'calificado' {
    const e = this.entregaDe(studentId);
    if (e?.nota !== null && e?.nota !== undefined) return 'calificado';
    if (e?.entregadoAt) return 'pendiente';
    return 'sin_responder';
  }

  startCalificar(studentId: string) {
    this.gradingStudentId.set(studentId);
    const e = this.entregaDe(studentId);
    this.gradeForm.reset({ nota: e?.nota ?? 0, feedback: e?.feedback ?? '' });
  }

  guardarCalificacion(studentId: string) {
    if (this.gradeForm.invalid) return;
    const sessionId = this.entregasSessionId();
    if (!sessionId) return;
    const { nota, feedback } = this.gradeForm.getRawValue();
    this.entregasSvc.calificar(sessionId, studentId, nota!, feedback || undefined).subscribe(() => {
      this.gradingStudentId.set(null);
      this.entregasSvc.listBySession(sessionId).subscribe((e) => this.entregas.set(e));
      this.onCalificacionCambiada();
    });
  }

  reabrirEntrega(studentId: string) {
    const sessionId = this.entregasSessionId();
    if (!sessionId) return;
    const nombre = this.studentName(studentId);
    if (!confirm(`¿Reabrir la entrega de ${nombre}? Se borrará por completo (texto, archivo y nota) para que pueda volver a entregar desde cero.`)) return;
    this.entregasSvc.reabrir(sessionId, studentId).subscribe(() => {
      this.entregasSvc.listBySession(sessionId).subscribe((e) => this.entregas.set(e));
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
    this.rubricSvc.getUnidad(this.unitId, studentId).subscribe((r) => this.selectedStudentRubrica.set(r));
  }

  exportarProgresoEstudiante(studentId: string) {
    this.exportSvc.exportUnitProgresoPdf(this.unitId, studentId);
  }

  eliminarEstudiante(studentId: string) {
    const nombre = this.studentName(studentId);
    if (!confirm(`¿Eliminar por completo la cuenta de ${nombre}? Esto borra su acceso a TODOS los cursos, no solo esta unidad, y no se puede deshacer.`)) return;
    this.enrollmentsSvc.deleteStudent(studentId).subscribe(() => {
      if (this.selectedStudentId() === studentId) this.selectedStudentId.set(null);
      this.reloadEnrollments();
      this.enrollmentsSvc.listStudents().subscribe((s) => this.allStudents.set(s));
    });
  }

  enrolarEstudiante() {
    if (this.enrollForm.invalid) return;
    const courseId = this.unit()?.courseId;
    if (!courseId) return;
    this.enrollmentsSvc.enroll(this.enrollForm.value.studentId!, courseId).subscribe(() => {
      this.enrollForm.reset();
      this.reloadEnrollments();
    });
  }

  // Inscribe en lote correos pegados (uno por línea, o "Nombre - correo").
  // Solo empareja contra cuentas de estudiante que ya existen: si un correo
  // no aparece en ninguna cuenta, se avisa para que el alumno se registre
  // primero en /registro o el docente lo cree individualmente.
  importarLista() {
    const courseId = this.unit()?.courseId;
    if (!courseId) return;
    const emailRegex = /[^\s,;<>]+@[^\s,;<>]+\.[^\s,;<>]+/;
    const lineas = this.importText
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    if (lineas.length === 0) return;

    const noEncontrados: string[] = [];
    const matches: { studentId: string; label: string }[] = [];
    for (const linea of lineas) {
      const m = linea.match(emailRegex);
      const email = (m ? m[0] : linea).toLowerCase();
      const student = this.allStudents().find((s) => s.email.toLowerCase() === email);
      if (student) matches.push({ studentId: student.id, label: `${student.name} (${student.email})` });
      else noEncontrados.push(linea);
    }

    if (matches.length === 0) {
      this.importResultado.set({ inscritos: [], noEncontrados });
      return;
    }

    forkJoin(
      matches.map((m) =>
        this.enrollmentsSvc.enroll(m.studentId, courseId).pipe(
          map(() => ({ ok: true, label: m.label })),
          catchError(() => of({ ok: false, label: `${m.label} — ya estaba inscrito` }))
        )
      )
    ).subscribe((resultados) => {
      const inscritos = resultados.filter((r) => r.ok).map((r) => r.label);
      const yaInscritos = resultados.filter((r) => !r.ok).map((r) => r.label);
      this.importResultado.set({ inscritos, noEncontrados: [...yaInscritos, ...noEncontrados] });
      this.importText = '';
      this.reloadEnrollments();
    });
  }

  crearYEnrolarEstudiante() {
    if (this.newStudentForm.invalid) return;
    const { name, email, password } = this.newStudentForm.getRawValue();
    const courseId = this.unit()?.courseId;
    if (!courseId) return;
    this.enrollmentsSvc.createStudent(name!, email!, password!).subscribe((student) => {
      this.enrollmentsSvc.enroll(student.id, courseId).subscribe(() => {
        this.newStudentForm.reset();
        this.showNewStudentForm.set(false);
        this.enrollmentsSvc.listStudents().subscribe((s) => this.allStudents.set(s));
        this.reloadEnrollments();
      });
    });
  }

  // --- Export ---

  exportarUnidadCsv() {
    this.exportSvc.exportUnitCsv(this.unitId);
  }

  exportarCursoCsv() {
    const courseId = this.unit()?.courseId;
    if (courseId) this.exportSvc.exportCourseCsv(courseId);
  }

  studentName(id: string): string {
    return this.allStudents().find((s) => s.id === id)?.name ?? id;
  }
}
