import { Component, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PurchaseService } from '../../core/services/purchase.service';
import { InventoryService } from '../../core/services/inventory.service';
import { ToastService } from '../../core/services/toast.service';
import { PurchaseRecord } from '../../core/models/purchase.model';
import {
  Article,
  InventoryItem,
  activeArticles,
  describeArticle,
} from '../../core/models/inventory.model';
import { PaginationComponent } from '../../shared/components/pagination/pagination.component';

const PAGE_SIZE = 20;

interface DraftLine {
  inventoryItem: string;
  articleId: string;
  name: string;
  quantity: number;
  unitCost: number;
}

@Component({
  selector: 'app-purchases',
  standalone: true,
  imports: [FormsModule, DatePipe, DecimalPipe, PaginationComponent],
  templateUrl: './purchases.component.html',
  styleUrl: './purchases.component.scss',
})
export class PurchasesComponent {
  private purchaseService = inject(PurchaseService);
  private inventoryService = inject(InventoryService);
  private toast = inject(ToastService);

  describeArticle = describeArticle;
  activeArticles = activeArticles;

  // ---- List ----------------------------------------------------------
  records = signal<PurchaseRecord[]>([]);
  totalRecords = signal(0);
  page = signal(1);
  totalPages = signal(1);
  isLoading = signal(true);
  searchTerm = signal('');
  fromDate = signal('');
  toDate = signal('');

  // ---- Create panel ----------------------------------------------------
  isCreatePanelOpen = signal(false);
  isSaving = signal(false);

  supplierName = signal('');
  invoiceNumber = signal('');
  invoiceDate = signal('');
  notes = signal('');

  itemQuery = signal('');
  itemResults = signal<InventoryItem[]>([]);
  isSearchingItems = signal(false);
  private selectedArticleIds = signal<Record<string, string>>({});
  draftLines = signal<DraftLine[]>([]);

  // ---- Detail panel ------------------------------------------------------
  viewingRecord = signal<PurchaseRecord | null>(null);
  isPanelLoading = signal(false);

  constructor() {
    this.fetchRecords();
  }

  get draftTotal(): number {
    return this.draftLines().reduce((sum, l) => sum + l.quantity * l.unitCost, 0);
  }

  // ---- List fetch / filters -----------------------------------------

  fetchRecords(): void {
    this.isLoading.set(true);
    this.purchaseService
      .list({
        search: this.searchTerm() || undefined,
        from: this.fromDate() || undefined,
        to: this.toDate() || undefined,
        page: this.page(),
        limit: PAGE_SIZE,
      })
      .subscribe({
        next: (res) => {
          this.records.set(res.records || []);
          this.totalRecords.set(res.total);
          this.totalPages.set(res.pages || 1);
          this.isLoading.set(false);
        },
        error: () => {
          this.isLoading.set(false);
          this.toast.error('Could not load purchase records');
        },
      });
  }

  onSearchChange(value: string): void {
    this.searchTerm.set(value);
    this.page.set(1);
    this.fetchRecords();
  }

  onDateFilterChange(): void {
    this.page.set(1);
    this.fetchRecords();
  }

  goToPage(page: number): void {
    this.page.set(page);
    this.fetchRecords();
  }

  // ---- Create panel ----------------------------------------------------

  openCreatePanel(): void {
    this.supplierName.set('');
    this.invoiceNumber.set('');
    this.invoiceDate.set(new Date().toISOString().slice(0, 10));
    this.notes.set('');
    this.itemQuery.set('');
    this.itemResults.set([]);
    this.draftLines.set([]);
    this.isCreatePanelOpen.set(true);
  }

  closeCreatePanel(): void {
    this.isCreatePanelOpen.set(false);
  }

  searchItems(): void {
    this.isSearchingItems.set(true);
    this.inventoryService.list({ search: this.itemQuery() || undefined, limit: 12 }).subscribe({
      next: (res) => {
        this.itemResults.set(res.items || []);
        this.isSearchingItems.set(false);
      },
      error: () => this.isSearchingItems.set(false),
    });
  }

  selectedArticleFor(product: InventoryItem): Article | undefined {
    const id = this.selectedArticleIds()[product._id];
    const active = activeArticles(product);
    return (id && active.find((a) => a._id === id)) || active[0];
  }

  onArticleSelect(productId: string, articleId: string): void {
    this.selectedArticleIds.update((map) => ({ ...map, [productId]: articleId }));
  }

  addDraftLine(product: InventoryItem): void {
    const article = this.selectedArticleFor(product);
    if (!article) return;

    const existing = this.draftLines().find((l) => l.articleId === article._id);
    if (existing) {
      this.toast.error('This variant is already in the list — adjust its quantity below instead');
      return;
    }

    this.draftLines.update((lines) => [
      ...lines,
      {
        inventoryItem: product._id,
        articleId: article._id,
        name: `${product.name} — ${describeArticle(article)}`,
        quantity: 1,
        unitCost: article.costPrice ?? 0, // pre-filled with current cost as a starting guess — editable
      },
    ]);
  }

  updateDraftQuantity(articleId: string, quantity: number): void {
    this.draftLines.update((lines) =>
      lines.map((l) => (l.articleId === articleId ? { ...l, quantity: Math.max(1, quantity) } : l))
    );
  }

  updateDraftCost(articleId: string, unitCost: number): void {
    this.draftLines.update((lines) =>
      lines.map((l) => (l.articleId === articleId ? { ...l, unitCost: Math.max(0, unitCost) } : l))
    );
  }

  removeDraftLine(articleId: string): void {
    this.draftLines.update((lines) => lines.filter((l) => l.articleId !== articleId));
  }

  savePurchase(): void {
    if (!this.supplierName().trim()) {
      this.toast.error('Supplier name is required');
      return;
    }
    if (!this.invoiceDate()) {
      this.toast.error('Invoice date is required');
      return;
    }
    if (this.draftLines().length === 0) {
      this.toast.error('Add at least one item received');
      return;
    }

    this.isSaving.set(true);
    this.purchaseService
      .create({
        supplierName: this.supplierName(),
        invoiceNumber: this.invoiceNumber() || undefined,
        invoiceDate: this.invoiceDate(),
        items: this.draftLines().map((l) => ({
          inventoryItem: l.inventoryItem,
          articleId: l.articleId,
          quantity: l.quantity,
          unitCost: l.unitCost,
        })),
        notes: this.notes() || undefined,
      })
      .subscribe({
        next: (res) => {
          this.isSaving.set(false);
          this.toast.success(`Purchase ${res.purchaseRecord.purchaseId} recorded — stock and cost updated`);
          this.isCreatePanelOpen.set(false);
          this.fetchRecords();
        },
        error: (err) => {
          this.isSaving.set(false);
          this.toast.error(err?.error?.message || 'Could not save purchase record');
        },
      });
  }

  // ---- Detail panel ------------------------------------------------------

  openDetail(record: PurchaseRecord): void {
    this.isPanelLoading.set(true);
    this.viewingRecord.set(record);
    this.purchaseService.getById(record._id).subscribe({
      next: (res) => {
        this.viewingRecord.set(res.purchaseRecord);
        this.isPanelLoading.set(false);
      },
      error: () => {
        this.isPanelLoading.set(false);
        this.toast.error('Could not load full purchase details');
      },
    });
  }

  closeDetail(): void {
    this.viewingRecord.set(null);
  }
}
