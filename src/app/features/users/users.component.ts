import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { UserService } from '../../core/services/user.service';
import { ToastService } from '../../core/services/toast.service';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';
import { PaginationComponent } from '../../shared/components/pagination/pagination.component';
import { User } from '../../core/models/user.model';

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [ReactiveFormsModule, PaginationComponent],
  templateUrl: './users.component.html',
  styleUrl: './users.component.scss',
})
export class UsersComponent {
  private userService = inject(UserService);
  private toast = inject(ToastService);
  private confirmDialog = inject(ConfirmDialogService);
  private fb = inject(FormBuilder);
  private router = inject(Router);

  // TEMP (Aug 2026) — Delete is hidden from the Users UI per the owner's request:
  // the account will be used day-to-day by a non-technical staff member and an
  // accidental delete is unrecoverable. remove() and the backend endpoint are left
  // completely intact — flip this back to true to restore the button. If/when an
  // Active/Deactivate toggle ships, this switch (and its Orders/Repairs equivalents)
  // can likely go away entirely in favour of that.
  readonly deleteEnabled = false;

  users = signal<User[]>([]);
  totalUsers = signal(0);
  page = signal(1);
  totalPages = signal(1);
  pageSize = signal(10);
  isLoading = signal(true);
  searchTerm = signal('');

  isPanelOpen = signal(false);
  editingUser = signal<User | null>(null);
  isSaving = signal(false);

  form = this.fb.group({
    name: ['', Validators.required],
    email: [''],
    phone: [''],
    role: ['customer', Validators.required],
    isActive: [true],
    password: [''],
  });

  constructor() {
    this.fetchUsers();

    // Email/password/account-active only matter for roles that actually log
    // into this admin app (staff, admin) — a "customer" record here is just
    // a person from a walk-in order, with no login of their own (there's no
    // customer-facing app yet, POC-stage). Toggling role re-applies the
    // right validators live, so switching from Staff to Customer mid-form
    // doesn't leave a hidden, still-required Email field blocking Save.
    this.form.controls.role.valueChanges.subscribe((role) => {
      this.applyRoleValidators(role);
    });
  }

  isLoginRole(role: string | null | undefined): boolean {
    return role === 'staff' || role === 'admin';
  }

  private applyRoleValidators(role: string | null | undefined): void {
    const emailCtrl = this.form.controls.email;
    const passwordCtrl = this.form.controls.password;

    if (this.isLoginRole(role)) {
      emailCtrl.setValidators([Validators.required, Validators.email]);
      // Password is required when creating a new login account, optional
      // when editing one (blank = leave the existing password unchanged).
      passwordCtrl.setValidators(
        this.editingUser() ? [] : [Validators.required],
      );
    } else {
      emailCtrl.clearValidators();
      passwordCtrl.clearValidators();
    }
    emailCtrl.updateValueAndValidity();
    passwordCtrl.updateValueAndValidity();
  }

  fetchUsers(): void {
    this.isLoading.set(true);
    this.userService
      .list({ search: this.searchTerm(), page: this.page(), limit: this.pageSize() })
      .subscribe({
        next: (res) => {
          this.users.set(res.users || []);
          this.totalUsers.set(res.total);
          this.totalPages.set(res.pages || 1);
          this.isLoading.set(false);
        },
        error: () => {
          this.isLoading.set(false);
          this.toast.error('Could not load users');
        },
      });
  }

  onSearchChange(value: string): void {
    this.searchTerm.set(value);
    this.page.set(1); // a new search always starts back at page 1
    this.fetchUsers();
  }

  goToPage(page: number): void {
    this.page.set(page);
    this.fetchUsers();
  }

  onPageSizeChange(size: number): void {
    this.pageSize.set(size);
    this.page.set(1);
    this.fetchUsers();
  }

  // The order-count badge is a shortcut to "show me this customer's orders"
  // — reuses Orders' existing search box (it already matches phone number)
  // via a query param, rather than needing a new customer-id filter on the
  // backend. Guarded on phone since that's what Orders actually searches by.
  viewOrdersFor(user: User): void {
    if (!user.phone) return;
    this.router.navigate(['/admin-orders'], {
      queryParams: { search: user.phone },
    });
  }

  openCreatePanel(): void {
    this.editingUser.set(null);
    this.form.reset({
      name: '',
      email: '',
      phone: '',
      role: 'customer',
      isActive: true,
      password: '',
    });
    this.applyRoleValidators('customer');
    this.isPanelOpen.set(true);
  }

  openEditPanel(user: User): void {
    this.editingUser.set(user);
    this.form.reset({
      name: user.name,
      email: user.email,
      phone: user.phone || '',
      role: user.role,
      isActive: user.isActive,
      password: '',
    });
    this.applyRoleValidators(user.role);
    this.isPanelOpen.set(true);
  }

  closePanel(): void {
    this.isPanelOpen.set(false);
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    const editing = this.editingUser();
    this.isSaving.set(true);

    const payload: any = {
      name: value.name,
      phone: value.phone || undefined,
      role: value.role,
    };
    // Only a login role (staff/admin) has a real email/password/active-status
    // to save — a customer record here has none of those (see isLoginRole).
    if (this.isLoginRole(value.role)) {
      payload.email = value.email;
      payload.isActive = value.isActive;
      if (value.password) payload.password = value.password;
    }

    const request = editing
      ? this.userService.update(editing._id, payload)
      : this.userService.create(payload);

    request.subscribe({
      next: () => {
        this.toast.success(editing ? 'User updated' : 'User created');
        this.isSaving.set(false);
        this.isPanelOpen.set(false);
        this.fetchUsers();
      },
      error: (err) => {
        this.isSaving.set(false);
        this.toast.error(err?.error?.message || 'Could not save user');
      },
    });
  }

  async remove(user: User): Promise<void> {
    const confirmed = await this.confirmDialog.confirm({
      title: 'Delete this user?',
      message: `Delete ${user.name}? This cannot be undone.`,
      confirmText: 'Delete',
      danger: true,
    });
    if (!confirmed) return;

    this.userService.remove(user._id).subscribe({
      next: () => {
        this.toast.success('User deleted');
        this.fetchUsers();
      },
      error: (err) =>
        this.toast.error(err?.error?.message || 'Could not delete user'),
    });
  }
}
