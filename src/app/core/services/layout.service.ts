import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class LayoutService {
  readonly isMobileSidebarOpen = signal(false);

  toggleSidebar(): void {
    this.isMobileSidebarOpen.update((v) => !v);
  }

  closeSidebar(): void {
    this.isMobileSidebarOpen.set(false);
  }
}
