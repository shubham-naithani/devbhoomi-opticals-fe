import { Component, inject, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { InventoryService } from '../../core/services/inventory.service';
import { ToastService } from '../../core/services/toast.service';
import { AuthService } from '../../core/services/auth.service';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';
import { PaginationComponent } from '../../shared/components/pagination/pagination.component';

import {
  Article,
  InventoryItem,
  describeArticle,
  priceRange,
  totalStock,
} from '../../core/models/inventory.model';
import { DatePipe } from '@angular/common';

const PAGE_SIZE = 10;

@Component({
  selector: 'app-inventory',
  standalone: true,
  imports: [ReactiveFormsModule, FormsModule, DatePipe, PaginationComponent ],
  templateUrl: './inventory.component.html',
  styleUrl: './inventory.component.scss',
})
export class InventoryComponent {
  private inventoryService = inject(InventoryService);
  private toast = inject(ToastService);
  private confirmDialog = inject(ConfirmDialogService);
  private fb = inject(FormBuilder);
  auth = inject(AuthService);

  private readonly MRP_MARGIN = 1.25;
  private readonly MSP_MARGIN = 1.4;

  private round2(n: number): number {
    return Math.round(n * 100) / 100;
  }

  // expose helpers to the template
  describeArticle = describeArticle;
  priceRange = priceRange;
  totalStock = totalStock;

  products = signal<InventoryItem[]>([]);
  totalItems = signal(0);
  page = signal(1);
  totalPages = signal(1);
  isLoading = signal(true);
  searchTerm = signal('');

  categoryFilter = signal('');
  genderFilter = signal('');
  frameShapeFilter = signal('');

  allBrands = signal<string[]>([]);
  brandSuggestions = signal<string[]>([]);
  showBrandSuggestions = signal(false);

  // ---- Product create/edit panel -----------------------------------------
  isProductPanelOpen = signal(false);
  editingProduct = signal<InventoryItem | null>(null); // non-null = editing product-level fields only
  isCreatingNew = signal(false); // true = create mode (product + first article together)
  isSavingProduct = signal(false);

  productForm = this.fb.group({
    name: ['', Validators.required],
    brand: [''],
    category: ['eyeglasses', Validators.required],
    frameType: [''],
    frameShape: [''],
    gender: ['unisex', Validators.required],
    description: [''],
    isActive: [true],
  });

  // First-article fields, only used in create mode
  articleForm = this.fb.group({
    color: [''],
    lensTint: [''],
    size: [''],
    costPrice: [null as number | null, [Validators.required, Validators.min(0)]],
    price: [{ value: 0, disabled: true }], // MRP — read-only, server-derived
    mspPrice: [{ value: null as number | null, disabled: true }], // auto by default
    isMspManual: [false],
    stock: [0, [Validators.required, Validators.min(0)]],
    isActive: [true],
  });
  existingImages = signal<string[]>([]);
  pendingFiles = signal<File[]>([]);
  pendingPreviews = signal<string[]>([]);
  isUploadingImages = signal(false);

  // ---- Variant (articles) management panel -------------------------------
  managingProduct = signal<InventoryItem | null>(null);
  isArticleFormOpen = signal(false);
  editingArticle = signal<Article | null>(null);
  isSavingArticle = signal(false);
  isNewBrandName = signal(false);

  constructor() {
    this.fetchProducts();
    this.loadBrands();

    this.productForm.controls.brand.valueChanges.subscribe((value) => {
      const v = (value || '').trim().toLowerCase();
      const list = this.allBrands();
      const filtered = v ? list.filter((b) => b.toLowerCase().includes(v)).slice(0, 8) : list.slice(0, 8);
      this.brandSuggestions.set(filtered);
      // Only offer "add new" when NOTHING matches at all — a partial match
      // (e.g. typing "te" while "TestBrandXYZ" exists) should just show that
      // suggestion, not also invite creating a redundant near-duplicate.
      this.isNewBrandName.set(v.length > 0 && filtered.length === 0);
    });

    // Client-side preview only, purely for immediate feedback while typing —
    // the server response after save is always the real source of truth for
    // the saved price/mspPrice values (see `saveArticle`, which refreshes
    // from `res.item`).
    this.articleForm.controls.costPrice.valueChanges.subscribe((cost) => {
      const numCost = Number(cost) || 0;
      this.articleForm.controls.price.setValue(this.round2(numCost * this.MRP_MARGIN), { emitEvent: false });
      if (!this.articleForm.controls.isMspManual.value) {
        this.articleForm.controls.mspPrice.setValue(this.round2(numCost * this.MSP_MARGIN), { emitEvent: false });
      }
    });

    this.articleForm.controls.isMspManual.valueChanges.subscribe((manual) => {
      if (manual) {
        this.articleForm.controls.mspPrice.enable({ emitEvent: false });
      } else {
        const cost = Number(this.articleForm.controls.costPrice.value) || 0;
        this.articleForm.controls.mspPrice.setValue(this.round2(cost * this.MSP_MARGIN), { emitEvent: false });
        this.articleForm.controls.mspPrice.disable({ emitEvent: false });
      }
    });
  }

  fetchProducts(): void {
    this.isLoading.set(true);
    this.inventoryService
      .list({
        search: this.searchTerm(),
        category: this.categoryFilter() || undefined,
        gender: this.genderFilter() || undefined,
        frameShape: this.frameShapeFilter() || undefined,
        page: this.page(),
        limit: PAGE_SIZE,
      })
      .subscribe({
        next: (res) => {
          this.products.set(res.items || []);
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

  onFilterChange(): void {
    this.page.set(1);
    this.fetchProducts();
  }

  addNewBrand(): void {
    const name = (this.productForm.controls.brand.value || '').trim();
    if (!name) return;

    this.inventoryService.addBrand(name).subscribe({
      next: () => {
        this.allBrands.update((list) => [...list, name].sort());
        this.showBrandSuggestions.set(false);
        this.toast.success(`"${name}" added as a new brand`);
        // Auto-fill won't fire for a brand-new name (no products yet) — nothing to fetch.
      },
      error: (err) => this.toast.error(err?.error?.message || 'Could not add brand'),
    });
  }

  private loadBrands(): void {
    this.inventoryService.brands().subscribe({
      next: (res) => this.allBrands.set(res.brands || []),
      error: () => {}, // non-critical — autocomplete just won't have suggestions
    });
  }

  selectBrand(brand: string): void {
  this.productForm.controls.brand.setValue(brand);
  this.showBrandSuggestions.set(false);

  if (!this.isCreatingNew()) return; // don't auto-fill over an existing product's real data

  this.inventoryService.brandDefaults(brand).subscribe({
      next: (res) => {
        if (!res.defaults) return;
        const { category, frameType, gender } = res.defaults;
        if (category) this.productForm.controls.category.setValue(category);
        if (frameType) this.productForm.controls.frameType.setValue(frameType);
        if (gender) this.productForm.controls.gender.setValue(gender);
      },
      error: () => {},
    });
  }

  hideBrandSuggestions(): void {
    // Delay so a suggestion's (mousedown) fires before blur hides the list —
    // otherwise the click never registers because the list disappears first.
    setTimeout(() => this.showBrandSuggestions.set(false), 150);
  }

  onSearchChange(value: string): void {
    this.searchTerm.set(value);
    this.page.set(1);
    this.fetchProducts();
  }

  goToPage(page: number): void {
    this.page.set(page);
    this.fetchProducts();
  }

  // ---- Product panel (create / edit product-level fields) ----------------

  openCreatePanel(): void {
    this.isCreatingNew.set(true);
    this.editingProduct.set(null);
    this.productForm.reset({
      name: '', brand: '', category: 'eyeglasses', frameType: '', frameShape: '', gender: 'unisex',
      description: '', isActive: true,
    });
    this.articleForm.reset({
      color: '', lensTint: '', size: '', costPrice: null, price: 0, mspPrice: null, isMspManual: false, stock: 0, isActive: true,
    });
    this.clearImageState();
    this.isProductPanelOpen.set(true);
  }

  openEditProductPanel(product: InventoryItem): void {
    this.isCreatingNew.set(false);
    this.editingProduct.set(product);
    this.productForm.reset({
      name: product.name,
      brand: product.brand || '',
      category: product.category,
      frameType: product.frameType || '',
      frameShape: product.frameShape || '',
      gender: product.gender,
      description: product.description || '',
      isActive: product.isActive,
    });
    this.isProductPanelOpen.set(true);
  }

  closeProductPanel(): void {
    this.isProductPanelOpen.set(false);
    this.clearImageState();
  }

    saveProduct(): void {
    if (this.productForm.invalid || (this.isCreatingNew() && this.articleForm.invalid)) {
      this.productForm.markAllAsTouched();
      this.articleForm.markAllAsTouched();
      this.toast.error('Please fill in all required fields');
      return;
    }

    this.isSavingProduct.set(true);
    const productValue = this.productForm.getRawValue();

    if (!this.isCreatingNew()) {
      // Editing product-level fields only
      const editing = this.editingProduct()!;
      this.inventoryService.updateProduct(editing._id, productValue as any).subscribe({
        next: () => {
          this.toast.success('Product updated');
          this.isSavingProduct.set(false);
          this.isProductPanelOpen.set(false);
          this.fetchProducts();
        },
        error: (err) => {
          this.isSavingProduct.set(false);
          this.toast.error(err?.error?.message || 'Could not update product');
        },
      });
      return;
    }

    // Creating: upload any picked photos first, then create product + first article together
    const uploadStep = this.pendingFiles().length
      ? (this.isUploadingImages.set(true), this.inventoryService.uploadImages(this.pendingFiles()))
      : null;

    const proceed = (imageUrls: string[]) => {
      this.isUploadingImages.set(false);
      const articleValue = this.articleForm.getRawValue();

      this.inventoryService
        .createProduct({ ...productValue, article: { ...articleValue, images: imageUrls } } as any)
        .subscribe({
          next: () => {
            this.toast.success('Product added');
            this.isSavingProduct.set(false);
            this.isProductPanelOpen.set(false);
            this.clearImageState();
            this.fetchProducts();
          },
          error: (err) => {
            this.isSavingProduct.set(false);
            this.toast.error(err?.error?.message || 'Could not create product');
          },
        });
    };

    if (uploadStep) {
      uploadStep.subscribe({
        next: (res) => proceed(res.urls),
        error: (err) => {
          this.isSavingProduct.set(false);
          this.isUploadingImages.set(false);
          this.toast.error(err?.error?.message || 'Could not upload images');
        },
      });
    } else {
      proceed([]);
    }
  }

  async deleteProduct(product: InventoryItem): Promise<void> {
    const confirmed = await this.confirmDialog.confirm({
      title: 'Delete this product?',
      message: `Delete "${product.name}" and all ${product.articles.length} of its variant(s)? This cannot be undone.`,
      confirmText: 'Delete',
      danger: true,
    });
    if (!confirmed) return;

    this.inventoryService.deleteProduct(product._id).subscribe({
      next: () => {
        this.toast.success('Product deleted');
        this.fetchProducts();
      },
      error: (err) => this.toast.error(err?.error?.message || 'Could not delete product'),
    });
  }

  // ---- Image picker (shared by create-product and article forms) --------

  onFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = input.files ? Array.from(input.files) : [];
    if (files.length === 0) return;

    const totalCount = this.existingImages().length + this.pendingFiles().length + files.length;
    if (totalCount > 6) {
      this.toast.error('Maximum 6 images per variant');
      return;
    }

    this.pendingFiles.update((list) => [...list, ...files]);
    this.pendingPreviews.update((list) => [...list, ...files.map((f) => URL.createObjectURL(f))]);
    input.value = '';
  }

  removeExistingImage(url: string): void {
    this.existingImages.update((list) => list.filter((u) => u !== url));
  }

  removePendingFile(index: number): void {
    URL.revokeObjectURL(this.pendingPreviews()[index]);
    this.pendingFiles.update((list) => list.filter((_, i) => i !== index));
    this.pendingPreviews.update((list) => list.filter((_, i) => i !== index));
  }

  private clearImageState(): void {
    this.pendingPreviews().forEach((url) => URL.revokeObjectURL(url));
    this.pendingFiles.set([]);
    this.pendingPreviews.set([]);
    this.existingImages.set([]);
  }

  // ---- Variant (articles) management panel -------------------------------

  openManagePanel(product: InventoryItem): void {
    this.managingProduct.set(product);
    this.isArticleFormOpen.set(false);
  }

  closeManagePanel(): void {
    this.managingProduct.set(null);
    this.isArticleFormOpen.set(false);
  }

  openAddArticleForm(): void {
    this.editingArticle.set(null);
    this.articleForm.reset({ color: '', lensTint: '', size: '', costPrice: null, price: 0, mspPrice: null, isMspManual: false, stock: 0, isActive: true });
    this.clearImageState();
    this.isArticleFormOpen.set(true);
  }

  openEditArticleForm(article: Article): void {
    this.editingArticle.set(article);
    this.articleForm.reset({
      color: article.color || '',
      lensTint: article.lensTint || '',
      size: article.size || '',
      costPrice: article.costPrice ?? null,
      price: article.price,
      mspPrice: article.mspPrice ?? null,
      isMspManual: article.isMspManual,
      stock: article.stock,
      isActive: article.isActive,
    });
    this.existingImages.set(article.images || []);
    this.pendingFiles.set([]);
    this.pendingPreviews.set([]);
    this.isArticleFormOpen.set(true);
  }

  saveArticle(): void {
    if (this.articleForm.invalid) {
      this.articleForm.markAllAsTouched();
      this.toast.error('Cost price is required before saving this variant');
      return;
    }

    const product = this.managingProduct();
    if (!product) return;

    this.isSavingArticle.set(true);

    const uploadStep = this.pendingFiles().length
      ? (this.isUploadingImages.set(true), this.inventoryService.uploadImages(this.pendingFiles()))
      : null;

    const proceed = (newUrls: string[]) => {
      this.isUploadingImages.set(false);
      const { price, ...rawValue } = this.articleForm.getRawValue();
      const images = [...this.existingImages(), ...newUrls];
      const editing = this.editingArticle();

      // Only send mspPrice when it's an intentional manual override — otherwise
      // let the backend derive it fresh from cost, rather than sending a
      // client-computed preview as if it were a deliberate value.
      const payload = rawValue.isMspManual ? rawValue : { ...rawValue, mspPrice: undefined };

      const request = editing
        ? this.inventoryService.updateArticle(product._id, editing._id, { ...payload, images } as any)
        : this.inventoryService.addArticle(product._id, { ...payload, images } as any);

      request.subscribe({
        next: (res) => {
          this.toast.success(editing ? 'Variant updated' : 'Variant added');
          this.isSavingArticle.set(false);
          this.isArticleFormOpen.set(false);
          this.clearImageState();
          this.managingProduct.set(res.item);
          this.fetchProducts();
        },
        error: (err) => {
          this.isSavingArticle.set(false);
          this.toast.error(err?.error?.message || 'Could not save variant');
        },
      });
    };

    if (uploadStep) {
      uploadStep.subscribe({
        next: (res) => proceed(res.urls),
        error: (err) => {
          this.isSavingArticle.set(false);
          this.isUploadingImages.set(false);
          this.toast.error(err?.error?.message || 'Could not upload images');
        },
      });
    } else {
      proceed([]);
    }
  }

  async deleteArticle(article: Article): Promise<void> {
    const product = this.managingProduct();
    if (!product) return;

    const confirmed = await this.confirmDialog.confirm({
      title: 'Delete this variant?',
      message: `Delete the "${describeArticle(article)}" variant? This cannot be undone.`,
      confirmText: 'Delete',
      danger: true,
    });
    if (!confirmed) return;

    this.inventoryService.deleteArticle(product._id, article._id).subscribe({
      next: (res) => {
        this.toast.success('Variant deleted');
        this.managingProduct.set(res.item);
        this.fetchProducts();
      },
      error: (err) => this.toast.error(err?.error?.message || 'Could not delete variant'),
    });
  }
}
