import { DatePipe } from '@angular/common';
import { Component, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CustomerService } from '../../core/services/customer.service';
import { InventoryService } from '../../core/services/inventory.service';
import { EyeTestService } from '../../core/services/eye-test.service';
import { OrderService } from '../../core/services/order.service';
import { ToastService } from '../../core/services/toast.service';
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
  private router = inject(Router);

  // expose helpers to the template
  activeArticles = activeArticles;
  describeArticle = describeArticle;

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
    // Auto-fill the field with the running total as items are added — but
    // only until the admin/staff actually types into it themselves.
    effect(() => {
      const total = this.orderTotal;
      if (!this.hasEditedAmount()) {
        this.amountReceived.set(total);
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
    this.searchResults.set([]);
    this.showNewCustomerForm.set(false);
    this.fetchLatestEyeTest(customer._id);
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
    this.searchResults.set([]);
    this.showNewCustomerForm.set(false);
    this.latestEyeTest.set(null);
    this.linkedEyeTestId.set(null);
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
        },
        error: (err) => {
          this.isSavingEyeTest.set(false);
          this.toast.error(err?.error?.message || 'Could not save eye test');
        },
      });
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
}