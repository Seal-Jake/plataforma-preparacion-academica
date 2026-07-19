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
    this.textoEditado = this.info()?.infoEvaluacion || this.plantillaPorDefecto();
    this.editando.set(true);
  }

  // Precarga una plantilla con los tipos de tarea y sus pesos para que el
  // docente solo la edite/complete en vez de escribir todo desde cero.
  private plantillaPorDefecto(): string {
    const categorias = this.info()?.categoriasCurso ?? [];
    if (categorias.length === 0) return '';
    const lineas = categorias.map((c) => `- ${c.nombre}: ${c.peso}% de la nota final.`).join('\n');
    return (
      `La nota final del curso se calcula combinando estos tipos de tarea:\n${lineas}\n\n` +
      `Cada tipo se promedia entre todas las tareas de ese tipo creadas en el curso. ` +
      `Completa aquí cualquier detalle adicional sobre la metodología de evaluación (criterios, fechas importantes, etc.).`
    );
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
