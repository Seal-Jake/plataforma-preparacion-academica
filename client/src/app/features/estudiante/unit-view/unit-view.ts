import { Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CoursesService } from '../../../core/services/courses.service';
import { SessionsService } from '../../../core/services/sessions.service';
import { ExportService } from '../../../core/services/export.service';
import { FileExplorer } from '../../../shared/components/file-explorer/file-explorer';
import { Icon } from '../../../shared/components/icon/icon';
import { EmptyState } from '../../../shared/components/empty-state/empty-state';
import { etiquetaEstadoSesion } from '../../../core/utils/labels';
import { AcademicSession, Unit } from '../../../core/models/models';

@Component({
  selector: 'app-unit-view',
  imports: [RouterLink, DatePipe, FileExplorer, Icon, EmptyState],
  templateUrl: './unit-view.html',
  styleUrl: './unit-view.css',
})
export class UnitView implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private coursesSvc = inject(CoursesService);
  private sessionsSvc = inject(SessionsService);
  private exportSvc = inject(ExportService);

  etiquetaEstadoSesion = etiquetaEstadoSesion;

  unit = signal<Unit | null>(null);
  sessions = signal<AcademicSession[]>([]); // tareas propias de la unidad (Examen/Investigación de Unidad)
  private topicSessions = signal<AcademicSession[]>([]); // tareas de los temas de la unidad
  expandedTopicId = signal<string | null>(null);

  private unitId!: string;

  ngOnInit() {
    this.unitId = this.route.snapshot.paramMap.get('unitId')!;
    this.coursesSvc.getUnit(this.unitId).subscribe((u) => this.unit.set(u));
    this.sessionsSvc.list({ unitId: this.unitId }).subscribe((all) => {
      this.sessions.set(all.filter((s) => !s.topicId));
      this.topicSessions.set(all.filter((s) => !!s.topicId));
    });
  }

  sesionesDeTema(topicId: string): AcademicSession[] {
    return this.topicSessions().filter((s) => s.topicId === topicId);
  }

  abrirSesion(s: AcademicSession) {
    if (s.estado === 'entregado') {
      this.router.navigate(['/estudiante/sessions', s.id, 'historial']);
    } else {
      this.router.navigate(['/estudiante/sessions', s.id, 'resolver']);
    }
  }

  toggleTopic(topicId: string) {
    this.expandedTopicId.set(this.expandedTopicId() === topicId ? null : topicId);
  }

  exportarTopicoPdf(topicId: string, topicName: string) {
    this.exportSvc.exportTopicPdf(topicId, topicName);
  }
}
