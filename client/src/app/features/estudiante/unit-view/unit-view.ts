import { Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CoursesService } from '../../../core/services/courses.service';
import { SessionsService } from '../../../core/services/sessions.service';
import { RubricService } from '../../../core/services/rubric.service';
import { ExportService } from '../../../core/services/export.service';
import { RubricChart } from '../../../shared/components/rubric-chart/rubric-chart';
import { FileExplorer } from '../../../shared/components/file-explorer/file-explorer';
import { Icon } from '../../../shared/components/icon/icon';
import { EmptyState } from '../../../shared/components/empty-state/empty-state';
import { etiquetaEstadoSesion } from '../../../core/utils/labels';
import { AcademicSession, RubricaResultado, Unit } from '../../../core/models/models';

@Component({
  selector: 'app-unit-view',
  imports: [RouterLink, RubricChart, DatePipe, FileExplorer, Icon, EmptyState],
  templateUrl: './unit-view.html',
  styleUrl: './unit-view.css',
})
export class UnitView implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private coursesSvc = inject(CoursesService);
  private sessionsSvc = inject(SessionsService);
  private rubricSvc = inject(RubricService);
  private exportSvc = inject(ExportService);

  etiquetaEstadoSesion = etiquetaEstadoSesion;

  unit = signal<Unit | null>(null);
  sessions = signal<AcademicSession[]>([]);
  rubrica = signal<RubricaResultado | null>(null);
  expandedTopicId = signal<string | null>(null);

  private unitId!: string;

  ngOnInit() {
    this.unitId = this.route.snapshot.paramMap.get('unitId')!;
    this.coursesSvc.getUnit(this.unitId).subscribe((u) => this.unit.set(u));
    this.sessionsSvc.listByUnit(this.unitId).subscribe((s) => this.sessions.set(s));
    this.rubricSvc.get(this.unitId).subscribe((r) => this.rubrica.set(r));
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
