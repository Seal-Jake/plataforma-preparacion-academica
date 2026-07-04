import { Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { DashboardService } from '../../../core/services/dashboard.service';
import { DashboardResponse } from '../../../core/models/models';
import { Icon } from '../../../shared/components/icon/icon';
import { EmptyState } from '../../../shared/components/empty-state/empty-state';

@Component({
  selector: 'app-dashboard',
  imports: [RouterLink, DatePipe, Icon, EmptyState],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class Dashboard implements OnInit {
  private dashboardSvc = inject(DashboardService);

  data = signal<DashboardResponse | null>(null);

  ngOnInit() {
    this.dashboardSvc.get().subscribe((d) => this.data.set(d));
  }
}
