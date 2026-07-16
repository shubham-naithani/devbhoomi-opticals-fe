import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration, ChartData } from 'chart.js';
import { AuthService } from '../../core/services/auth.service';
import { DashboardService } from '../../core/services/dashboard.service';
import { DashboardStats } from '../../core/models/dashboard.model';
import { DecimalPipe } from '@angular/common';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [RouterLink, BaseChartDirective, DecimalPipe],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent {
  auth = inject(AuthService);
  private dashboardService = inject(DashboardService);

  stats = signal<DashboardStats | null>(null);
  loading = signal(true);

  // Revenue trend line chart
  revenueTrendData = signal<ChartData<'line'>>({ labels: [], datasets: [] });
  revenueTrendOptions: ChartConfiguration<'line'>['options'] = {
    responsive: true,
    plugins: { legend: { display: false } },
    scales: { y: { beginAtZero: true } },
  };

  // Order status doughnut
  statusChartData = signal<ChartData<'doughnut'>>({ labels: [], datasets: [] });
  statusChartOptions: ChartConfiguration<'doughnut'>['options'] = {
    responsive: true,
    plugins: { legend: { position: 'bottom' } },
  };

  // Top products bar chart
  topProductsData = signal<ChartData<'bar'>>({ labels: [], datasets: [] });
  topProductsOptions: ChartConfiguration<'bar'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: 'y',
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          title: (items) => items[0].label, // full name in tooltip
        },
      },
    },
    scales: {
      y: {
        ticks: {
          callback: function (value) {
            const label = this.getLabelForValue(value as number);
            return label.length > 22 ? label.slice(0, 20) + '…' : label;
          },
          font: { size: 11 },
        },
      },
      x: { beginAtZero: true, ticks: { precision: 0 } },
    },
  };

  constructor() {
    if (this.auth.isAdmin()) {
      this.dashboardService.getStats().subscribe({
        next: (data) => {
          this.stats.set(data);
          this.buildCharts(data);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
    } else {
      this.loading.set(false);
    }
  }

  private buildCharts(data: DashboardStats) {
    this.revenueTrendData.set({
      labels: data.revenueTrend.map((d) => d._id.slice(5)), // MM-DD
      datasets: [
        {
          data: data.revenueTrend.map((d) => d.revenue),
          label: 'Revenue',
          borderColor: '#c97b4a',
          backgroundColor: 'rgba(201,123,74,0.15)',
          tension: 0.3,
          fill: true,
        },
      ],
    });

    this.statusChartData.set({
      labels: data.statusBreakdown.map((s) => s._id),
      datasets: [
        {
          data: data.statusBreakdown.map((s) => s.count),
          backgroundColor: ['#c97b4a', '#4a7fc9', '#4ac97b', '#c94a4a'],
        },
      ],
    });

    this.topProductsData.set({
      labels: data.topProducts.map((p) => p._id),
      datasets: [
        {
          data: data.topProducts.map((p) => p.unitsSold),
          label: 'Units sold',
          backgroundColor: '#2e4a4f',
        },
      ],
    });
  }
}
