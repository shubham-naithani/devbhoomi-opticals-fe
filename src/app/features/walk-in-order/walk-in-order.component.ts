import { DatePipe } from '@angular/common';
import { Component, inject, signal, effect } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CustomerService } from '../../core/services/customer.service';
import { InventoryService } from '../../core/services/inventory.service';
import { EyeTestService } from '../../core/services/eye-test.service';
import { OrderService } from '../../core/services/order.service';
import { ToastService } from '../../core/services/toast.service';
import { User } from '../../core/models/user.model';
import { InventoryItem } from '../../core/models/inventory.model';
import { EyeTest } from '../../core/models/eye-test.model';
import { PaymentMethod } from '../../core/models/order.model';

interface OrderLine {
  inventoryItem: string;
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
  // null = "full amount" (the default — most in-store sales are paid in full).
  // Set to a smaller number to record a partial/advance payment instead.
  amountReceived = signal<number | null>(null);
  orderNotes = signal('');
  isPlacingOrder = signal(false);
  hasEditedAmount = signal(false);

  get effectiveAmountReceived(): number {
    const entered = this.amountReceived();
    return entered === null ? this.orderTotal : Math.min(Math.max(entered, 0), this.orderTotal);
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

  constructor() {
    // Keep the field auto-filled with the running total as items are added —
    // but only until the admin/staff actually types into it themselves.
    effect(() => {
      const total = this.orderTotal;
      if (!this.hasEditedAmount()) {
        this.amountReceived.set(total);
      }
    });
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

  addItem(item: InventoryItem): void {
    if (item.stock <= 0) {
      this.toast.error('This item is out of stock');
      return;
    }
    const current = this.orderLines();
    const existing = current.find((l) => l.inventoryItem === item._id);
    if (existing) {
      this.updateQuantity(item._id, Math.min(existing.quantity + 1, item.stock));
      return;
    }
    this.orderLines.set([
      ...current,
      { inventoryItem: item._id, name: item.name, price: item.price, stock: item.stock, quantity: 1 },
    ]);
  }

  updateQuantity(inventoryItemId: string, quantity: number): void {
    if (quantity <= 0) {
      this.removeItem(inventoryItemId);
      return;
    }
    this.orderLines.update((lines) =>
      lines.map((l) => (l.inventoryItem === inventoryItemId ? { ...l, quantity: Math.min(quantity, l.stock) } : l))
    );
  }

  removeItem(inventoryItemId: string): void {
    this.orderLines.update((lines) => lines.filter((l) => l.inventoryItem !== inventoryItemId));
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
        items: this.orderLines().map((l) => ({ inventoryItem: l.inventoryItem, quantity: l.quantity })),
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
