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
