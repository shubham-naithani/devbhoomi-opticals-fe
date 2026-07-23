import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { RouterLink } from '@angular/router';
import { AccountService, Address } from 'shared';

@Component({
  selector: 'app-addresses',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, MatFormFieldModule, MatInputModule, MatButtonModule, MatCardModule, MatIconModule],
  templateUrl: './addresses.component.html',
  styleUrl: './addresses.component.scss',
})
export class AddressesComponent implements OnInit {
  private fb = inject(FormBuilder);
  private accountService = inject(AccountService);
  private snackBar = inject(MatSnackBar);

  addresses = signal<Address[]>([]);
  isLoading = signal(true);
  isSaving = signal(false);
  formError = signal('');

  isFormOpen = signal(false);
  editingId = signal<string | null>(null);

  form = this.fb.group({
    label: ['Home', Validators.required],
    line1: ['', Validators.required],
    line2: [''],
    city: ['', Validators.required],
    state: [''],
    pincode: ['', Validators.required],
    phone: [''],
    isDefault: [false],
  });

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.isLoading.set(true);
    this.accountService.listAddresses().subscribe({
      next: ({ addresses }) => {
        this.addresses.set(addresses);
        this.isLoading.set(false);
      },
      error: () => this.isLoading.set(false),
    });
  }

  openAddForm(): void {
    this.editingId.set(null);
    this.form.reset({ label: 'Home', isDefault: this.addresses().length === 0 });
    this.formError.set('');
    this.isFormOpen.set(true);
  }

  openEditForm(addr: Address): void {
    this.editingId.set(addr._id);
    this.form.setValue({
      label: addr.label,
      line1: addr.line1,
      line2: addr.line2 || '',
      city: addr.city,
      state: addr.state || '',
      pincode: addr.pincode,
      phone: addr.phone || '',
      isDefault: addr.isDefault,
    });
    this.formError.set('');
    this.isFormOpen.set(true);
  }

  cancelForm(): void {
    this.isFormOpen.set(false);
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.isSaving.set(true);
    this.formError.set('');

    const value = this.form.getRawValue();
    const payload = {
      label: value.label!,
      line1: value.line1!,
      line2: value.line2 || undefined,
      city: value.city!,
      state: value.state || undefined,
      pincode: value.pincode!,
      phone: value.phone || undefined,
      isDefault: value.isDefault!,
    };

    const editId = this.editingId();
    const request = editId
      ? this.accountService.updateAddress(editId, payload)
      : this.accountService.addAddress(payload);

    request.subscribe({
      next: ({ addresses }) => {
        this.addresses.set(addresses);
        this.isSaving.set(false);
        this.isFormOpen.set(false);
        this.snackBar.open(editId ? 'Address updated' : 'Address added', undefined, { duration: 2500 });
      },
      error: (err) => {
        this.isSaving.set(false);
        this.formError.set(err?.error?.message || 'Could not save address.');
      },
    });
  }

  remove(addr: Address): void {
    if (!confirm(`Remove the "${addr.label}" address?`)) return;

    this.accountService.deleteAddress(addr._id).subscribe({
      next: ({ addresses }) => {
        this.addresses.set(addresses);
        this.snackBar.open('Address removed', undefined, { duration: 2500 });
      },
      error: () => this.snackBar.open('Could not remove address', undefined, { duration: 2500 }),
    });
  }

  makeDefault(addr: Address): void {
    this.accountService.updateAddress(addr._id, { isDefault: true }).subscribe({
      next: ({ addresses }) => this.addresses.set(addresses),
    });
  }
}
