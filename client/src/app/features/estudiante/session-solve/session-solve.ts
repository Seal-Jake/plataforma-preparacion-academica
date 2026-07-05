import { Component, OnDestroy, OnInit, inject, signal, computed } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { SessionsService } from '../../../core/services/sessions.service';
import { EntregasService } from '../../../core/services/entregas.service';
import { Icon } from '../../../shared/components/icon/icon';
import { etiquetaNivel, etiquetaSeccion, etiquetaTipoPregunta } from '../../../core/utils/labels';
import { AcademicSession, Entrega, SessionQuestion, SessionQuestionsResponse } from '../../../core/models/models';

@Component({
  selector: 'app-session-solve',
  imports: [RouterLink, FormsModule, Icon],
  templateUrl: './session-solve.html',
  styleUrl: './session-solve.css',
})
export class SessionSolve implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private sessionsSvc = inject(SessionsService);
  private entregasSvc = inject(EntregasService);

  etiquetaNivel = etiquetaNivel;
  etiquetaSeccion = etiquetaSeccion;
  etiquetaTipoPregunta = etiquetaTipoPregunta;

  session = signal<AcademicSession | null>(null);
  data = signal<SessionQuestionsResponse | null>(null);
  currentIndex = signal(0);
  remainingSeconds = signal<number | null>(null);
  finished = signal(false);
  loading = signal(true);
  errorMessage = signal<string | null>(null);
  entregaError = signal<string | null>(null);

  seleccionActual = signal<Set<string>>(new Set());

  entrega = signal<Entrega | null>(null);
  entregaTexto = '';
  entregaArchivo: File | null = null;
  entregaGuardada = signal(false);

  currentQuestion = computed<SessionQuestion | null>(() => {
    const d = this.data();
    return d ? d.preguntas[this.currentIndex()] ?? null : null;
  });

  progreso = computed(() => {
    const d = this.data();
    if (!d) return { respondidas: 0, total: 0 };
    return { respondidas: d.preguntas.filter((p) => p.respondida).length, total: d.preguntas.length };
  });

  private sessionId!: string;
  private timerHandle: ReturnType<typeof setInterval> | undefined;

  ngOnInit() {
    this.sessionId = this.route.snapshot.paramMap.get('sessionId')!;
    this.sessionsSvc.get(this.sessionId).subscribe((s) => {
      this.session.set(s);
      this.entregasSvc.mine(this.sessionId).subscribe((e) => {
        this.entrega.set(e);
        this.entregaTexto = e.contenidoTexto || '';
      });
    });

    this.sessionsSvc.start(this.sessionId).subscribe({
      next: () => this.loadQuestions(),
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        this.errorMessage.set(err.error?.error || 'No se pudo iniciar la sesión.');
      },
    });
  }

  ngOnDestroy() {
    if (this.timerHandle) clearInterval(this.timerHandle);
  }

  private loadQuestions() {
    this.sessionsSvc.questions(this.sessionId).subscribe((res) => {
      this.data.set(res);
      this.loading.set(false);
      this.resetSeleccion();
      if (res.submittedAt) {
        this.finished.set(true);
        return;
      }
      if (res.deadlineAt) {
        this.startTimer(res.deadlineAt);
      }
    });
  }

  private resetSeleccion() {
    const q = this.currentQuestion();
    this.seleccionActual.set(new Set(q?.seleccionadas ?? []));
  }

  private startTimer(deadlineAt: string) {
    const tick = () => {
      const remaining = Math.floor((new Date(deadlineAt).getTime() - Date.now()) / 1000);
      this.remainingSeconds.set(Math.max(0, remaining));
      if (remaining <= 0) {
        clearInterval(this.timerHandle);
        this.finish(true);
      }
    };
    tick();
    this.timerHandle = setInterval(tick, 1000);
  }

  formattedTime() {
    const s = this.remainingSeconds();
    if (s === null) return '';
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  }

  toggleOpcion(optionId: string) {
    const q = this.currentQuestion();
    if (!q || q.respondida || this.finished()) return;
    const set = new Set(this.seleccionActual());
    if (set.has(optionId)) set.delete(optionId);
    else set.add(optionId);
    this.seleccionActual.set(set);
  }

  responder() {
    const q = this.currentQuestion();
    if (!q || this.seleccionActual().size === 0) return;
    const seleccionadas = Array.from(this.seleccionActual());
    this.sessionsSvc.answer(this.sessionId, q.questionId, seleccionadas).subscribe((res) => {
      const d = this.data();
      if (!d) return;
      const updated = d.preguntas.map((p) =>
        p.questionId === q.questionId
          ? { ...p, respondida: true, seleccionadas, puntajeObtenido: res.puntaje, explicacion: res.explicacion }
          : p
      );
      this.data.set({ ...d, preguntas: updated });
    });
  }

  siguiente() {
    const d = this.data();
    if (!d) return;
    if (this.currentIndex() < d.preguntas.length - 1) {
      this.currentIndex.update((i) => i + 1);
      this.resetSeleccion();
    }
  }

  anterior() {
    if (this.currentIndex() > 0) {
      this.currentIndex.update((i) => i - 1);
      this.resetSeleccion();
    }
  }

  irA(i: number) {
    this.currentIndex.set(i);
    this.resetSeleccion();
  }

  finish(automatico = false) {
    if (this.finished()) return;
    this.entregaError.set(null);
    this.sessionsSvc.finish(this.sessionId).subscribe({
      next: () => {
        this.finished.set(true);
        if (this.timerHandle) clearInterval(this.timerHandle);
        if (!automatico) {
          this.router.navigate(['/estudiante/sessions', this.sessionId, 'historial']);
        }
      },
      error: (err: HttpErrorResponse) => {
        this.entregaError.set(err.error?.error || 'No se pudo entregar la sesión.');
      },
    });
  }

  onEvidenciaSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    this.entregaArchivo = input.files?.[0] ?? null;
  }

  guardarEvidencia() {
    this.entregasSvc.submitMine(this.sessionId, this.entregaTexto || null, this.entregaArchivo).subscribe((e) => {
      this.entrega.set(e);
      this.entregaArchivo = null;
      this.entregaGuardada.set(true);
      setTimeout(() => this.entregaGuardada.set(false), 2000);
    });
  }
}
