import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { InventoryService, InventoryItem, priceRange, activeArticles, totalStock } from 'shared';
import { FormsModule } from '@angular/forms';
import { NgOptimizedImage } from '@angular/common';

const PAGE_SIZE = 12;

@Component({
  selector: 'app-catalog',
  standalone: true,
  imports: [RouterLink, MatButtonModule, MatIconModule, FormsModule, NgOptimizedImage],
  templateUrl: './catalog.component.html',
  styleUrl: './catalog.component.scss',
})
export class CatalogComponent implements OnInit {
  private inventoryService = inject(InventoryService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

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

  ngOnInit(): void {
    // Picks up ?category=sunglasses etc. from Home page links
    this.route.queryParams.subscribe((params) => {
      this.categoryFilter.set(params['category'] || '');
      this.fetchProducts();
    });
  }

  fetchProducts(): void {
    this.isLoading.set(true);
    this.inventoryService
      .list({
        search: this.searchTerm() || undefined,
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
        error: () => this.isLoading.set(false),
      });
  }

  onSearchChange(value: string): void {
    this.searchTerm.set(value);
    this.page.set(1);
    this.fetchProducts();
  }

  onFilterChange(): void {
    this.page.set(1);
    this.fetchProducts();
  }

  thumbnailFor(item: InventoryItem): string | null {
    const article = activeArticles(item)[0];
    return article?.images?.[0] || null;
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages()) return;
    this.page.set(page);
    this.fetchProducts();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}
