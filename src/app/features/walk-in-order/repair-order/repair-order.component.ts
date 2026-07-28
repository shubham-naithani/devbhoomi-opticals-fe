import { DatePipe } from '@angular/common';
import { Component, inject, signal, ViewChild, ElementRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CustomerService } from '../../../core/services/customer.service';
import { RepairService } from '../../../core/services/repair.service';
import { ToastService } from '../../../core/services/toast.service';
import { User } from '../../../core/models/user.model';
import { RepairCandidate, RepairLookupResult } from '../../../core/models/repair.model';
import { PaymentMethod } from '../../../core/models/order.model';

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
  private router = inject(Router);

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

  // --- Barcode lookup -------------------------------------------------------
  barcodeInput = signal('');
  isLookingUp = signal(false);
  lookupResult = signal<RepairLookupResult | null>(null);
  selectedCandidate = signal<RepairCandidate | null>(null);
  // Once a lookup has run at least once with zero candidates, or the staff
  // explicitly chooses to proceed without a match — the ticket becomes
  // "unverified": no purchase-date/warranty auto-calc, staff manually
  // decides the fee.
  proceedUnverified = signal(false);

  // --- Ticket details -------------------------------------------------------
  issueDescription = signal('');
  staffNotes = signal('');
  feeAmount = signal<number | null>(null);
  feeCollected = signal(false);
  paymentMethod = signal<PaymentMethod>('cash');
  isCreatingTicket = signal(false);

  // ---- Warranty computation (client-side preview only — server recomputes
  // authoritatively at creation, this is just so staff sees it immediately) --
  get warrantyCutoff(): Date | null {
    const c = this.selectedCandidate();
    if (!c || !c.warrantyMonths) return null;
    const cutoff = new Date(c.purchaseDate);
    cutoff.setMonth(cutoff.getMonth() + c.warrantyMonths);
    return cutoff;
  }

  get isUnderWarranty(): boolean {
    const cutoff = this.warrantyCutoff;
    if (!cutoff) return false;
    return new Date() <= cutoff;
  }

  get showFeeSection(): boolean {
    // Fee is relevant once we know the item (verified or proceeding
    // unverified) and either there's no warranty coverage, or it's expired.
    return (!!this.selectedCandidate() || this.proceedUnverified()) && !this.isUnderWarranty;
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
    this.lookupResult.set(null);
    this.selectedCandidate.set(null);
    this.proceedUnverified.set(false);
    this.issueDescription.set('');
    this.staffNotes.set('');
    this.feeAmount.set(null);
    this.feeCollected.set(false);
  }

  onLookupBarcode(): void {
    const customer = this.selectedCustomer();
    const code = this.barcodeInput().trim();
    if (!customer) return;
    if (code.length < 6) {
      this.toast.error('Enter a complete barcode (or use the scanner)');
      return;
    }

    this.isLookingUp.set(true);
    this.repairService.lookup(customer._id, code).subscribe({
      next: (res) => {
        this.isLookingUp.set(false);
        this.lookupResult.set(res);
        this.proceedUnverified.set(false);
        this.selectedCandidate.set(null);
        if (res.candidates.length === 1) {
          this.selectedCandidate.set(res.candidates[0]);
        } else if (res.candidates.length === 0) {
          this.toast.error('No matching purchase found for this customer — you can still proceed manually below');
        }
      },
      error: (err) => {
        this.isLookingUp.set(false);
        this.toast.error(err?.error?.message || 'No item found for this barcode');
      },
    });
  }

  pickCandidate(candidate: RepairCandidate): void {
    this.selectedCandidate.set(candidate);
    this.proceedUnverified.set(false);
  }

  useWithoutMatch(): void {
    this.proceedUnverified.set(true);
    this.selectedCandidate.set(null);
  }

  scanAnotherItem(): void {
    this.resetLookup();
    setTimeout(() => this.barcodeInputRef?.nativeElement?.focus(), 50);
  }

  // ---- Submit -----------------------------------------------------------------
  createTicket(): void {
    const customer = this.selectedCustomer();
    const lookup = this.lookupResult();
    if (!customer || !lookup) {
      this.toast.error('Scan an item first');
      return;
    }
    if (!this.issueDescription().trim()) {
      this.toast.error('Describe the issue before creating a repair ticket');
      return;
    }

    const candidate = this.selectedCandidate();
    if (!candidate && !this.proceedUnverified()) {
      this.toast.error('Select a matching purchase, or choose to proceed without one');
      return;
    }

    this.isCreatingTicket.set(true);
    this.repairService
      .create({
        customerId: customer._id,
        inventoryItem: lookup.item._id,
        articleId: lookup.article._id,
        itemName: lookup.itemName,
        linkedOrderId: candidate?.orderId,
        purchaseDate: candidate?.purchaseDate,
        warrantyMonths: candidate?.warrantyMonths,
        issueDescription: this.issueDescription(),
        staffNotes: this.staffNotes() || undefined,
        feeAmount: this.showFeeSection ? this.feeAmount() ?? undefined : undefined,
        feeCollected: this.showFeeSection ? this.feeCollected() : undefined,
        paymentMethod: this.showFeeSection && this.feeCollected() ? this.paymentMethod() : undefined,
      })
      .subscribe({
        next: (res) => {
          this.isCreatingTicket.set(false);
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
