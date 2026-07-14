import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { UserService } from '../../core/services/user.service';
import { ToastService } from '../../core/services/toast.service';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';
import { PaginationComponent } from '../../shared/components/pagination/pagination.component';
import { User } from '../../core/models/user.model';

const PAGE_SIZE = 10;

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

  users = signal<User[]>([]);
  totalUsers = signal(0);
  page = signal(1);
  totalPages = signal(1);
  isLoading = signal(true);
  searchTerm = signal('');

  isPanelOpen = signal(false);
  editingUser = signal<User | null>(null);
  isSaving = signal(false);

  form = this.fb.group({
    name: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    phone: [''],
    role: ['customer', Validators.required],
    isActive: [true],
    password: [''],
  });

  constructor() {
    this.fetchUsers();
  }

  fetchUsers(): void {
    this.isLoading.set(true);
    this.userService.list({ search: this.searchTerm(), page: this.page(), limit: PAGE_SIZE }).subscribe({
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

  openCreatePanel(): void {
    this.editingUser.set(null);
    this.form.reset({ name: '', email: '', phone: '', role: 'customer', isActive: true, password: '' });
    this.form.get('password')?.addValidators(Validators.required);
    this.form.get('password')?.updateValueAndValidity();
    this.isPanelOpen.set(true);
  }

  openEditPanel(user: User): void {
    this.editingUser.set(user);
    this.form.get('password')?.removeValidators(Validators.required);
    this.form.get('password')?.updateValueAndValidity();
    this.form.reset({
      name: user.name,
      email: user.email,
      phone: user.phone || '',
      role: user.role,
      isActive: user.isActive,
      password: '',
    });
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
      email: value.email,
      phone: value.phone || undefined,
      role: value.role,
      isActive: value.isActive,
    };
    if (value.password) payload.password = value.password;

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
      error: (err) => this.toast.error(err?.error?.message || 'Could not delete user'),
    });
  }
}
