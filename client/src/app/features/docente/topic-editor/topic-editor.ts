import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { CoursesService } from '../../../core/services/courses.service';
import { QuestionsService } from '../../../core/services/questions.service';
import { FileExplorer } from '../../../shared/components/file-explorer/file-explorer';
import { Icon } from '../../../shared/components/icon/icon';
import { EmptyState } from '../../../shared/components/empty-state/empty-state';
import { NIVELES_OPCIONES, SECCIONES_OPCIONES, TIPOS_PREGUNTA_OPCIONES, etiquetaNivel, etiquetaSeccion, etiquetaTipoPregunta } from '../../../core/utils/labels';
import { Nivel, Question, QuestionOption, Seccion, TipoPregunta, Topic } from '../../../core/models/models';

@Component({
  selector: 'app-topic-editor',
  imports: [ReactiveFormsModule, FormsModule, RouterLink, FileExplorer, Icon, EmptyState],
  templateUrl: './topic-editor.html',
  styleUrl: './topic-editor.css',
})
export class TopicEditor implements OnInit {
  private route = inject(ActivatedRoute);
  private coursesSvc = inject(CoursesService);
  private questionsSvc = inject(QuestionsService);
  private fb = inject(FormBuilder);

  nivelesOpciones = NIVELES_OPCIONES;
  seccionesOpciones = SECCIONES_OPCIONES;
  tiposOpciones = TIPOS_PREGUNTA_OPCIONES;
  etiquetaNivel = etiquetaNivel;
  etiquetaSeccion = etiquetaSeccion;
  etiquetaTipoPregunta = etiquetaTipoPregunta;

  topic = signal<Topic | null>(null);
  questions = signal<Question[]>([]);

  filterNivel = signal<Nivel | ''>('');
  filterTipo = signal<TipoPregunta | ''>('');
  filterSection = signal<Seccion | ''>('');
  filterText = signal('');

  showQuestionForm = signal(false);
  editingQuestion = signal<Question | null>(null);
  opcionesForm = signal<QuestionOption[]>([]);
  csvText = signal('');
  importResult = signal<{ importadas: number; errores: { fila: number; error: string }[] } | null>(null);

  questionForm = this.fb.group({
    section: ['matematica' as Seccion, Validators.required],
    nivel: ['basico' as Nivel, Validators.required],
    tipo: ['operaciones' as TipoPregunta, Validators.required],
    enunciado: ['', Validators.required],
    explicacion: [''],
    esModelo: [false],
  });

  private topicId!: string;

  ngOnInit() {
    this.topicId = this.route.snapshot.paramMap.get('topicId')!;
    this.reloadTopic();
    this.reloadQuestions();
  }

  reloadTopic() {
    this.coursesSvc.getTopic(this.topicId).subscribe((topic) => this.topic.set(topic));
  }

  reloadQuestions() {
    this.questionsSvc
      .list({
        topicId: this.topicId,
        nivel: this.filterNivel() || undefined,
        tipo: this.filterTipo() || undefined,
        section: this.filterSection() || undefined,
        q: this.filterText() || undefined,
      })
      .subscribe((qs) => this.questions.set(qs));
  }

  startNewQuestion() {
    this.editingQuestion.set(null);
    this.questionForm.reset({
      section: 'matematica',
      nivel: 'basico',
      tipo: 'operaciones',
      enunciado: '',
      explicacion: '',
      esModelo: false,
    });
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
    this.questionForm.reset({ ...q, explicacion: q.explicacion || '' });
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

  saveQuestion() {
    if (this.questionForm.invalid || this.opcionesForm().some((o) => !o.texto.trim())) {
      this.questionForm.markAllAsTouched();
      return;
    }
    if (!this.opcionesForm().some((o) => o.esCorrecta)) {
      alert('Debe haber al menos una alternativa correcta.');
      return;
    }

    const value = this.questionForm.getRawValue();
    const editing = this.editingQuestion();
    const payload = { ...value, topicId: this.topicId, opciones: this.opcionesForm() } as unknown as Partial<Question>;
    const obs = editing ? this.questionsSvc.update(editing.id, payload) : this.questionsSvc.create(payload);
    obs.subscribe(() => {
      this.showQuestionForm.set(false);
      this.reloadQuestions();
      this.reloadTopic();
    });
  }

  deleteQuestion(q: Question) {
    if (!confirm('¿Eliminar esta pregunta del banco?')) return;
    this.questionsSvc.delete(q.id).subscribe(() => {
      this.reloadQuestions();
      this.reloadTopic();
    });
  }

  onCsvFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => this.csvText.set(reader.result as string);
    reader.readAsText(file);
  }

  importCsv() {
    if (!this.csvText().trim()) return;
    this.questionsSvc.importCsv(this.topicId, this.csvText()).subscribe((result) => {
      this.importResult.set(result);
      this.csvText.set('');
      this.reloadQuestions();
      this.reloadTopic();
    });
  }

  correctasTexto(q: Question): string {
    return q.opciones
      .filter((o) => o.esCorrecta)
      .map((o) => o.texto)
      .join(', ');
  }
}
