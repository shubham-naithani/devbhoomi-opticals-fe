import { Component, inject, signal } from '@angular/core';
import {
  FormBuilder,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { InventoryService } from '../../core/services/inventory.service';
import { ToastService } from '../../core/services/toast.service';
import { AuthService } from '../../core/services/auth.service';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';
import { PaginationComponent } from '../../shared/components/pagination/pagination.component';
import JsBarcode from 'jsbarcode';
import {
  Article,
  InventoryItem,
  describeArticle,
  priceRange,
  totalStock,
} from '../../core/models/inventory.model';
import { DatePipe } from '@angular/common';

const PAGE_SIZE = 10;

import * as qz from 'qz-tray';
type PrintableArticle = { product: any; article: any };
@Component({
  selector: 'app-inventory',
  standalone: true,
  imports: [ReactiveFormsModule, FormsModule, DatePipe, PaginationComponent],
  templateUrl: './inventory.component.html',
  styleUrl: './inventory.component.scss',
})
export class InventoryComponent {
  private inventoryService = inject(InventoryService);
  private toast = inject(ToastService);
  private confirmDialog = inject(ConfirmDialogService);
  private fb = inject(FormBuilder);
  auth = inject(AuthService);

  private readonly MRP_MARGIN = 1.4;
  private readonly MSP_MARGIN = 1.25;

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

  selectedIds = signal<Set<string>>(new Set());

  originalStock = signal<number | null>(null);
  stockAdjustmentReason = signal('');

  printLabelMode = signal<'box' | 'frame'>('box');
  bulkPrintChooserOpen = signal(false);

  // ---- Frame-tag calibration ---------------------------------------------
  frameTextZoneLengthMm = signal(31); // zone 1: brand/product/variant text
  frameCutGapMm = signal(2); // blank buffer straddling the perforation (1mm each side)
  frameBarcodeZoneLengthMm = signal(31); // zone 2: barcode
  frameHeadTotalLengthMm = signal(64); // total length of the printable head/pill (measured: 6.4cm)
  frameHeadAtLeadingEdge = signal(true); // true = the head sits at the leading edge as the tag feeds through

  frameSingleLaneIndex = signal(1);
  frameLaneGapMm = signal(1.5);
  frameBarcodeNudgeMm = signal(0);

  frameTextNudgeMm = signal(0);

  private readonly FRAME_LANES = 3;

  // ---- Product create/edit panel -----------------------------------------
  isProductPanelOpen = signal(false);
  editingProduct = signal<InventoryItem | null>(null); // non-null = editing product-level fields only
  isCreatingNew = signal(false); // true = create mode (product + first article together)
  isSavingProduct = signal(false);
  printingArticle = signal<{ product: InventoryItem; article: Article } | null>(
    null,
  );

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
    costPrice: [
      null as number | null,
      [Validators.required, Validators.min(0)],
    ],
    price: [null as number | null], // MRP — EDITABLE
    mspPrice: [{ value: null as number | null, disabled: true }],
    isMrpManual: [false],
    isMspManual: [false],
    stock: [0, [Validators.required, Validators.min(0)]],
    lowStockThreshold: [null as number | null, [Validators.min(0)]],
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
      const filtered = v
        ? list.filter((b) => b.toLowerCase().includes(v)).slice(0, 8)
        : list.slice(0, 8);
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
      if (!this.articleForm.controls.isMspManual.value) {
        this.articleForm.controls.mspPrice.setValue(
          this.round2(numCost * this.MSP_MARGIN),
          { emitEvent: false },
        );
      }
      if (!this.articleForm.controls.isMrpManual.value) {
        this.articleForm.controls.price.setValue(
          this.round2(numCost * this.MRP_MARGIN),
          { emitEvent: false },
        );
      }
    });

    this.articleForm.controls.isMrpManual.valueChanges.subscribe((manual) => {
      if (manual) {
        this.articleForm.controls.price.enable({ emitEvent: false });
      } else {
        const cost = Number(this.articleForm.controls.costPrice.value) || 0;
        this.articleForm.controls.price.setValue(
          this.round2(cost * this.MRP_MARGIN),
          { emitEvent: false },
        );
        this.articleForm.controls.price.disable({ emitEvent: false });
      }
    });

    this.articleForm.controls.isMspManual.valueChanges.subscribe((manual) => {
      if (manual) {
        this.articleForm.controls.mspPrice.enable({ emitEvent: false });
      } else {
        const cost = Number(this.articleForm.controls.costPrice.value) || 0;
        this.articleForm.controls.mspPrice.setValue(
          this.round2(cost * this.MSP_MARGIN),
          { emitEvent: false },
        );
        this.articleForm.controls.mspPrice.disable({ emitEvent: false });
      }
    });
  }

  isStockChanged(): boolean {
    const orig = this.originalStock();
    if (orig === null) return false; // create mode — not an adjustment
    const current = Number(this.articleForm.controls.stock.value);
    return current !== orig;
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
      error: (err) =>
        this.toast.error(err?.error?.message || 'Could not add brand'),
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
    this.clearSelection();
    this.page.set(page);
    this.fetchProducts();
  }

  // ---- Product panel (create / edit product-level fields) ----------------

  openCreatePanel(): void {
    this.isCreatingNew.set(true);
    this.editingProduct.set(null);
    this.productForm.reset({
      name: '',
      brand: '',
      category: 'eyeglasses',
      frameType: '',
      frameShape: '',
      gender: 'unisex',
      description: '',
      isActive: true,
    });
    this.articleForm.reset({
      color: '',
      lensTint: '',
      size: '',
      costPrice: null,
      price: 0,
      mspPrice: null,
      isMrpManual: false,
      isMspManual: false,
      stock: 0,
      lowStockThreshold: null,
      isActive: true,
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
    if (
      this.productForm.invalid ||
      (this.isCreatingNew() && this.articleForm.invalid)
    ) {
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
      this.inventoryService
        .updateProduct(editing._id, productValue as any)
        .subscribe({
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
      ? (this.isUploadingImages.set(true),
        this.inventoryService.uploadImages(this.pendingFiles()))
      : null;

    const proceed = (imageUrls: string[]) => {
      this.isUploadingImages.set(false);
      const articleValue = this.articleForm.getRawValue();

      this.inventoryService
        .createProduct({
          ...productValue,
          article: { ...articleValue, images: imageUrls },
        } as any)
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
      error: (err) =>
        this.toast.error(err?.error?.message || 'Could not delete product'),
    });
  }

  // ---- Image picker (shared by create-product and article forms) --------

  onFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = input.files ? Array.from(input.files) : [];
    if (files.length === 0) return;

    const totalCount =
      this.existingImages().length + this.pendingFiles().length + files.length;
    if (totalCount > 6) {
      this.toast.error('Maximum 6 images per variant');
      return;
    }

    this.pendingFiles.update((list) => [...list, ...files]);
    this.pendingPreviews.update((list) => [
      ...list,
      ...files.map((f) => URL.createObjectURL(f)),
    ]);
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
    this.originalStock.set(null);
    this.stockAdjustmentReason.set('');
    this.articleForm.reset({
      color: '',
      lensTint: '',
      size: '',
      costPrice: null,
      price: 0,
      mspPrice: null,
      isMrpManual: false,
      isMspManual: false,
      stock: 0,
      lowStockThreshold: null,
      isActive: true,
    });
    this.clearImageState();
    this.isArticleFormOpen.set(true);
  }

  openEditArticleForm(article: Article): void {
    this.editingArticle.set(article);
    this.originalStock.set(article.stock);
    this.stockAdjustmentReason.set('');
    this.articleForm.reset({
      color: article.color || '',
      lensTint: article.lensTint || '',
      size: article.size || '',
      costPrice: article.costPrice ?? null,
      price: article.price,
      mspPrice: article.mspPrice ?? null,
      isMrpManual: article.isMrpManual,
      isMspManual: article.isMspManual,
      stock: article.stock,
      lowStockThreshold: article.lowStockThreshold ?? null,
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

    const editing = this.editingArticle();
    if (
      editing &&
      this.isStockChanged() &&
      !this.stockAdjustmentReason().trim()
    ) {
      this.toast.error('Enter a reason for this stock change');
      return;
    }

    const product = this.managingProduct();
    if (!product) return;

    this.isSavingArticle.set(true);

    const uploadStep = this.pendingFiles().length
      ? (this.isUploadingImages.set(true),
        this.inventoryService.uploadImages(this.pendingFiles()))
      : null;

    const proceed = (newUrls: string[]) => {
      this.isUploadingImages.set(false);

      const rawValue = this.articleForm.getRawValue();
      const images = [...this.existingImages(), ...newUrls];
      const editing = this.editingArticle();

      const payload: any = {
        ...rawValue,
        price: rawValue.isMrpManual ? rawValue.price : undefined,
        mspPrice: rawValue.isMspManual ? rawValue.mspPrice : undefined,
      };

      const request = editing
        ? this.inventoryService.updateArticle(product._id, editing._id, {
            ...payload,
            images,
          } as any)
        : this.inventoryService.addArticle(product._id, {
            ...payload,
            images,
          } as any);

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
      error: (err) =>
        this.toast.error(err?.error?.message || 'Could not delete variant'),
    });
  }

  setPrintLabelMode(mode: 'box' | 'frame'): void {
    this.printLabelMode.set(mode);
  }

  openPrintLabel(product: InventoryItem, article: Article): void {
    if (!article.barcode) {
      this.toast.error('This variant has no barcode yet');
      return;
    }
    this.printLabelMode.set('box');
    this.printingArticle.set({ product, article });
    setTimeout(() => this.renderBarcode(article.barcode!), 0);
  }

  async printLabelDirectly(p: any): Promise<void> {
    if (!p || !p.product || !p.article || !p.article.barcode) {
      this.toast.error('No barcode available to print for this variant');
      return;
    }

    if (!qz.websocket.isActive()) {
      try {
        await qz.websocket.connect();
      } catch (err) {
        console.error('WebSocket connection failure:', err);
        this.toast.error('Could not connect to QZ Tray — is it running?');
        return;
      }
    }

    const mode = this.printLabelMode();

    try {
      if (mode === 'frame') {
        const laneIndex = Math.min(
          Math.max(1, Math.round(this.frameSingleLaneIndex())),
          this.FRAME_LANES,
        ) - 1;
        const row: (PrintableArticle | null)[] = Array(this.FRAME_LANES).fill(null);
        row[laneIndex] = { product: p.product, article: p.article };
        await qz.print(this.getFramePrinterConfig(), [
          { type: 'pixel', format: 'image', data: this.drawFrameRowCanvas(row) },
        ]);
      } else {
        const imageDataUrl = this.drawBoxLabelCanvas(
          'Devbhoomi Optical',
          p.product.name,
          this.describeArticle(p.article),
          p.article.barcode,
        );
        await qz.print(this.getBoxPrinterConfig(), [
          { type: 'pixel', format: 'image', data: imageDataUrl },
        ]);
      }
      this.toast.success('Label printed');
    } catch (err) {
      console.error('Printing layout error:', err);
      this.toast.error('Print failed — check QZ Tray connection');
    }
  }

  private renderBarcode(value: string): void {
    const svg = document.getElementById('label-barcode-svg');
    if (svg) {
      JsBarcode(svg, value, {
        format: 'CODE128',
        width: 1.3,
        height: 28,
        displayValue: true,
        fontSize: 8,
        margin: 2,
      });
    }
  }

  closePrintLabel(): void {
    this.printingArticle.set(null);
  }

  triggerPrint(): void {
    window.print();
  }

  isSelected(id: string): boolean {
    return this.selectedIds().has(id);
  }

  isAllSelected(): boolean {
    const ids = this.products().map((p) => p._id);
    return ids.length > 0 && ids.every((id) => this.selectedIds().has(id));
  }

  toggleSelect(id: string): void {
    this.selectedIds.update((set) => {
      const next = new Set(set);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  toggleSelectAll(): void {
    const ids = this.products().map((p) => p._id);
    this.selectedIds.set(this.isAllSelected() ? new Set() : new Set(ids));
  }

  clearSelection(): void {
    this.selectedIds.set(new Set());
  }

  bulkActivate(active: boolean): void {
    const ids = [...this.selectedIds()];
    if (ids.length === 0) return;

    this.inventoryService.bulkUpdateStatus(ids, active).subscribe({
      next: (res) => {
        this.toast.success(res.message);
        this.clearSelection();
        this.fetchProducts();
      },
      error: (err) =>
        this.toast.error(err?.error?.message || 'Bulk update failed'),
    });
  }

  async bulkDeleteSelected(): Promise<void> {
    const ids = [...this.selectedIds()];
    if (ids.length === 0) return;

    const confirmed = await this.confirmDialog.confirm({
      title: `Delete ${ids.length} product(s)?`,
      message: `This permanently deletes ${ids.length} product(s) and all their variants. This cannot be undone.`,
      confirmText: 'Delete',
      danger: true,
    });
    if (!confirmed) return;

    this.inventoryService.bulkDelete(ids).subscribe({
      next: (res) => {
        this.toast.success(res.message);
        this.clearSelection();
        this.fetchProducts();
      },
      error: (err) =>
        this.toast.error(err?.error?.message || 'Bulk delete failed'),
    });
  }

  openBulkPrintChooser(): void {
    if (this.selectedIds().size === 0) return;
    this.bulkPrintChooserOpen.set(true);
  }

  closeBulkPrintChooser(): void {
    this.bulkPrintChooserOpen.set(false);
  }

  async confirmBulkPrint(mode: 'box' | 'frame'): Promise<void> {
    this.bulkPrintChooserOpen.set(false);
    await this.printSelectedLabels(mode);
  }

  async printSelectedLabels(mode: 'box' | 'frame'): Promise<void> {
    const ids = new Set(this.selectedIds());
    if (ids.size === 0) return;

    const selectedProducts = this.products().filter((p) => ids.has(p._id));
    const printable: PrintableArticle[] = [];
    let skippedNoBarcode = 0;

    for (const product of selectedProducts) {
      for (const article of product.articles) {
        if (article.barcode) {
          printable.push({ product, article });
        } else {
          skippedNoBarcode++;
        }
      }
    }

    if (printable.length === 0) {
      this.toast.error(
        'None of the selected products have a barcoded variant to print',
      );
      return;
    }
    if (skippedNoBarcode > 0) {
      this.toast.error(`${skippedNoBarcode} variant(s) skipped — no barcode`);
    }

    if (!qz.websocket.isActive()) {
      try {
        await qz.websocket.connect();
      } catch (err) {
        console.error('WebSocket connection failure:', err);
        this.toast.error('Could not connect to QZ Tray — is it running?');
        return;
      }
    }

    try {
      if (mode === 'frame') {
        const config = this.getFramePrinterConfig();
        const rows: (PrintableArticle | null)[][] = [];
        for (let i = 0; i < printable.length; i += this.FRAME_LANES) {
          const chunk = printable.slice(i, i + this.FRAME_LANES);
          rows.push([
            ...chunk,
            ...Array(this.FRAME_LANES - chunk.length).fill(null),
          ]);
        }
        const printData = rows.map((row) => ({
          type: 'pixel' as const,
          format: 'image' as const,
          data: this.drawFrameRowCanvas(row),
        }));
        await qz.print(config, printData);
        this.toast.success(
          `Printed ${printable.length} label(s) across ${rows.length} row(s)`,
        );
      } else {
        // Box (square) labels — same fix: one qz.print() call, one page per
        // item, instead of a separate call per item.
        const config = this.getBoxPrinterConfig();
        const printData = printable.map((item) => ({
          type: 'pixel' as const,
          format: 'image' as const,
          data: this.drawBoxLabelCanvas(
            'Devbhoomi Optical',
            item.product.name,
            this.describeArticle(item.article),
            item.article.barcode,
          ),
        }));
        await qz.print(config, printData);
        this.toast.success(`Printed ${printable.length} label(s)`);
      }
      this.clearSelection();
    } catch (err) {
      console.error('Printing layout error:', err);
      this.toast.error('Print failed — check QZ Tray connection');
    }
  }

  private drawBoxLabelCanvas(
    store: string,
    name: string,
    variant: string,
    barcodeValue: string,
  ): string {
    const mmToPx = 8; // ~203 DPI — matches this printer's native resolution
    const width = Math.round(50 * mmToPx);
    const height = Math.round(50 * mmToPx);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = false; // keep barcode bars crisp, not blurred together
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.textAlign = 'center';
    this.paintBoxLabel(ctx, width, height, store, name, variant, barcodeValue);
    return canvas.toDataURL('image/png');
  }

  private drawFrameRowCanvas(items: (PrintableArticle | null)[]): string {
    const mmToPx = 8;
    const laneWidthMm = 15;
    const laneGapMm = this.frameLaneGapMm();
    const tagLengthMm = 100;
    const textZoneLengthMm = this.frameTextZoneLengthMm();
    const cutGapMm = this.frameCutGapMm();
    const barcodeZoneLengthMm = this.frameBarcodeZoneLengthMm();
    const headTotalLengthMm = this.frameHeadTotalLengthMm();
    const headAtStart = this.frameHeadAtLeadingEdge();
    const barcodeNudgePx = Math.round(this.frameBarcodeNudgeMm() * mmToPx);
    const textNudgePx = Math.round(this.frameTextNudgeMm() * mmToPx);

    const laneWidthPx = Math.round(laneWidthMm * mmToPx);
    const laneGapPx = Math.round(laneGapMm * mmToPx);
    const tagLengthPx = Math.round(tagLengthMm * mmToPx);
    const textZoneLengthPx = Math.round(textZoneLengthMm * mmToPx);
    const cutGapPx = Math.round(cutGapMm * mmToPx);
    const barcodeZoneLengthPx = Math.round(barcodeZoneLengthMm * mmToPx);
    const headTotalLengthPx = Math.round(headTotalLengthMm * mmToPx);
    const totalContentLengthPx =
      textZoneLengthPx + cutGapPx + barcodeZoneLengthPx;

    const laneCount = this.FRAME_LANES;
    const physicalWidth = laneCount * laneWidthPx + (laneCount - 1) * laneGapPx;
    const physicalHeight = tagLengthPx;

    const physical = document.createElement('canvas');
    physical.width = physicalWidth;
    physical.height = physicalHeight;
    const pctx = physical.getContext('2d')!;
    pctx.imageSmoothingEnabled = false;
    pctx.fillStyle = '#ffffff';
    pctx.fillRect(0, 0, physicalWidth, physicalHeight);

    const headZoneStartPx = headAtStart
      ? 0
      : physicalHeight - headTotalLengthPx;
    const innerMarginPx = Math.max(
      0,
      (headTotalLengthPx - totalContentLengthPx) / 2,
    );
    const contentStartPx = headZoneStartPx + innerMarginPx;
    const textZoneTopPx = contentStartPx;
    const barcodeZoneTopPx = contentStartPx + textZoneLengthPx + cutGapPx;

    items.forEach((item, i) => {
      if (!item) return;

      const laneX = i * (laneWidthPx + laneGapPx);

      // --- zone 1: brand / product / variant text ---
      const textLogical = document.createElement('canvas');
      textLogical.width = textZoneLengthPx;
      textLogical.height = laneWidthPx;
      const tctx = textLogical.getContext('2d')!;
      tctx.imageSmoothingEnabled = false;
      tctx.fillStyle = '#ffffff';
      tctx.fillRect(0, 0, textZoneLengthPx, laneWidthPx);
      tctx.textAlign = 'center';
      this.paintFrameTextZone(
        tctx,
        textZoneLengthPx,
        laneWidthPx,
        'Devbhoomi Optical',
        item.product.name,
        this.describeArticle(item.article),
      );
      pctx.save();
      pctx.translate(
        laneX + laneWidthPx / 2,
        textZoneTopPx + textZoneLengthPx / 2 + textNudgePx,
      );
      pctx.rotate(Math.PI / 2);
      pctx.drawImage(textLogical, -textZoneLengthPx / 2, -laneWidthPx / 2);
      pctx.restore();

      const bcLogical = this.buildFrameBarcodeZoneCanvas(
        barcodeZoneLengthPx,
        laneWidthPx,
        item.article.barcode,
      );
      const bcLogicalWidth = bcLogical.width;
      pctx.save();
      pctx.translate(
        laneX + laneWidthPx / 2,
        barcodeZoneTopPx + bcLogicalWidth / 2 + barcodeNudgePx,
      );
      pctx.rotate(Math.PI / 2);
      pctx.drawImage(bcLogical, -bcLogicalWidth / 2, -laneWidthPx / 2);
      pctx.restore();
    });

    return physical.toDataURL('image/png');
  }

  private renderBarcodeAtSafeSize(
    barcodeValue: string,
    targetWidthPx: number,
    targetHeightPx: number,
    fontSizePx: number,
  ): HTMLCanvasElement {
    const MIN_MODULE_PX = 2;
    const QUIET_ZONE_MODULES = 10; // CODE128 spec minimum, each side

    const probe = document.createElement('canvas');
    JsBarcode(probe, barcodeValue, {
      format: 'CODE128',
      width: 1,
      height: 10,
      displayValue: false,
      margin: 0,
    });
    const naturalModules = probe.width || 1;

    const totalModulesWithQuietZone = naturalModules + QUIET_ZONE_MODULES * 2;
    const moduleWidthPx = Math.max(
      MIN_MODULE_PX,
      Math.floor(targetWidthPx / totalModulesWithQuietZone),
    );
    const quietZonePx = Math.round(moduleWidthPx * QUIET_ZONE_MODULES);

    const barcodeCanvas = document.createElement('canvas');
    JsBarcode(barcodeCanvas, barcodeValue, {
      format: 'CODE128',
      width: moduleWidthPx,
      height: targetHeightPx,
      displayValue: true,
      fontSize: fontSizePx,
      marginLeft: quietZonePx,
      marginRight: quietZonePx,
      marginTop: 2,
      marginBottom: 2,
    });
    return barcodeCanvas;
  }

  private paintBoxLabel(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    store: string,
    name: string,
    variant: string,
    barcodeValue: string,
  ): void {
    ctx.fillStyle = '#000000';
    const maxTextWidth = width * 0.9;
    this.fitText(ctx, store, width / 2, height * 0.14, maxTextWidth, Math.round(width * 0.045), true);
    this.fitText(ctx, name, width / 2, height * 0.24, maxTextWidth, Math.round(width * 0.05), true);
    this.fitText(ctx, variant, width / 2, height * 0.32, maxTextWidth, Math.round(width * 0.04), false);

    const bcTargetWidth = width * 0.85;
    const bcTargetHeight = Math.round(height * 0.28);
    const barcodeCanvas = this.renderBarcodeAtSafeSize(
      barcodeValue,
      bcTargetWidth,
      bcTargetHeight,
      Math.round(width * 0.035),
    );
    const drawWidth = barcodeCanvas.width;
    const drawHeight = barcodeCanvas.height;
    ctx.drawImage(
      barcodeCanvas,
      (width - drawWidth) / 2,
      height * 0.4,
      drawWidth,
      drawHeight,
    );
  }

  private fitText(
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    maxWidth: number,
    startingFontPx: number,
    bold: boolean,
  ): void {
    let fontPx = startingFontPx;
    const weight = bold ? 'bold ' : '';
    ctx.font = `${weight}${fontPx}px Arial`;
    while (ctx.measureText(text).width > maxWidth && fontPx > 6) {
      fontPx -= 1;
      ctx.font = `${weight}${fontPx}px Arial`;
    }
    ctx.fillText(text, x, y);
  }

  private paintFrameTextZone(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    store: string,
    name: string,
    variant: string,
  ): void {
    const marginY = height * 0.08;
    const usableHeight = height - marginY * 2;
    // Margin on the length axis too — away from BOTH tag edges and, more
    // importantly, away from the scissor-cut boundary at this zone's end.
    const marginX = width * 0.05;
    const maxWidth = width - marginX * 2;
    const textX = width * 0.5;

    ctx.fillStyle = '#000000';
    ctx.textAlign = 'center';
    this.fitText(ctx, store, textX, marginY + usableHeight * 0.2, maxWidth, Math.round(usableHeight * 0.22), true);
    this.fitText(ctx, name, textX, marginY + usableHeight * 0.52, maxWidth, Math.round(usableHeight * 0.26), true);
    this.fitText(ctx, variant, textX, marginY + usableHeight * 0.82, maxWidth, Math.round(usableHeight * 0.2), false);
  }

  private buildFrameBarcodeZoneCanvas(
    width: number,
    height: number,
    barcodeValue: string,
  ): HTMLCanvasElement {
    const marginY = height * 0.08;
    const usableHeight = height - marginY * 2;

    const barcodeCanvas = this.renderBarcodeAtSafeSize(
      barcodeValue,
      width,
      Math.round(usableHeight * 0.75),
      Math.round(usableHeight * 0.18),
    );

    const logicalWidth = Math.max(width, barcodeCanvas.width);
    const logical = document.createElement('canvas');
    logical.width = logicalWidth;
    logical.height = height;
    const ctx = logical.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, logicalWidth, height);

    const drawX = 0; // fixed at the start of this zone — same for every lane
    const drawY = marginY + (usableHeight - barcodeCanvas.height) / 2;
    ctx.drawImage(barcodeCanvas, drawX, drawY);
    return logical;
  }

  private getBoxPrinterConfig() {
    return qz.configs.create('DP27 Label Printer', {
      size: { width: 50, height: 50 },
      units: 'mm',
    });
  }

  private getFramePrinterConfig() {
    const laneCount = this.FRAME_LANES;
    const laneWidthMm = 15; // measured: each lane/tag is 1.5cm wide
    const laneGapMm = this.frameLaneGapMm();
    const width = laneCount * laneWidthMm + (laneCount - 1) * laneGapMm;
    return qz.configs.create('DP27 Label Printer', {
      size: { width, height: 100 },
      units: 'mm',
    });
  }
}
