import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { InventoryService } from '../../core/services/inventory.service';
import { ToastService } from '../../core/services/toast.service';
import { AuthService } from '../../core/services/auth.service';
import { InventoryItem } from '../../core/models/inventory.model';

@Component({
  selector: 'app-inventory',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './inventory.component.html',
  styleUrl: './inventory.component.scss',
})
export class InventoryComponent {
  private inventoryService = inject(InventoryService);
  private toast = inject(ToastService);
  private fb = inject(FormBuilder);
  auth = inject(AuthService);

  items = signal<InventoryItem[]>([]);
  totalItems = signal(0);
  isLoading = signal(true);
  searchTerm = signal('');

  isPanelOpen = signal(false);
  editingItem = signal<InventoryItem | null>(null);
  isSaving = signal(false);

  form = this.fb.group({
    name: ['', Validators.required],
    brand: [''],
    category: ['eyeglasses', Validators.required],
    frameType: [''],
    gender: ['unisex', Validators.required],
    price: [0, [Validators.required, Validators.min(0)]],
    stock: [0, [Validators.required, Validators.min(0)]],
    sku: [''],
    imageUrl: [''],
    description: [''],
    isActive: [true],
  });

  constructor() {
    this.fetchItems();
  }

  fetchItems(): void {
    this.isLoading.set(true);
    this.inventoryService.list({ search: this.searchTerm(), limit: 50 }).subscribe({
      next: (res) => {
        this.items.set(res.items || []);
        this.totalItems.set(res.total);
        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
        this.toast.error('Could not load inventory');
      },
    });
  }

  onSearchChange(value: string): void {
    this.searchTerm.set(value);
    this.fetchItems();
  }

  openCreatePanel(): void {
    this.editingItem.set(null);
    this.form.reset({
      name: '', brand: '', category: 'eyeglasses', frameType: '', gender: 'unisex',
      price: 0, stock: 0, sku: '', imageUrl: '', description: '', isActive: true,
    });
    this.isPanelOpen.set(true);
  }

  openEditPanel(item: InventoryItem): void {
    this.editingItem.set(item);
    this.form.reset({
      name: item.name,
      brand: item.brand || '',
      category: item.category,
      frameType: item.frameType || '',
      gender: item.gender,
      price: item.price,
      stock: item.stock,
      sku: item.sku || '',
      imageUrl: item.imageUrl || '',
      description: item.description || '',
      isActive: item.isActive,
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
    const editing = this.editingItem();
    this.isSaving.set(true);

    const request = editing
      ? this.inventoryService.update(editing._id, value as any)
      : this.inventoryService.create(value as any);

    request.subscribe({
      next: () => {
        this.toast.success(editing ? 'Item updated' : 'Item added');
        this.isSaving.set(false);
        this.isPanelOpen.set(false);
        this.fetchItems();
      },
      error: (err) => {
        this.isSaving.set(false);
        this.toast.error(err?.error?.message || 'Could not save item');
      },
    });
  }

  remove(item: InventoryItem): void {
    if (!confirm(`Delete "${item.name}"? This cannot be undone.`)) return;

    this.inventoryService.remove(item._id).subscribe({
      next: () => {
        this.toast.success('Item deleted');
        this.fetchItems();
      },
      error: (err) => this.toast.error(err?.error?.message || 'Could not delete item'),
    });
  }
}
