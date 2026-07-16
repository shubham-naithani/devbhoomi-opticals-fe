import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { InventoryService } from '../../core/services/inventory.service';
import { CartService } from '../../core/services/cart.service';
import { ToastService } from '../../core/services/toast.service';
import {
  Article,
  InventoryItem,
  activeArticles,
  describeArticle,
  inStockArticles,
  priceRange,
} from '../../core/models/inventory.model';

@Component({
  selector: 'app-catalog',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './catalog.component.html',
  styleUrl: './catalog.component.scss',
})
export class CatalogComponent {
  private inventoryService = inject(InventoryService);
  private toast = inject(ToastService);
  cart = inject(CartService);

  // expose helpers to the template
  priceRange = priceRange;
  describeArticle = describeArticle;
  activeArticles = activeArticles;

  items = signal<InventoryItem[]>([]);
  isLoading = signal(true);

  searchTerm = signal('');
  category = signal('');
  gender = signal('');
  frameShape = signal('');
  brand = signal('');
  brands = signal<string[]>([]);

  // Which variant is currently selected per product card, keyed by product id.
  private selectedArticleIds = signal<Record<string, string>>({});

  constructor() {
    this.fetch();
    this.inventoryService.brands().subscribe((res) => this.brands.set(res.brands));
  }

  fetch(): void {
    this.isLoading.set(true);
    this.inventoryService
      .list({
        search: this.searchTerm() || undefined,
        category: this.category() || undefined,
        gender: this.gender() || undefined,
        frameShape: this.frameShape() || undefined,
        brand: this.brand() || undefined,
        limit: 50,
      })
      .subscribe({
        next: (res) => {
          this.items.set(res.items || []);
          this.isLoading.set(false);
        },
        error: () => {
          this.isLoading.set(false);
          this.toast.error('Could not load the catalog');
        },
      });
  }

  onFilterChange(): void {
    this.fetch();
  }

  filterByBrand(brandName: string): void {
    this.brand.set(brandName);
    this.fetch();
  }

  selectedArticle(product: InventoryItem): Article | undefined {
    const id = this.selectedArticleIds()[product._id];
    const inStock = inStockArticles(product);
    return (id && inStock.find((a) => a._id === id)) || inStock[0] || activeArticles(product)[0];
  }

  onArticleChange(productId: string, articleId: string): void {
    this.selectedArticleIds.update((map) => ({ ...map, [productId]: articleId }));
  }

  addToCart(product: InventoryItem): void {
    const article = this.selectedArticle(product);
    if (!article || article.stock <= 0) {
      this.toast.error('This variant is currently out of stock');
      return;
    }
    this.cart.add(product, article, 1);
    this.toast.success(`${product.name} (${describeArticle(article)}) added to cart`);
  }
}
