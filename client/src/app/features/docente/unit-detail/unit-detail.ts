import { Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { CoursesService } from '../../../core/services/courses.service';
import { SessionsService } from '../../../core/services/sessions.service';
import { QuestionsService } from '../../../core/services/questions.service';
import { EnrollmentsService } from '../../../core/services/enrollments.service';
import { EvaluationCategoriesService } from '../../../core/services/evaluation-categories.service';
import { EntregasService } from '../../../core/services/entregas.service';
import { RubricService } from '../../../core/services/rubric.service';
import { ExportService } from '../../../core/services/export.service';
import { RubricChart } from '../../../shared/components/rubric-chart/rubric-chart';
import { Icon } from '../../../shared/components/icon/icon';
import { EmptyState } from '../../../shared/components/empty-state/empty-state';
import { ayudaTipoEvaluacion, etiquetaNivel, etiquetaTipoEvaluacion, TIPOS_EVALUACION_OPCIONES } from '../../../core/utils/labels';
import {
  AcademicSession,
  Entrega,
  Enrollment,
  EvaluationCategory,
  Question,
  RubricaResultado,
  StudentInfo,
  TipoEvaluacion,
  Unit,
} from '../../../core/models/models';

type Tab = 'categorias' | 'sesiones' | 'estudiantes' | 'exportar';

@Component({
  selector: 'app-unit-detail',
  imports: [ReactiveFormsModule, FormsModule, RouterLink, RubricChart, DatePipe, Icon, EmptyState],
  templateUrl: './unit-detail.html',
  styleUrl: './unit-detail.css',
})
export class UnitDetail implements OnInit {
  private route = inject(ActivatedRoute);
  private coursesSvc = inject(CoursesService);
  private sessionsSvc = inject(SessionsService);
  private questionsSvc = inject(QuestionsService);
  private enrollmentsSvc = inject(EnrollmentsService);
  private categoriesSvc = inject(EvaluationCategoriesService);
  private entregasSvc = inject(EntregasService);
  private rubricSvc = inject(RubricService);
  private exportSvc = inject(ExportService);
  private fb = inject(FormBuilder);

  tiposEvaluacionOpciones = TIPOS_EVALUACION_OPCIONES;
  etiquetaTipoEvaluacion = etiquetaTipoEvaluacion;
  ayudaTipoEvaluacion = ayudaTipoEvaluacion;
  etiquetaNivel = etiquetaNivel;

  tab = signal<Tab>('categorias');
  unit = signal<Unit | null>(null);
  sessions = signal<AcademicSession[]>([]);
  enrollments = signal<Enrollment[]>([]);
  allStudents = signal<StudentInfo[]>([]);
  categorias = signal<EvaluationCategory[]>([]);
  pesoTotal = signal(0);
  pesoValido = signal(true);

  showCategoryForm = signal(false);
  editingCategory = signal<EvaluationCategory | null>(null);
  categoryForm = this.fb.group({
    nombre: ['', Validators.required],
    peso: [10, [Validators.required, Validators.min(0), Validators.max(100)]],
    tipoEvaluacion: ['generica' as TipoEvaluacion, Validators.required],
    promediarPorTema: [false],
  });

  showSessionForm = signal(false);
  sessionTopicFilter = signal<string>('');
  availableQuestions = signal<Question[]>([]);
  selectedQuestionIds = signal<Set<string>>(new Set());

  selectedStudentId = signal<string | null>(null);
  selectedStudentRubrica = signal<RubricaResultado | null>(null);

  entregasSessionId = signal<string | null>(null);
  entregas = signal<Entrega[]>([]);
  gradingStudentId = signal<string | null>(null);
  gradeForm = this.fb.group({
    nota: [0, [Validators.required, Validators.min(0), Validators.max(20)]],
    feedback: [''],
  });

  sessionForm = this.fb.group({
    categoriaId: ['', Validators.required],
    title: ['', Validators.required],
    dueDate: [''],
    timeLimitMinutes: [null as number | null],
    requiereEvidencia: [false],
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
    this.reloadCategorias();
    this.reloadSessions();
    this.enrollmentsSvc.listStudents().subscribe((s) => this.allStudents.set(s));
  }

  reloadCategorias() {
    this.categoriesSvc.listByUnit(this.unitId).subscribe((res) => {
      this.categorias.set(res.categorias);
      this.pesoTotal.set(res.pesoTotal);
      this.pesoValido.set(res.pesoValido);
    });
  }

  reloadSessions() {
    this.sessionsSvc.listByUnit(this.unitId).subscribe((s) => this.sessions.set(s));
  }

  reloadEnrollments() {
    const courseId = this.unit()?.courseId;
    if (!courseId) return;
    this.enrollmentsSvc.listByCourse(courseId).subscribe((e) => this.enrollments.set(e));
  }

  // --- Categorías de evaluación ---

  startNewCategory() {
    this.editingCategory.set(null);
    this.categoryForm.reset({ nombre: '', peso: 10, tipoEvaluacion: 'generica', promediarPorTema: false });
    this.showCategoryForm.set(true);
  }

  startEditCategory(c: EvaluationCategory) {
    this.editingCategory.set(c);
    this.categoryForm.reset(c);
    this.showCategoryForm.set(true);
  }

  saveCategory() {
    if (this.categoryForm.invalid) return;
    const value = this.categoryForm.getRawValue() as unknown as {
      nombre: string;
      peso: number;
      tipoEvaluacion: TipoEvaluacion;
      promediarPorTema: boolean;
    };
    const editing = this.editingCategory();
    const obs = editing
      ? this.categoriesSvc.update(editing.id, value)
      : this.categoriesSvc.create({ ...value, unitId: this.unitId });
    obs.subscribe(() => {
      this.showCategoryForm.set(false);
      this.reloadCategorias();
    });
  }

  deleteCategory(c: EvaluationCategory) {
    if (!confirm(`¿Eliminar la categoría "${c.nombre}"? Las sesiones asociadas también se eliminarán.`)) return;
    this.categoriesSvc.delete(c.id).subscribe(() => {
      this.reloadCategorias();
      this.reloadSessions();
    });
  }

  // --- Sesiones ---

  startNewSession() {
    this.sessionForm.reset({
      categoriaId: this.categorias()[0]?.id ?? '',
      title: '',
      dueDate: '',
      timeLimitMinutes: null,
      requiereEvidencia: false,
      pesoAciertos: 40,
      pesoEvidencia: 60,
    });
    this.selectedQuestionIds.set(new Set());
    this.sessionTopicFilter.set('');
    this.availableQuestions.set([]);
    this.showSessionForm.set(true);
  }

  categoriaSeleccionada(): EvaluationCategory | undefined {
    return this.categorias().find((c) => c.id === this.sessionForm.value.categoriaId);
  }

  onTopicFilterChange(topicId: string) {
    this.sessionTopicFilter.set(topicId);
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

  saveSession() {
    if (this.sessionForm.invalid) {
      this.sessionForm.markAllAsTouched();
      return;
    }
    const value = this.sessionForm.getRawValue();
    this.sessionsSvc
      .create({
        unitId: this.unitId,
        topicId: this.sessionTopicFilter() || null,
        categoriaId: value.categoriaId!,
        title: value.title!,
        questionIds: Array.from(this.selectedQuestionIds()),
        dueDate: value.dueDate || null,
        timeLimitMinutes: value.timeLimitMinutes,
        requiereEvidencia: value.requiereEvidencia!,
        pesoAciertos: value.pesoAciertos!,
        pesoEvidencia: value.pesoEvidencia!,
      })
      .subscribe(() => {
        this.showSessionForm.set(false);
        this.reloadSessions();
      });
  }

  deleteSession(s: AcademicSession) {
    if (!confirm(`¿Eliminar la sesión "${s.title}"?`)) return;
    this.sessionsSvc.delete(s.id).subscribe(() => this.reloadSessions());
  }

  toggleApertura(s: AcademicSession) {
    this.sessionsSvc.toggleApertura(s.id, !s.abiertoParaTodos).subscribe(() => this.reloadSessions());
  }

  esEntregable(s: AcademicSession): boolean {
    return s.requiereEvidencia || s.questionIds.length === 0;
  }

  // --- Entregas (investigación, participación activa, evidencia de examen, etc.) ---

  verEntregas(s: AcademicSession) {
    this.entregasSessionId.set(s.id);
    this.entregasSvc.listBySession(s.id).subscribe((e) => this.entregas.set(e));
  }

  entregaDe(studentId: string): Entrega | undefined {
    return this.entregas().find((e) => e.studentId === studentId);
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
    });
  }

  // --- Estudiantes y rúbrica ---

  verRubrica(studentId: string) {
    this.selectedStudentId.set(studentId);
    this.selectedStudentRubrica.set(null);
    this.rubricSvc.get(this.unitId, studentId).subscribe((r) => this.selectedStudentRubrica.set(r));
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

  categoryName(id: string): string {
    return this.categorias().find((c) => c.id === id)?.nombre ?? id;
  }
}
