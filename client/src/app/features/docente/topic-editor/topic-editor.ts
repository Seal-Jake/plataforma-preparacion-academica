import { Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CoursesService } from '../../../core/services/courses.service';
import { QuestionsService } from '../../../core/services/questions.service';
import { SessionsService } from '../../../core/services/sessions.service';
import { EnrollmentsService } from '../../../core/services/enrollments.service';
import { EntregasService } from '../../../core/services/entregas.service';
import { FileExplorer } from '../../../shared/components/file-explorer/file-explorer';
import { Icon } from '../../../shared/components/icon/icon';
import { EmptyState } from '../../../shared/components/empty-state/empty-state';
import { ayudaTipoSesionFijo, esSesionDeEvidencia, etiquetaTipoSesionFijo } from '../../../core/utils/labels';
import { AcademicSession, Entrega, Enrollment, Question, QuestionOption, Topic } from '../../../core/models/models';

@Component({
  selector: 'app-topic-editor',
  imports: [ReactiveFormsModule, RouterLink, FileExplorer, Icon, EmptyState, DatePipe],
  templateUrl: './topic-editor.html',
  styleUrl: './topic-editor.css',
})
export class TopicEditor implements OnInit {
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

  topic = signal<Topic | null>(null);

  sesiones = signal<AcademicSession[]>([]);
  editingSessionId = signal<string | null>(null);
  sessionEditForm = this.fb.group({
    dueDate: [''],
    timeLimitMinutes: [null as number | null],
  });

  // Preguntas propias de la sesión que se está configurando (Participación
  // en Clase o Práctica): se crean directamente aquí, sin un banco aparte.
  sesionQuestions = signal<Question[]>([]);
  showQuestionForm = signal(false);
  editingQuestion = signal<Question | null>(null);
  opcionesForm = signal<QuestionOption[]>([]);
  questionForm = this.fb.group({
    enunciado: ['', Validators.required],
  });

  enrollments = signal<Enrollment[]>([]);
  entregasSessionId = signal<string | null>(null);
  entregas = signal<Entrega[]>([]);
  gradingStudentId = signal<string | null>(null);
  gradeForm = this.fb.group({
    nota: [0, [Validators.required, Validators.min(0), Validators.max(20)]],
    feedback: [''],
  });

  private topicId!: string;

  ngOnInit() {
    this.topicId = this.route.snapshot.paramMap.get('topicId')!;
    this.reloadTopic();
    this.reloadSesiones();
  }

  reloadTopic() {
    this.coursesSvc.getTopic(this.topicId).subscribe((topic) => {
      this.topic.set(topic);
      this.coursesSvc.getUnit(topic.unitId).subscribe((unit) => {
        this.enrollmentsSvc.listByCourse(unit.courseId).subscribe((e) => this.enrollments.set(e));
      });
    });
  }

  reloadSesiones() {
    this.sessionsSvc.list({ topicId: this.topicId }).subscribe((s) => this.sesiones.set(s));
  }

  // --- Sesiones fijas del tema (Participación en Clase, Práctica, Participación Activa) ---

  startEditSession(s: AcademicSession) {
    this.editingSessionId.set(s.id);
    this.sessionEditForm.reset({
      dueDate: s.dueDate ? s.dueDate.slice(0, 16) : '',
      timeLimitMinutes: s.timeLimitMinutes ?? null,
    });
    this.showQuestionForm.set(false);
    if (!esSesionDeEvidencia(s.tipoFijo)) {
      this.reloadSesionQuestions(s.id);
    }
  }

  reloadSesionQuestions(sessionId: string) {
    this.questionsSvc.list({ sessionId }).subscribe((qs) => this.sesionQuestions.set(qs));
  }

  saveSessionEdit(s: AcademicSession) {
    const value = this.sessionEditForm.getRawValue();
    const esEvidencia = esSesionDeEvidencia(s.tipoFijo);
    this.sessionsSvc
      .update(s.id, {
        dueDate: value.dueDate || null,
        timeLimitMinutes: esEvidencia ? null : value.timeLimitMinutes,
      })
      .subscribe(() => {
        this.editingSessionId.set(null);
        this.reloadSesiones();
      });
  }

  toggleApertura(s: AcademicSession) {
    this.sessionsSvc.toggleApertura(s.id, !s.abiertoParaTodos).subscribe(() => this.reloadSesiones());
  }

  // --- Preguntas de la sesión (módulo pequeño, sin banco ni filtros) ---

  startNewQuestion() {
    this.editingQuestion.set(null);
    this.questionForm.reset({ enunciado: '' });
    this.opcionesForm.set([
      { texto: '', esCorrecta: false },
      { texto: '', esCorrecta: false },
      { texto: '', esCorrecta: false },
      { texto: '', esCorrecta: false },
    ]);
    this.showQuestionForm.set(true);
  }

  startEditQuestion(q: Question) {
    this.editingQuestion.set(q);
    this.questionForm.reset({ enunciado: q.enunciado });
    this.opcionesForm.set(q.opciones.map((o) => ({ ...o })));
    this.showQuestionForm.set(true);
  }

  addOpcion() {
    if (this.opcionesForm().length >= 5) return;
    this.opcionesForm.update((ops) => [...ops, { texto: '', esCorrecta: false }]);
  }

  removeOpcion(idx: number) {
    if (this.opcionesForm().length <= 4) return;
    this.opcionesForm.update((ops) => ops.filter((_, i) => i !== idx));
  }

  updateOpcionTexto(idx: number, texto: string) {
    this.opcionesForm.update((ops) => ops.map((o, i) => (i === idx ? { ...o, texto } : o)));
  }

  toggleOpcionCorrecta(idx: number) {
    this.opcionesForm.update((ops) => ops.map((o, i) => (i === idx ? { ...o, esCorrecta: !o.esCorrecta } : o)));
  }

  saveQuestion(session: AcademicSession) {
    if (this.questionForm.invalid || this.opcionesForm().some((o) => !o.texto.trim())) {
      this.questionForm.markAllAsTouched();
      return;
    }
    if (!this.opcionesForm().some((o) => o.esCorrecta)) {
      alert('Debe haber al menos una alternativa correcta.');
      return;
    }

    const { enunciado } = this.questionForm.getRawValue();
    const editing = this.editingQuestion();
    const payload = { enunciado, topicId: this.topicId, opciones: this.opcionesForm() } as unknown as Partial<Question>;

    if (editing) {
      this.questionsSvc.update(editing.id, payload).subscribe(() => {
        this.showQuestionForm.set(false);
        this.reloadSesionQuestions(session.id);
      });
    } else {
      this.questionsSvc.create(payload).subscribe((created) => {
        this.sessionsSvc.update(session.id, { questionIds: [...session.questionIds, created.id] }).subscribe(() => {
          this.showQuestionForm.set(false);
          this.reloadSesionQuestions(session.id);
          this.reloadSesiones();
        });
      });
    }
  }

  deleteQuestion(q: Question, session: AcademicSession) {
    if (!confirm('¿Eliminar esta pregunta?')) return;
    this.questionsSvc.delete(q.id).subscribe(() => {
      this.reloadSesionQuestions(session.id);
      this.reloadSesiones();
    });
  }

  correctasTexto(q: Question): string {
    return q.opciones
      .filter((o) => o.esCorrecta)
      .map((o) => o.texto)
      .join(', ');
  }

  // --- Entregas de Participación Activa ---

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

  studentName(id: string): string {
    return this.enrollments().find((e) => e.studentId === id)?.student?.name ?? id;
  }
}
