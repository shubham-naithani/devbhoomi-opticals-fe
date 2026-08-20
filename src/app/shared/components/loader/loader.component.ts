import { Component, inject } from '@angular/core';
import { LoadingService } from '../../../core/services/loading.service';

@Component({
  selector: 'app-loader',
  standalone: true,
  template: `
    @if (loading.isLoading()) {
      <div class="loader-bar" role="status" aria-label="Loading"></div>
    }
  `,
  styleUrl: './loader.component.scss',
})
export class LoaderComponent {
  loading = inject(LoadingService);
}
