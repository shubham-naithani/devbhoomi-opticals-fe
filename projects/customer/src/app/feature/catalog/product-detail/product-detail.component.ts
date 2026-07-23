import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { InventoryService, InventoryItem, Article, activeArticles, describeArticle } from 'shared';
import { CartService } from 'shared';

@Component({
  selector: 'app-product-detail',
  standalone: true,
  imports: [RouterLink, MatButtonModule, MatIconModule],
  templateUrl: './product-detail.component.html',
  styleUrl: './product-detail.component.scss',
})
export class ProductDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private inventoryService = inject(InventoryService);
  private cart = inject(CartService);
  private snackBar = inject(MatSnackBar);

  activeArticles = activeArticles;
  describeArticle = describeArticle;

  product = signal<InventoryItem | null>(null);
  isLoading = signal(true);
  selectedArticleId = signal<string | null>(null);
  activeImageIndex = signal(0);
  quantity = signal(1);

  selectedArticle = computed<Article | undefined>(() => {
    const p = this.product();
    if (!p) return undefined;
    const options = activeArticles(p);
    const id = this.selectedArticleId();
    return (id && options.find((a) => a._id === id)) || options[0];
  });

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) return;

    this.inventoryService.getById(id).subscribe({
      next: (res) => {
        this.product.set(res.item);
        const first = activeArticles(res.item)[0];
        if (first) this.selectedArticleId.set(first._id);
        this.isLoading.set(false);
      },
      error: () => this.isLoading.set(false),
    });
  }

  selectArticle(articleId: string): void {
    this.selectedArticleId.set(articleId);
    this.activeImageIndex.set(0);
    this.quantity.set(1);
  }

  setImageIndex(index: number): void {
    this.activeImageIndex.set(index);
  }

  nextImage(): void {
    const images = this.selectedArticle()?.images || [];
    if (images.length === 0) return;
    this.activeImageIndex.set((this.activeImageIndex() + 1) % images.length);
  }

  prevImage(): void {
    const images = this.selectedArticle()?.images || [];
    if (images.length === 0) return;
    this.activeImageIndex.set((this.activeImageIndex() - 1 + images.length) % images.length);
  }

  increment(): void {
    const article = this.selectedArticle();
    if (!article) return;
    this.quantity.set(Math.min(this.quantity() + 1, article.stock));
  }

  decrement(): void {
    this.quantity.set(Math.max(1, this.quantity() - 1));
  }

  addToCart(): void {
    const product = this.product();
    const article = this.selectedArticle();
    if (!product || !article || article.stock <= 0) return;

    this.cart.add(product, article, this.quantity());
    this.snackBar.open(`Added to cart: ${describeArticle(article)}`, 'View Cart', {
      duration: 3000,
    }).onAction().subscribe(() => {
      window.location.href = '/cart'; // simple nav; could use Router if injected
    });
  }
}
