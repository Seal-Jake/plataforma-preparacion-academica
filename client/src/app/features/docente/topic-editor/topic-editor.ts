import { Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { CoursesService } from '../../../core/services/courses.service';
import { QuestionsService } from '../../../core/services/questions.service';
import { SessionsService } from '../../../core/services/sessions.service';
import { EnrollmentsService } from '../../../core/services/enrollments.service';
import { EntregasService } from '../../../core/services/entregas.service';
import { ConfirmDialogService } from '../../../core/services/confirm-dialog.service';
import { FileExplorer } from '../../../shared/components/file-explorer/file-explorer';
import { Icon } from '../../../shared/components/icon/icon';
import { EmptyState } from '../../../shared/components/empty-state/empty-state';
import { CalificarAbiertas } from '../../../shared/components/calificar-abiertas/calificar-abiertas';
import {
  ayudaTipoSesionFijo,
  esSesionDeEvidencia,
  etiquetaCantidadPreguntas,
  etiquetaTipoSesionFijo,
  tiposTareaDeAmbito,
} from '../../../core/utils/labels';
import { AcademicSession, Entrega, Enrollment, ModoRespuesta, Question, QuestionOption, Topic } from '../../../core/models/models';

@Component({
  selector: 'app-topic-editor',
  imports: [ReactiveFormsModule, FormsModule, RouterLink, FileExplorer, Icon, EmptyState, DatePipe, CalificarAbiertas],
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
  private confirmSvc = inject(ConfirmDialogService);
  private fb = inject(FormBuilder);

  etiquetaTipoSesionFijo = etiquetaTipoSesionFijo;
  ayudaTipoSesionFijo = ayudaTipoSesionFijo;
  esSesionDeEvidencia = esSesionDeEvidencia;
  etiquetaCantidadPreguntas = etiquetaCantidadPreguntas;

  tiposDisponibles = tiposTareaDeAmbito('tema');

  topic = signal<Topic | null>(null);

  sesiones = signal<AcademicSession[]>([]);
  editingSessionId = signal<string | null>(null);
  sessionEditForm = this.fb.group({
    dueDate: [''],
    timeLimitMinutes: [null as number | null],
  });

  showCreateForm = signal(false);
  createForm = this.fb.group({
    tipo: ['', Validators.required],
    title: ['', Validators.required],
    dueDate: [''],
    timeLimitMinutes: [null as number | null],
  });

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
        topicId: this.topicId,
        title: title!,
        dueDate: dueDate || null,
        timeLimitMinutes: this.tipoSeleccionadoEsExamen() ? timeLimitMinutes : null,
      })
      .subscribe(() => {
        this.createForm.reset({ tipo: '', title: '', dueDate: '', timeLimitMinutes: null });
        this.showCreateForm.set(false);
        this.reloadSesiones();
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
      this.reloadSesiones();
    });
  }

  // Preguntas propias de la sesión que se está configurando (Participación
  // en Clase o Práctica): se crean directamente aquí, sin un banco aparte.
  sesionQuestions = signal<Question[]>([]);
  showAbiertasPanel = signal(false);
  showQuestionForm = signal(false);
  editingQuestion = signal<Question | null>(null);
  opcionesForm = signal<QuestionOption[]>([]);
  modoRespuestaForm = signal<ModoRespuesta>('opciones');
  questionArchivo: File | null = null;
  questionForm = this.fb.group({
    enunciado: ['', Validators.required],
  });

  enrollments = signal<Enrollment[]>([]);
  entregasSessionId = signal<string | null>(null);
  entregasSessionVencido = signal(false);
  entregas = signal<Entrega[]>([]);
  // Nota/feedback editables directamente en cada fila de la tabla de
  // entregas (sin un formulario aparte que obligue a hacer scroll y solo
  // deje editar un alumno a la vez).
  notaEdit: Record<string, number> = {};
  feedbackEdit: Record<string, string> = {};
  guardadoStudentId = signal<string | null>(null);

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

  // --- Tareas del tema (TPA, Práctica Calificada) ---

  startEditSession(s: AcademicSession) {
    this.editingSessionId.set(s.id);
    this.sessionEditForm.reset({
      dueDate: s.dueDate ? s.dueDate.slice(0, 16) : '',
      timeLimitMinutes: s.timeLimitMinutes ?? null,
    });
    this.showQuestionForm.set(false);
    this.showAbiertasPanel.set(false);
    if (!esSesionDeEvidencia(s.tipoFijo)) {
      this.reloadSesionQuestions(s.id);
    }
  }

  reloadSesionQuestions(sessionId: string) {
    this.questionsSvc.list({ sessionId }).subscribe((qs) => this.sesionQuestions.set(qs));
  }

  tieneAbiertas(): boolean {
    return this.sesionQuestions().some((q) => q.modoRespuesta === 'abierta');
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
    this.modoRespuestaForm.set('opciones');
    this.questionArchivo = null;
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
    this.modoRespuestaForm.set(q.modoRespuesta);
    this.questionArchivo = null;
    this.opcionesForm.set(
      q.opciones.length
        ? q.opciones.map((o) => ({ ...o }))
        : [
            { texto: '', esCorrecta: false },
            { texto: '', esCorrecta: false },
            { texto: '', esCorrecta: false },
            { texto: '', esCorrecta: false },
          ]
    );
    this.showQuestionForm.set(true);
  }

  setModoRespuesta(modo: ModoRespuesta) {
    this.modoRespuestaForm.set(modo);
  }

  onQuestionArchivoSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    this.questionArchivo = input.files?.[0] ?? null;
  }

  archivoPreguntaUrl(q: Question): string {
    return this.questionsSvc.archivoUrl(q.id);
  }

  eliminarArchivoPregunta(q: Question, session: AcademicSession) {
    this.questionsSvc.eliminarArchivo(q.id).subscribe(() => this.reloadSesionQuestions(session.id));
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
    if (this.questionForm.invalid) {
      this.questionForm.markAllAsTouched();
      return;
    }
    const modoRespuesta = this.modoRespuestaForm();
    if (modoRespuesta === 'opciones') {
      if (this.opcionesForm().some((o) => !o.texto.trim())) {
        this.questionForm.markAllAsTouched();
        return;
      }
      if (!this.opcionesForm().some((o) => o.esCorrecta)) {
        alert('Debe haber al menos una alternativa correcta.');
        return;
      }
    }

    const { enunciado } = this.questionForm.getRawValue();
    const editing = this.editingQuestion();
    const payload = {
      enunciado,
      topicId: this.topicId,
      modoRespuesta,
      opciones: modoRespuesta === 'opciones' ? this.opcionesForm() : [],
    } as unknown as Partial<Question>;

    const archivo = this.questionArchivo;
    const subirArchivoSiCorresponde = (questionId: string) =>
      archivo ? this.questionsSvc.uploadArchivo(questionId, archivo) : null;

    if (editing) {
      this.questionsSvc.update(editing.id, payload).subscribe(() => {
        const subida = subirArchivoSiCorresponde(editing.id);
        const listo = () => {
          this.showQuestionForm.set(false);
          this.reloadSesionQuestions(session.id);
        };
        if (subida) subida.subscribe(listo);
        else listo();
      });
    } else {
      this.questionsSvc.create(payload).subscribe((created) => {
        this.sessionsSvc.update(session.id, { questionIds: [...session.questionIds, created.id] }).subscribe(() => {
          const subida = subirArchivoSiCorresponde(created.id);
          const listo = () => {
            this.showQuestionForm.set(false);
            this.reloadSesionQuestions(session.id);
            this.reloadSesiones();
          };
          if (subida) subida.subscribe(listo);
          else listo();
        });
      });
    }
  }

  async deleteQuestion(q: Question, session: AcademicSession) {
    if (!(await this.confirmSvc.confirm('¿Eliminar esta pregunta?'))) return;
    this.questionsSvc.delete(q.id).subscribe(() => {
      this.reloadSesionQuestions(session.id);
      this.reloadSesiones();
    });
  }

  correctasTexto(q: Question): string {
    if (q.modoRespuesta === 'abierta') return 'Respuesta abierta (calificación manual)';
    return q.opciones
      .filter((o) => o.esCorrecta)
      .map((o) => o.texto)
      .join(', ');
  }

  // --- Entregas de Participación Activa ---

  verEntregas(s: AcademicSession) {
    this.entregasSessionId.set(s.id);
    this.entregasSessionVencido.set(!!s.vencido);
    this.entregasSvc.listBySession(s.id).subscribe((e) => {
      this.entregas.set(e);
      this.syncEditState();
    });
  }

  // Precarga los inputs editables de cada fila con la nota/feedback actual
  // (o 0/vacío si el alumno todavía no tiene entrega), para que el docente
  // pueda calificar directamente sin un paso previo de "abrir formulario".
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
