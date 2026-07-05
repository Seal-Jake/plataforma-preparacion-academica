import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CoursesService } from '../../core/services/courses.service';
import { AuthService } from '../../core/services/auth.service';
import { ExportService } from '../../core/services/export.service';
import { CourseInfoResponse } from '../../core/models/models';
import { Icon } from '../../shared/components/icon/icon';
import { EmptyState } from '../../shared/components/empty-state/empty-state';

@Component({
  selector: 'app-curso-info',
  imports: [RouterLink, FormsModule, Icon, EmptyState],
  templateUrl: './curso-info.html',
  styleUrl: './curso-info.css',
})
export class CursoInfo implements OnInit {
  private route = inject(ActivatedRoute);
  private coursesSvc = inject(CoursesService);
  private exportSvc = inject(ExportService);
  protected auth = inject(AuthService);

  info = signal<CourseInfoResponse | null>(null);
  editando = signal(false);
  textoEditado = '';
  guardado = signal(false);

  private courseId!: string;

  ngOnInit() {
    this.courseId = this.route.snapshot.paramMap.get('id')!;
    this.reload();
  }

  reload() {
    this.coursesSvc.info(this.courseId).subscribe((info) => this.info.set(info));
  }

  startEdit() {
    this.textoEditado = this.info()?.infoEvaluacion || '';
    this.editando.set(true);
  }

  guardar() {
    this.coursesSvc.updateInfo(this.courseId, this.textoEditado).subscribe(() => {
      this.editando.set(false);
      this.guardado.set(true);
      setTimeout(() => this.guardado.set(false), 2000);
      this.reload();
    });
  }

  volver(): string {
    return this.auth.isDocente() ? '/docente' : '/estudiante/cursos';
  }

  exportarMiProgreso() {
    this.exportSvc.exportCourseProgresoPdf(this.courseId);
  }
}
