import { Component, ViewChild, signal } from '@angular/core';
import { CouponsComponent } from '../coupons/coupons.component';
import { NewCustomersTabComponent } from './new-customers-tab/new-customers-tab.component';
import { ExistingCustomersTabComponent } from './existing-customers-tab/existing-customers-tab.component';
import { MarketingLogsTabComponent } from './marketing-logs-tab/marketing-logs-tab.component';

type MarketingTab = 'new-customers' | 'existing-customers' | 'coupons' | 'logs';

@Component({
  selector: 'app-marketing',
  standalone: true,
  imports: [CouponsComponent, NewCustomersTabComponent, ExistingCustomersTabComponent, MarketingLogsTabComponent],
  templateUrl: './marketing.component.html',
  styleUrl: './marketing.component.scss',
})
export class MarketingComponent {
  // All four tabs stay mounted (visibility toggled via CSS, not @if) so switching tabs
  // doesn't lose upload progress, list state, or the current search term. The tradeoff:
  // a tab you're not looking at won't notice that something you did elsewhere (sent a
  // coupon, redeemed one, uploaded leads) changed its data — each ViewChild's own
  // fetch() only ran once, when the page first loaded. selectTab() below re-fetches
  // whichever tab you're switching INTO, so it's never showing stale data without
  // needing a full page refresh.
  @ViewChild(NewCustomersTabComponent) newCustomersTab!: NewCustomersTabComponent;
  @ViewChild(ExistingCustomersTabComponent) existingCustomersTab!: ExistingCustomersTabComponent;
  @ViewChild(CouponsComponent) couponsTab!: CouponsComponent;
  @ViewChild(MarketingLogsTabComponent) logsTab!: MarketingLogsTabComponent;

  activeTab = signal<MarketingTab>('new-customers');

  readonly tabs: { id: MarketingTab; label: string }[] = [
    { id: 'new-customers', label: 'New Customers' },
    { id: 'existing-customers', label: 'Existing Customers' },
    { id: 'coupons', label: 'Coupons' },
    { id: 'logs', label: 'Logs' },
  ];

  selectTab(tab: MarketingTab): void {
    this.activeTab.set(tab);
    switch (tab) {
      case 'new-customers':
        this.newCustomersTab.fetch();
        break;
      case 'existing-customers':
        this.existingCustomersTab.fetch();
        break;
      case 'coupons':
        this.couponsTab.fetch();
        break;
      case 'logs':
        this.logsTab.fetch();
        break;
    }
  }

  openGenerateCoupon(): void {
    this.selectTab('coupons');
    // Defer one tick so the Coupons tab is actually visible before its panel opens.
    setTimeout(() => this.couponsTab.openCreatePanel());
  }
}
