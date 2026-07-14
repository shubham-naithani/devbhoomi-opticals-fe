import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { InventoryService } from '../../core/services/inventory.service';
import { ToastService } from '../../core/services/toast.service';
import { AuthService } from '../../core/services/auth.service';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';
import { PaginationComponent } from '../../shared/components/pagination/pagination.component';
import { InventoryItem } from '../../core/models/inventory.model';

const PAGE_SIZE = 10;

@Component({
  selector: 'app-inventory',
  standalone: true,
  imports: [ReactiveFormsModule, PaginationComponent],
  templateUrl: './inventory.component.html',
  styleUrl: './inventory.component.scss',
})
export class InventoryComponent {
  private inventoryService = inject(InventoryService);
  private toast = inject(ToastService);
  private confirmDialog = inject(ConfirmDialogService);
  private fb = inject(FormBuilder);
  auth = inject(AuthService);

  items = signal<InventoryItem[]>([]);
  totalItems = signal(0);
  page = signal(1);
  totalPages = signal(1);
  isLoading = signal(true);
  searchTerm = signal('');

  isPanelOpen = signal(false);
  editingItem = signal<InventoryItem | null>(null);
  isSaving = signal(false);

  // Images: existing (already-uploaded URLs, kept on edit) + newly picked
  // local files (not yet uploaded — previewed via object URLs, uploaded only
  // when the form is actually saved).
  existingImages = signal<string[]>([]);
  pendingFiles = signal<File[]>([]);
  pendingPreviews = signal<string[]>([]);
  isUploadingImages = signal(false);

  form = this.fb.group({
    name: ['', Validators.required],
    brand: [''],
    category: ['eyeglasses', Validators.required],
    frameType: [''],
    frameShape: [''],
    gender: ['unisex', Validators.required],
    costPrice: [null as number | null],
    price: [0, [Validators.required, Validators.min(0)]],
    stock: [0, [Validators.required, Validators.min(0)]],
    description: [''],
    isActive: [true],
  });

  constructor() {
    this.fetchItems();
  }

  fetchItems(): void {
    this.isLoading.set(true);
    this.inventoryService.list({ search: this.searchTerm(), page: this.page(), limit: PAGE_SIZE }).subscribe({
      next: (res) => {
        this.items.set(res.items || []);
        this.totalItems.set(res.total);
        this.totalPages.set(res.pages || 1);
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
    this.page.set(1);
    this.fetchItems();
  }

  goToPage(page: number): void {
    this.page.set(page);
    this.fetchItems();
  }

  openCreatePanel(): void {
    this.editingItem.set(null);
    this.form.reset({
      name: '', brand: '', category: 'eyeglasses', frameType: '', frameShape: '', gender: 'unisex',
      costPrice: null, price: 0, stock: 0, description: '', isActive: true,
    });
    this.existingImages.set([]);
    this.clearPendingFiles();
    this.isPanelOpen.set(true);
  }

  openEditPanel(item: InventoryItem): void {
    this.editingItem.set(item);
    this.form.reset({
      name: item.name,
      brand: item.brand || '',
      category: item.category,
      frameType: item.frameType || '',
      frameShape: item.frameShape || '',
      gender: item.gender,
      costPrice: item.costPrice ?? null,
      price: item.price,
      stock: item.stock,
      description: item.description || '',
      isActive: item.isActive,
    });
    this.existingImages.set(item.images || []);
    this.clearPendingFiles();
    this.isPanelOpen.set(true);
  }

  closePanel(): void {
    this.isPanelOpen.set(false);
    this.clearPendingFiles();
  }

  onFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = input.files ? Array.from(input.files) : [];
    if (files.length === 0) return;

    const totalCount = this.existingImages().length + this.pendingFiles().length + files.length;
    if (totalCount > 6) {
      this.toast.error('Maximum 6 images per item');
      return;
    }

    this.pendingFiles.update((list) => [...list, ...files]);
    this.pendingPreviews.update((list) => [...list, ...files.map((f) => URL.createObjectURL(f))]);
    input.value = ''; // allow re-selecting the same file later if removed
  }

  removeExistingImage(url: string): void {
    this.existingImages.update((list) => list.filter((u) => u !== url));
  }

  removePendingFile(index: number): void {
    URL.revokeObjectURL(this.pendingPreviews()[index]);
    this.pendingFiles.update((list) => list.filter((_, i) => i !== index));
    this.pendingPreviews.update((list) => list.filter((_, i) => i !== index));
  }

  private clearPendingFiles(): void {
    this.pendingPreviews().forEach((url) => URL.revokeObjectURL(url));
    this.pendingFiles.set([]);
    this.pendingPreviews.set([]);
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.isSaving.set(true);

    // Upload any newly picked files first (if there are none, this resolves
    // immediately with an empty array), then save the item with the combined
    // image list — existing (kept) URLs plus the freshly uploaded ones.
    const uploadStep = this.pendingFiles().length
      ? (this.isUploadingImages.set(true), this.inventoryService.uploadImages(this.pendingFiles()))
      : null;

    const proceedWithSave = (newUrls: string[]) => {
      this.isUploadingImages.set(false);
      const value = this.form.getRawValue();
      const editing = this.editingItem();
      const images = [...this.existingImages(), ...newUrls];

      const payload = { ...value, images };

      const request = editing
        ? this.inventoryService.update(editing._id, payload as any)
        : this.inventoryService.create(payload as any);

      request.subscribe({
        next: () => {
          this.toast.success(editing ? 'Item updated' : 'Item added');
          this.isSaving.set(false);
          this.isPanelOpen.set(false);
          this.clearPendingFiles();
          this.fetchItems();
        },
        error: (err) => {
          this.isSaving.set(false);
          this.toast.error(err?.error?.message || 'Could not save item');
        },
      });
    };

    if (uploadStep) {
      uploadStep.subscribe({
        next: (res) => proceedWithSave(res.urls),
        error: (err) => {
          this.isSaving.set(false);
          this.isUploadingImages.set(false);
          this.toast.error(err?.error?.message || 'Could not upload images');
        },
      });
    } else {
      proceedWithSave([]);
    }
  }

  async remove(item: InventoryItem): Promise<void> {
    const confirmed = await this.confirmDialog.confirm({
      title: 'Delete this item?',
      message: `Delete "${item.name}"? This cannot be undone.`,
      confirmText: 'Delete',
      danger: true,
    });
    if (!confirmed) return;

    this.inventoryService.remove(item._id).subscribe({
      next: () => {
        this.toast.success('Item deleted');
        this.fetchItems();
      },
      error: (err) => this.toast.error(err?.error?.message || 'Could not delete item'),
    });
  }
}
