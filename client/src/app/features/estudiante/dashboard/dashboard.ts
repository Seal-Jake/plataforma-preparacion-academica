import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { DashboardService } from '../../../core/services/dashboard.service';
import { PreferencesService } from '../../../core/services/preferences.service';
import { DashboardResponse } from '../../../core/models/models';
import { Icon } from '../../../shared/components/icon/icon';
import { EmptyState } from '../../../shared/components/empty-state/empty-state';
import { RubricChart } from '../../../shared/components/rubric-chart/rubric-chart';

@Component({
  selector: 'app-dashboard',
  imports: [RouterLink, DatePipe, Icon, EmptyState, RubricChart],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class Dashboard implements OnInit {
  private dashboardSvc = inject(DashboardService);
  protected prefs = inject(PreferencesService);

  data = signal<DashboardResponse | null>(null);

  pendientesVisibles = computed(() => {
    const d = this.data();
    if (!d) return [];
    return this.prefs.prefs().alumnoSoloVencidas ? d.pendientes.filter((p) => p.vencido) : d.pendientes;
  });

  ngOnInit() {
    this.dashboardSvc.get().subscribe((d) => this.data.set(d));
  }
}
