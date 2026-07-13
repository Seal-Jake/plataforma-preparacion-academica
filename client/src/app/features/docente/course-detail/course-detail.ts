import { Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { CoursesService } from '../../../core/services/courses.service';
import { QuestionsService } from '../../../core/services/questions.service';
import { SessionsService } from '../../../core/services/sessions.service';
import { EnrollmentsService } from '../../../core/services/enrollments.service';
import { EntregasService } from '../../../core/services/entregas.service';
import { Icon } from '../../../shared/components/icon/icon';
import { EmptyState } from '../../../shared/components/empty-state/empty-state';
import { CalificarAbiertas } from '../../../shared/components/calificar-abiertas/calificar-abiertas';
import { ayudaTipoSesionFijo, esSesionDeEvidencia, etiquetaCantidadPreguntas, etiquetaNivel, etiquetaTipoSesionFijo } from '../../../core/utils/labels';
import { AcademicSession, Course, Entrega, Enrollment, Question, Topic } from '../../../core/models/models';

@Component({
  selector: 'app-course-detail',
  imports: [ReactiveFormsModule, FormsModule, RouterLink, Icon, EmptyState, DatePipe, CalificarAbiertas],
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
  private fb = inject(FormBuilder);

  etiquetaTipoSesionFijo = etiquetaTipoSesionFijo;
  ayudaTipoSesionFijo = ayudaTipoSesionFijo;
  esSesionDeEvidencia = esSesionDeEvidencia;
  etiquetaNivel = etiquetaNivel;
  etiquetaCantidadPreguntas = etiquetaCantidadPreguntas;

  course = signal<Course | null>(null);
  allTopics = signal<Topic[]>([]);
  sessions = signal<AcademicSession[]>([]);
  enrollments = signal<Enrollment[]>([]);

  editingSessionId = signal<string | null>(null);
  topicFilter = signal<string>('');
  availableQuestions = signal<Question[]>([]);
  selectedQuestionIds = signal<Set<string>>(new Set());
  assignedQuestions = signal<Question[]>([]);
  showAbiertasPanel = signal(false);
  sessionEditForm = this.fb.group({
    dueDate: [''],
    timeLimitMinutes: [null as number | null],
  });

  entregasSessionId = signal<string | null>(null);
  entregas = signal<Entrega[]>([]);
  gradingStudentId = signal<string | null>(null);
  gradeForm = this.fb.group({
    nota: [0, [Validators.required, Validators.min(0), Validators.max(20)]],
    feedback: [''],
  });

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
    this.enrollmentsSvc.listByCourse(this.courseId).subscribe((e) => this.enrollments.set(e));
  }

  reloadSessions() {
    this.sessionsSvc.list({ courseId: this.courseId }).subscribe((s) => this.sessions.set(s));
  }

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
    });
  }

  reabrirEntrega(studentId: string) {
    const sessionId = this.entregasSessionId();
    if (!sessionId) return;
    const nombre = this.studentName(studentId);
    if (!confirm(`¿Reabrir la entrega de ${nombre}? Se borrará por completo (texto, archivo y nota) para que pueda volver a entregar desde cero.`)) return;
    this.entregasSvc.reabrir(sessionId, studentId).subscribe(() => {
      this.entregasSvc.listBySession(sessionId).subscribe((e) => this.entregas.set(e));
    });
  }

  studentName(id: string): string {
    return this.enrollments().find((e) => e.studentId === id)?.student?.name ?? id;
  }
}
