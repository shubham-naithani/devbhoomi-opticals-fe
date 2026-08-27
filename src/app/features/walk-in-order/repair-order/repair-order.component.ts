import { DatePipe } from '@angular/common';
import { Component, effect, inject, signal, ViewChild, ElementRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { CustomerService } from '../../../core/services/customer.service';
import { RepairService, RepairOrderItem, RepairOrderLookup } from '../../../core/services/repair.service';
import { ToastService } from '../../../core/services/toast.service';
import { ConfirmDialogService } from '../../../core/services/confirm-dialog.service';
import { User } from '../../../core/models/user.model';
import { PaymentMethod } from '../../../core/models/order.model';

// What gets persisted to localStorage between page loads/tab switches so
// staff can safely pause a repair ticket if another customer arrives at
// the counter — same pattern as the walk-in order draft (walkInOrderDraft).
interface RepairDraft {
  customer: User | null;
  scannedOrder: RepairOrderLookup | null;
  selectedItem: RepairOrderItem | null;
  issueDescription: string;
  staffNotes: string;
  feeAmount: number | null;
  feeCollected: boolean;
  paymentMethod: PaymentMethod;
}

@Component({
  selector: 'app-repair-order',
  standalone: true,
  imports: [FormsModule, DatePipe],
  templateUrl: './repair-order.component.html',
  styleUrl: './repair-order.component.scss',
})
export class RepairOrderComponent {
  @ViewChild('barcodeInputEl') barcodeInputRef?: ElementRef<HTMLInputElement>;
  private customerService = inject(CustomerService);
  private repairService = inject(RepairService);
  private toast = inject(ToastService);
  private confirmDialog = inject(ConfirmDialogService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  private readonly DRAFT_KEY = 'walkInRepairDraft';

  // --- Customer -----------------------------------------------------------
  phoneQuery = signal('');
  searchResults = signal<User[]>([]);
  isSearching = signal(false);
  selectedCustomer = signal<User | null>(null);

  showNewCustomerForm = signal(false);
  newCustomerName = signal('');
  newCustomerPhone = signal('');
  newCustomerEmail = signal('');
  isCreatingCustomer = signal(false);

  // --- Barcode lookup ---------------------------------------------------------
  // The printed invoice now carries a single ORDER-level barcode (not one per
  // item — see invoiceGenerator.js), so scanning it resolves straight to the
  // whole order. Staff then picks which line item on it needs a repair —
  // no more "which purchase of this item?" candidate disambiguation, since
  // the exact order is already known the moment the scan succeeds.
  barcodeInput = signal('');
  isLookingUp = signal(false);
  scannedOrder = signal<RepairOrderLookup | null>(null);
  selectedItem = signal<RepairOrderItem | null>(null);

  // For an item that wasn't bought at this store — no invoice to scan, so
  // staff can describe it manually instead. scannedOrder stays null for
  // this path; the backend already treats a ticket with no linkedOrderId
  // as "unverified" (no warranty), which is exactly right here.
  isManualItem = signal(false);
  manualItemName = signal('');

  // --- Ticket details -------------------------------------------------------
  issueDescription = signal('');
  staffNotes = signal('');
  feeAmount = signal<number | null>(null);
  feeCollected = signal(false);
  paymentMethod = signal<PaymentMethod>('cash');
  isCreatingTicket = signal(false);

  constructor() {
    this.checkIncomingRepairRequest();

    // Persist a resumable draft on any meaningful change. Only writes once
    // a customer has actually been picked — an untouched form has nothing
    // worth resuming.
    effect(() => {
      const draft: RepairDraft = {
        customer: this.selectedCustomer(),
        scannedOrder: this.scannedOrder(),
        selectedItem: this.selectedItem(),
        issueDescription: this.issueDescription(),
        staffNotes: this.staffNotes(),
        feeAmount: this.feeAmount(),
        feeCollected: this.feeCollected(),
        paymentMethod: this.paymentMethod(),
      };
      if (draft.customer) {
        localStorage.setItem(this.DRAFT_KEY, JSON.stringify(draft));
      }
    });
  }

  // ---- Draft persistence --------------------------------------------------

  private clearDraft(): void {
    localStorage.removeItem(this.DRAFT_KEY);
  }

  // If Orders just sent us here via a per-item "Repair" button (see
  // admin-orders.component's repairItem()), that takes priority over
  // silently resuming an old draft — but if BOTH exist, ask explicitly
  // rather than discarding either one without confirmation. Mirrors New
  // Order's checkPriceCheckHandoff() for the same reason.
  private checkIncomingRepairRequest(): void {
    const params = this.route.snapshot.queryParamMap;
    const customerId = params.get('customerId');
    const customerPhone = params.get('customerPhone');
    const orderBarcode = params.get('orderBarcode');
    const articleId = params.get('articleId');

    if (!customerId || !customerPhone || !orderBarcode) {
      this.restoreDraftIfAny();
      return;
    }

    const applyIncoming = () => {
      this.customerService.searchByPhone(customerPhone).subscribe({
        next: (res) => {
          const customer = res.customers.find((c) => c._id === customerId) || res.customers[0];
          if (!customer) {
            this.toast.error('Could not find that customer here — search manually');
            return;
          }
          this.selectedCustomer.set(customer);
          this.barcodeInput.set(orderBarcode);
          this.isLookingUp.set(true);
          this.repairService.lookupOrder(customer._id, orderBarcode).subscribe({
            next: (orderRes) => {
              this.isLookingUp.set(false);
              this.scannedOrder.set(orderRes.order);
              const preselected = articleId
                ? orderRes.order.items.find((i) => i.articleId === articleId)
                : null;
              this.selectedItem.set(
                preselected || (orderRes.order.items.length === 1 ? orderRes.order.items[0] : null),
              );
            },
            error: (err) => {
              this.isLookingUp.set(false);
              this.toast.error(err?.error?.message || 'Could not load that order — scan the invoice manually');
            },
          });
        },
        error: () => this.toast.error('Could not find that customer here — search manually'),
      });
    };

    const hasExistingDraft = !!localStorage.getItem(this.DRAFT_KEY);
    if (hasExistingDraft) {
      this.confirmDialog
        .confirm({
          title: 'Start this repair fresh?',
          message: "You have an unfinished repair ticket in progress. Starting this one will discard it.",
          confirmText: 'Start fresh',
          danger: true,
        })
        .then((confirmed) => {
          if (confirmed) {
            this.clearDraft();
            applyIncoming();
          } else {
            this.restoreDraftIfAny();
          }
        });
    } else {
      applyIncoming();
    }
  }

  private restoreDraftIfAny(): void {
    const raw = localStorage.getItem(this.DRAFT_KEY);
    if (!raw) return;

    let draft: RepairDraft;
    try {
      draft = JSON.parse(raw);
    } catch {
      localStorage.removeItem(this.DRAFT_KEY);
      return;
    }

    if (!draft.customer) {
      localStorage.removeItem(this.DRAFT_KEY);
      return;
    }

    this.confirmDialog
      .confirm({
        title: 'Resume in-progress repair?',
        message: `There's an unfinished repair ticket for ${draft.customer.name}. Resume it, or start fresh?`,
        confirmText: 'Resume',
      })
      .then((confirmed) => {
        if (confirmed) {
          this.selectedCustomer.set(draft.customer);
          this.scannedOrder.set(draft.scannedOrder || null);
          this.selectedItem.set(draft.selectedItem || null);
          this.issueDescription.set(draft.issueDescription || '');
          this.staffNotes.set(draft.staffNotes || '');
          this.feeAmount.set(draft.feeAmount ?? null);
          this.feeCollected.set(draft.feeCollected || false);
          this.paymentMethod.set(draft.paymentMethod || 'cash');
        } else {
          localStorage.removeItem(this.DRAFT_KEY);
        }
      });
  }

  // ---- Warranty computation (client-side preview only — server recomputes
  // authoritatively at creation, this is just so staff sees it immediately) --
  get warrantyCutoff(): Date | null {
    const order = this.scannedOrder();
    const item = this.selectedItem();
    if (!order || !item || !item.warrantyMonths) return null;
    const cutoff = new Date(order.createdAt);
    cutoff.setMonth(cutoff.getMonth() + item.warrantyMonths);
    return cutoff;
  }

  get isUnderWarranty(): boolean {
    const cutoff = this.warrantyCutoff;
    if (!cutoff) return false;
    return new Date() <= cutoff;
  }

  get showFeeSection(): boolean {
    // Fee is relevant once an item has been picked and either there's no
    // warranty coverage, or it's expired.
    return !!this.selectedItem() && !this.isUnderWarranty;
  }

  // ---- Customer search / select --------------------------------------------
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
    setTimeout(() => this.barcodeInputRef?.nativeElement?.focus(), 50);
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
    this.resetLookup();
  }

  // ---- Barcode lookup --------------------------------------------------------
  private resetLookup(): void {
    this.barcodeInput.set('');
    this.scannedOrder.set(null);
    this.selectedItem.set(null);
    this.isManualItem.set(false);
    this.manualItemName.set('');
    this.issueDescription.set('');
    this.staffNotes.set('');
    this.feeAmount.set(null);
    this.feeCollected.set(false);
  }

  onLookupBarcode(): void {
    const customer = this.selectedCustomer();
    const code = this.barcodeInput().trim();
    if (!customer) return;
    if (!code) {
      this.toast.error('Enter a complete barcode (or use the scanner)');
      return;
    }

    this.isLookingUp.set(true);
    this.repairService.lookupOrder(customer._id, code).subscribe({
      next: (res) => {
        this.isLookingUp.set(false);
        this.scannedOrder.set(res.order);
        // If the order only has one line item, skip the picker entirely —
        // one less click for the overwhelmingly common case.
        this.selectedItem.set(res.order.items.length === 1 ? res.order.items[0] : null);
      },
      error: (err) => {
        this.isLookingUp.set(false);
        this.toast.error(err?.error?.message || 'No order found for this barcode');
      },
    });
  }

  pickItem(item: RepairOrderItem): void {
    this.selectedItem.set(item);
  }

  // No invoice for this item — staff types a description instead. No
  // articleId/inventoryItem to link (there's no real inventory record for
  // an item never sold here), so those go through empty and the backend's
  // `|| undefined` treats them as absent, same as it always has.
  useManualItem(): void {
    const name = this.manualItemName().trim();
    if (!name) {
      this.toast.error('Describe the item before continuing');
      return;
    }
    this.selectedItem.set({
      inventoryItem: '',
      articleId: '',
      name,
      price: 0,
      quantity: 1,
      warrantyMonths: 0,
    });
    // Done with the manual-entry form now that it's confirmed — otherwise
    // it stays visible (isManualItem is still true) alongside the
    // Item/Purchase summary below it, showing both at once.
    this.isManualItem.set(false);
    this.manualItemName.set('');
  }

  cancelManualItem(): void {
    this.isManualItem.set(false);
    this.manualItemName.set('');
  }

  // Un-picks the item but keeps the scanned order (if any), so staff can
  // pick a different line item off the same invoice without re-scanning —
  // the "← Back" affordance on the item-match and issue&fee steps.
  backToItemPicker(): void {
    this.selectedItem.set(null);
    this.isManualItem.set(false);
    this.manualItemName.set('');
    this.issueDescription.set('');
    this.staffNotes.set('');
    this.feeAmount.set(null);
    this.feeCollected.set(false);
  }

  scanAnotherItem(): void {
    this.resetLookup();
    setTimeout(() => this.barcodeInputRef?.nativeElement?.focus(), 50);
  }

  // ---- Start over -------------------------------------------------------------
  async startOver(): Promise<void> {
    const hasProgress = this.selectedCustomer() || this.scannedOrder();
    if (hasProgress) {
      const confirmed = await this.confirmDialog.confirm({
        title: 'Start a new repair?',
        message: 'This will discard the current in-progress repair ticket. This cannot be undone.',
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
    this.newCustomerName.set('');
    this.newCustomerPhone.set('');
    this.newCustomerEmail.set('');
    this.resetLookup();
  }

  // ---- Submit -----------------------------------------------------------------
  createTicket(): void {
    const customer = this.selectedCustomer();
    const order = this.scannedOrder(); // null for a manually-entered item — that's fine, it's unverified
    const item = this.selectedItem();
    if (!customer || !item) {
      this.toast.error('Pick an item — scanned or entered manually — first');
      return;
    }
    if (!this.issueDescription().trim()) {
      this.toast.error('Describe the issue before creating a repair ticket');
      return;
    }

    this.isCreatingTicket.set(true);
    this.repairService
      .create({
        customerId: customer._id,
        inventoryItem: item.inventoryItem || undefined,
        articleId: item.articleId || undefined,
        itemName: item.name,
        linkedOrderId: order?._id,
        purchaseDate: order?.createdAt,
        warrantyMonths: item.warrantyMonths,
        issueDescription: this.issueDescription(),
        staffNotes: this.staffNotes() || undefined,
        feeAmount: this.showFeeSection ? this.feeAmount() ?? undefined : undefined,
        feeCollected: this.showFeeSection ? this.feeCollected() : undefined,
        paymentMethod: this.showFeeSection && this.feeCollected() ? this.paymentMethod() : undefined,
      })
      .subscribe({
        next: (res) => {
          this.isCreatingTicket.set(false);
          this.clearDraft();
          this.toast.success(`Repair ticket ${res.ticket.repairId} created`);
          this.router.navigate(['/repairs']);
        },
        error: (err) => {
          this.isCreatingTicket.set(false);
          this.toast.error(err?.error?.message || 'Could not create repair ticket');
        },
      });
  }
}
