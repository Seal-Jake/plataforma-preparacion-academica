import { Component, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { SessionsService } from '../../../core/services/sessions.service';
import { SessionResult } from '../../../core/models/models';
import { Icon } from '../../../shared/components/icon/icon';
import { etiquetaEstadoSesion } from '../../../core/utils/labels';

@Component({
  selector: 'app-session-history',
  imports: [RouterLink, DatePipe, Icon],
  templateUrl: './history.html',
  styleUrl: './history.css',
})
export class SessionHistory implements OnInit {
  result = signal<SessionResult | null>(null);
  etiquetaEstadoSesion = etiquetaEstadoSesion;

  constructor(
    private route: ActivatedRoute,
    private sessionsSvc: SessionsService
  ) {}

  private sessionId!: string;

  ngOnInit() {
    this.sessionId = this.route.snapshot.paramMap.get('sessionId')!;
    this.sessionsSvc.result(this.sessionId).subscribe((r) => this.result.set(r));
  }

  archivoRespuestaUrl(questionId: string): string {
    return this.sessionsSvc.archivoRespuestaUrl(this.sessionId, questionId);
  }
}
