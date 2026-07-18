import { DatePipe } from '@angular/common';
import { Component, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CustomerService } from '../../core/services/customer.service';
import { InventoryService } from '../../core/services/inventory.service';
import { EyeTestService } from '../../core/services/eye-test.service';
import { OrderService } from '../../core/services/order.service';
import { ToastService } from '../../core/services/toast.service';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';
import { User } from '../../core/models/user.model';
import {
  Article,
  InventoryItem,
  activeArticles,
  describeArticle,
  inStockArticles,
} from '../../core/models/inventory.model';
import { EyeTest } from '../../core/models/eye-test.model';
import { PaymentMethod } from '../../core/models/order.model';

interface OrderLine {
  inventoryItem: string;
  articleId: string;
  name: string;
  price: number;
  stock: number;
  quantity: number;
}

type Step = 'customer' | 'eyeTest' | 'items' | 'payment';

// What gets persisted to localStorage between page loads/tab closes so
// staff can safely pause an order if another customer arrives at the
// counter. Browser-only by design — single-counter store, no need for a
// backend draft model right now.
interface WalkInDraft {
  step: Step;
  customer: User | null;
  linkedEyeTestId: string | null;
  orderLines: OrderLine[];
  paymentMethod: PaymentMethod;
  amountReceived: number | null;
  hasEditedAmount: boolean;
  orderNotes: string;
}

@Component({
  selector: 'app-walk-in-order',
  standalone: true,
  imports: [FormsModule, DatePipe],
  templateUrl: './walk-in-order.component.html',
  styleUrl: './walk-in-order.component.scss',
})
export class WalkInOrderComponent {
  private customerService = inject(CustomerService);
  private inventoryService = inject(InventoryService);
  private eyeTestService = inject(EyeTestService);
  private orderService = inject(OrderService);
  private toast = inject(ToastService);
  private confirmDialog = inject(ConfirmDialogService);
  private router = inject(Router);

  // expose helpers to the template
  activeArticles = activeArticles;
  describeArticle = describeArticle;

  private readonly DRAFT_KEY = 'walkInOrderDraft';
  private readonly stepOrder: Step[] = ['customer', 'eyeTest', 'items', 'payment'];
  readonly steps: { key: Step; label: string }[] = [
    { key: 'customer', label: '1. Customer' },
    { key: 'eyeTest', label: '2. Eye test' },
    { key: 'items', label: '3. Items' },
    { key: 'payment', label: '4. Payment & confirm' },
  ];

  currentStep = signal<Step>('customer');

  // Which variant is currently highlighted per search-result row, keyed by product id.
  private selectedArticleIds = signal<Record<string, string>>({});

  // --- Step 1: customer -----------------------------------------------
  phoneQuery = signal('');
  searchResults = signal<User[]>([]);
  isSearching = signal(false);
  selectedCustomer = signal<User | null>(null);

  showNewCustomerForm = signal(false);
  newCustomerName = signal('');
  newCustomerPhone = signal('');
  newCustomerEmail = signal('');
  isCreatingCustomer = signal(false);

  // --- Step 2: eye test -------------------------------------------------
  latestEyeTest = signal<EyeTest | null>(null);
  isLoadingEyeTest = signal(false);
  showEyeTestForm = signal(false);
  linkedEyeTestId = signal<string | null>(null);
  isSavingEyeTest = signal(false);

  rightSphere = signal<number | null>(null);
  rightCylinder = signal<number | null>(null);
  rightAxis = signal<number | null>(null);
  rightAdd = signal<number | null>(null);
  leftSphere = signal<number | null>(null);
  leftCylinder = signal<number | null>(null);
  leftAxis = signal<number | null>(null);
  leftAdd = signal<number | null>(null);
  pd = signal<number | null>(null);
  eyeTestNotes = signal('');

  // --- Step 3: items -----------------------------------------------------
  itemQuery = signal('');
  itemResults = signal<InventoryItem[]>([]);
  isSearchingItems = signal(false);
  orderLines = signal<OrderLine[]>([]);

  // --- Step 4: payment -----------------------------------------------
  paymentMethod = signal<PaymentMethod>('cash');
  amountReceived = signal<number | null>(null);
  // Tracks whether the admin/staff has manually typed into the amount field.
  // Kept separate from amountReceived itself — otherwise "cleared to empty"
  // and "never touched yet" both look like `null` and can't be told apart,
  // which is what caused the field to snap back to the full total the
  // moment someone tried to actually empty it out to type a new value.
  hasEditedAmount = signal(false);
  orderNotes = signal('');
  isPlacingOrder = signal(false);

  constructor() {
    this.restoreDraftIfAny();

    // Auto-fill the field with the running total as items are added — but
    // only until the admin/staff actually types into it themselves.
    effect(() => {
      const total = this.orderTotal;
      if (!this.hasEditedAmount()) {
        this.amountReceived.set(total);
      }
    });

    // Persist a resumable draft on any meaningful change. Only writes once
    // there's actually something worth resuming (a customer picked, or
    // items added) — an empty, untouched form has nothing to save.
    effect(() => {
      const draft: WalkInDraft = {
        step: this.currentStep(),
        customer: this.selectedCustomer(),
        linkedEyeTestId: this.linkedEyeTestId(),
        orderLines: this.orderLines(),
        paymentMethod: this.paymentMethod(),
        amountReceived: this.amountReceived(),
        hasEditedAmount: this.hasEditedAmount(),
        orderNotes: this.orderNotes(),
      };
      if (draft.customer || draft.orderLines.length > 0) {
        localStorage.setItem(this.DRAFT_KEY, JSON.stringify(draft));
      }
    });
  }

  get orderTotal(): number {
    return this.orderLines().reduce((sum, l) => sum + l.price * l.quantity, 0);
  }

  onAmountReceivedChange(value: number | null): void {
    this.hasEditedAmount.set(true);
    this.amountReceived.set(value);
  }

  get balanceDue(): number {
    const paid = Math.min(Math.max(this.amountReceived() ?? 0, 0), this.orderTotal);
    return this.orderTotal - paid;
  }

  // ---- Draft persistence -------------------------------------------------

  private restoreDraftIfAny(): void {
    const raw = localStorage.getItem(this.DRAFT_KEY);
    if (!raw) return;

    let draft: WalkInDraft;
    try {
      draft = JSON.parse(raw);
    } catch {
      localStorage.removeItem(this.DRAFT_KEY);
      return;
    }

    if (!draft.customer && (!draft.orderLines || draft.orderLines.length === 0)) {
      localStorage.removeItem(this.DRAFT_KEY);
      return;
    }

    this.confirmDialog
      .confirm({
        title: 'Resume in-progress order?',
        message: `There's an unfinished walk-in order${draft.customer ? ` for ${draft.customer.name}` : ''}. Resume it, or start fresh?`,
        confirmText: 'Resume',
      })
      .then((confirmed) => {
        if (confirmed) {
          this.currentStep.set(draft.step || 'customer');
          this.selectedCustomer.set(draft.customer || null);
          this.linkedEyeTestId.set(draft.linkedEyeTestId || null);
          this.orderLines.set(draft.orderLines || []);
          this.paymentMethod.set(draft.paymentMethod || 'cash');
          this.amountReceived.set(draft.amountReceived ?? null);
          this.hasEditedAmount.set(draft.hasEditedAmount || false);
          this.orderNotes.set(draft.orderNotes || '');
          if (draft.customer) this.fetchLatestEyeTest(draft.customer._id);
        } else {
          localStorage.removeItem(this.DRAFT_KEY);
        }
      });
  }

  private clearDraft(): void {
    localStorage.removeItem(this.DRAFT_KEY);
  }

  async startOver(): Promise<void> {
    const hasProgress = this.selectedCustomer() || this.orderLines().length > 0;
    if (hasProgress) {
      const confirmed = await this.confirmDialog.confirm({
        title: 'Start a new order?',
        message: 'This will discard the current in-progress order. This cannot be undone.',
        confirmText: 'Start over',
        danger: true,
      });
      if (!confirmed) return;
    }

    this.clearDraft();
    this.selectedCustomer.set(null);
    this.phoneQuery.set('');
    this.searchResults.set([]);
    this.showNewCustomerForm.set(false);
    this.latestEyeTest.set(null);
    this.linkedEyeTestId.set(null);
    this.showEyeTestForm.set(false);
    this.orderLines.set([]);
    this.itemResults.set([]);
    this.itemQuery.set('');
    this.paymentMethod.set('cash');
    this.amountReceived.set(null);
    this.hasEditedAmount.set(false);
    this.orderNotes.set('');
    this.currentStep.set('customer');
  }

  // ---- Step navigation -----------------------------------------------

  // Eye test is deliberately optional (matches existing backend contract —
  // prescriptionUsed is not required on an order), so the highest reachable
  // step only depends on: a customer being selected (unlocks eyeTest AND
  // items), and at least one item being added (unlocks payment).
  private maxReachableIndex(): number {
    if (this.orderLines().length > 0) return 3;
    if (this.selectedCustomer()) return 2;
    return 0;
  }

  canJumpTo(step: Step): boolean {
    return this.stepOrder.indexOf(step) <= this.maxReachableIndex();
  }

  isStepDone(step: Step): boolean {
    return this.stepOrder.indexOf(step) < this.stepOrder.indexOf(this.currentStep());
  }

  goToStep(step: Step): void {
    if (this.canJumpTo(step)) this.currentStep.set(step);
  }

  nextStep(): void {
    const idx = this.stepOrder.indexOf(this.currentStep());
    const next = this.stepOrder[idx + 1];
    if (next && this.canJumpTo(next)) this.currentStep.set(next);
  }

  prevStep(): void {
    const idx = this.stepOrder.indexOf(this.currentStep());
    const prev = this.stepOrder[idx - 1];
    if (prev) this.currentStep.set(prev);
  }

  // ---- Customer search / select ----------------------------------------
  searchCustomer(): void {
    const phone = this.phoneQuery().trim();
    if (phone.length < 4) {
      this.toast.error('Enter at least 4 digits of the phone number');
      return;
    }

    this.isSearching.set(true);
    this.customerService.searchByPhone(phone).subscribe({
      next: (res) => {
        this.searchResults.set(res.customers);
        this.isSearching.set(false);
        if (res.customers.length === 0) {
          this.showNewCustomerForm.set(true);
          this.newCustomerPhone.set(phone);
        }
      },
      error: () => {
        this.isSearching.set(false);
        this.toast.error('Search failed');
      },
    });
  }

  selectCustomer(customer: User): void {
    this.selectedCustomer.set(customer);
    this.showNewCustomerForm.set(false);
    this.fetchLatestEyeTest(customer._id);
    this.currentStep.set('eyeTest');
    // Deliberately NOT clearing searchResults here — if there were multiple
    // matches, "Change" should be able to show them again immediately
    // without forcing a re-search.
  }

  createNewCustomer(): void {
    if (!this.newCustomerName().trim() || !this.newCustomerPhone().trim()) {
      this.toast.error('Name and phone are required');
      return;
    }

    this.isCreatingCustomer.set(true);
    this.customerService
      .quickCreate({
        name: this.newCustomerName(),
        phone: this.newCustomerPhone(),
        email: this.newCustomerEmail() || undefined,
      })
      .subscribe({
        next: (res) => {
          this.isCreatingCustomer.set(false);
          this.toast.success('Customer created');
          this.selectCustomer(res.customer);
        },
        error: (err) => {
          this.isCreatingCustomer.set(false);
          this.toast.error(err?.error?.message || 'Could not create customer');
        },
      });
  }

  changeCustomer(): void {
    this.selectedCustomer.set(null);
    this.phoneQuery.set('');
    this.showNewCustomerForm.set(false);
    this.latestEyeTest.set(null);
    this.linkedEyeTestId.set(null);
    this.currentStep.set('customer');
  }

  // ---- Eye test -----------------------------------------------------
  fetchLatestEyeTest(customerId: string): void {
    this.isLoadingEyeTest.set(true);
    this.eyeTestService.latestFor(customerId).subscribe({
      next: (res) => {
        this.latestEyeTest.set(res.eyeTest);
        this.isLoadingEyeTest.set(false);
      },
      error: () => this.isLoadingEyeTest.set(false),
    });
  }

  useExistingEyeTest(): void {
    const test = this.latestEyeTest();
    if (test) this.linkedEyeTestId.set(test._id);
    this.toast.success('Using existing prescription for this order');
    this.currentStep.set('items');
  }

  saveNewEyeTest(): void {
    const customer = this.selectedCustomer();
    if (!customer) return;

    this.isSavingEyeTest.set(true);
    this.eyeTestService
      .create({
        customer: customer._id,
        rightEye: {
          sphere: this.rightSphere() ?? undefined,
          cylinder: this.rightCylinder() ?? undefined,
          axis: this.rightAxis() ?? undefined,
          add: this.rightAdd() ?? undefined,
        },
        leftEye: {
          sphere: this.leftSphere() ?? undefined,
          cylinder: this.leftCylinder() ?? undefined,
          axis: this.leftAxis() ?? undefined,
          add: this.leftAdd() ?? undefined,
        },
        pupillaryDistance: this.pd() ?? undefined,
        notes: this.eyeTestNotes() || undefined,
      })
      .subscribe({
        next: (res) => {
          this.isSavingEyeTest.set(false);
          this.linkedEyeTestId.set(res.eyeTest._id);
          this.latestEyeTest.set(res.eyeTest);
          this.showEyeTestForm.set(false);
          this.toast.success('Eye test recorded');
          this.currentStep.set('items');
        },
        error: (err) => {
          this.isSavingEyeTest.set(false);
          this.toast.error(err?.error?.message || 'Could not save eye test');
        },
      });
  }

  skipEyeTest(): void {
    this.currentStep.set('items');
  }

  // ---- Items ----------------------------------------------------------
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
    const inStock = inStockArticles(product);
    return (id && inStock.find((a) => a._id === id)) || inStock[0] || activeArticles(product)[0];
  }

  onArticleSelect(productId: string, articleId: string): void {
    this.selectedArticleIds.update((map) => ({ ...map, [productId]: articleId }));
  }

  // The database stock (article.stock) never changes until the order is
  // actually placed — so this subtracts whatever's already sitting in the
  // current draft, giving an accurate "what can I still add" number instead
  // of showing the same raw stock figure no matter how much is already queued.
  remainingStock(article: Article): number {
    const alreadyAdded = this.orderLines().find((l) => l.articleId === article._id)?.quantity ?? 0;
    return article.stock - alreadyAdded;
  }

  addItem(product: InventoryItem): void {
    const article = this.selectedArticleFor(product);
    if (!article || this.remainingStock(article) <= 0) {
      this.toast.error('No more of this variant available to add');
      return;
    }

    const current = this.orderLines();
    const existing = current.find((l) => l.articleId === article._id);
    if (existing) {
      this.updateQuantity(article._id, existing.quantity + 1);
      return;
    }
    this.orderLines.set([
      ...current,
      {
        inventoryItem: product._id,
        articleId: article._id,
        name: `${product.name} — ${describeArticle(article)}`,
        price: article.price,
        stock: article.stock,
        quantity: 1,
      },
    ]);
  }

  updateQuantity(articleId: string, quantity: number): void {
    if (quantity <= 0) {
      this.removeItem(articleId);
      return;
    }
    this.orderLines.update((lines) =>
      lines.map((l) => (l.articleId === articleId ? { ...l, quantity: Math.min(quantity, l.stock) } : l))
    );
  }

  removeItem(articleId: string): void {
    this.orderLines.update((lines) => lines.filter((l) => l.articleId !== articleId));
  }

  // ---- Submit ----------------------------------------------------------
  placeOrder(): void {
    const customer = this.selectedCustomer();
    if (!customer) {
      this.toast.error('Select or create a customer first');
      return;
    }
    if (this.orderLines().length === 0) {
      this.toast.error('Add at least one item');
      return;
    }

    this.isPlacingOrder.set(true);
    this.orderService
      .createWalkIn({
        customerId: customer._id,
        items: this.orderLines().map((l) => ({ inventoryItem: l.inventoryItem, articleId: l.articleId, quantity: l.quantity })),
        paymentMethod: this.paymentMethod(),
        amountPaid: this.hasEditedAmount()
          ? Math.min(Math.max(this.amountReceived() ?? 0, 0), this.orderTotal)
          : undefined,
        prescriptionUsed: this.linkedEyeTestId() || undefined,
        notes: this.orderNotes() || undefined,
      })
      .subscribe({
        next: (res) => {
          this.isPlacingOrder.set(false);
          this.clearDraft();
          this.toast.success(
            res.changeDue > 0
              ? `Order ${res.order.orderId} created — give ₹${res.changeDue} change to the customer`
              : `Order ${res.order.orderId} created`
          );
          this.router.navigate(['/admin-orders']);
        },
        error: (err) => {
          this.isPlacingOrder.set(false);
          this.toast.error(err?.error?.message || 'Could not place order');
        },
      });
  }

  eyeTestBack(): void {
    if (this.showEyeTestForm() && this.latestEyeTest()) {
      // Currently on the "record a new test" form, but an existing
      // prescription is available — step back to that view first,
      // instead of leaving the eye-test step entirely.
      this.showEyeTestForm.set(false);
      return;
    }
    this.prevStep();
  }
}
