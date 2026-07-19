import { Component, computed, input, signal } from '@angular/core';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration, ChartData } from 'chart.js';
import { RubricaResultado } from '../../../core/models/models';

const PALETA = ['#5b8cff', '#35c48f', '#e6b23a', '#e2555a', '#a86bf0', '#3ac0d6', '#e08bd0', '#8fd14f'];

@Component({
  selector: 'app-rubric-chart',
  imports: [BaseChartDirective],
  templateUrl: './rubric-chart.html',
  styleUrl: './rubric-chart.css',
})
export class RubricChart {
  rubrica = input.required<RubricaResultado>();

  expandidas = signal<Set<string>>(new Set());

  toggleExpandida(nombre: string) {
    const actual = new Set(this.expandidas());
    if (actual.has(nombre)) actual.delete(nombre);
    else actual.add(nombre);
    this.expandidas.set(actual);
  }

  chartData = computed<ChartData<'bar'>>(() => {
    const r = this.rubrica();
    return {
      labels: r.categorias.map((c) => c.nombre),
      datasets: [
        {
          label: 'Nota (0-20)',
          data: r.categorias.map((c) => c.nota ?? 0),
          backgroundColor: r.categorias.map((_, i) => PALETA[i % PALETA.length]),
          borderRadius: 6,
        },
      ],
    };
  });

  chartOptions: ChartConfiguration<'bar'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: { min: 0, max: 20, ticks: { color: '#9aa1b2' }, grid: { color: '#2b3040' } },
      x: { ticks: { color: '#9aa1b2' }, grid: { display: false } },
    },
    plugins: {
      legend: { display: false },
    },
  };
}
