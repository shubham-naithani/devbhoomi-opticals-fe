import { Injectable, computed, signal } from '@angular/core';
import { Article, InventoryItem, describeArticle } from '../models/inventory.model';

export interface CartLine {
  inventoryItem: string; // parent product id
  articleId: string;     // the specific variant selected
  name: string;          // "Product — Color / Tint" for display
  price: number;
  stock: number;
  imageUrl?: string;
  quantity: number;
}

const CART_KEY = 'devbhoomi_cart';

@Injectable({ providedIn: 'root' })
export class CartService {
  private readonly linesSignal = signal<CartLine[]>(this.readStoredCart());

  readonly lines = computed(() => this.linesSignal());
  readonly itemCount = computed(() => this.linesSignal().reduce((sum, l) => sum + l.quantity, 0));
  readonly total = computed(() => this.linesSignal().reduce((sum, l) => sum + l.price * l.quantity, 0));

  add(product: InventoryItem, article: Article, quantity = 1): void {
    const current = this.linesSignal();
    const existing = current.find((l) => l.articleId === article._id);

    if (existing) {
      const nextQty = Math.min(existing.quantity + quantity, article.stock);
      this.update(article._id, nextQty);
      return;
    }

    const line: CartLine = {
      inventoryItem: product._id,
      articleId: article._id,
      name: `${product.name} — ${describeArticle(article)}`,
      price: article.price,
      stock: article.stock,
      imageUrl: article.images && article.images.length > 0 ? article.images[0] : undefined,
      quantity: Math.min(quantity, article.stock),
    };
    this.persist([...current, line]);
  }

  update(articleId: string, quantity: number): void {
    const current = this.linesSignal();
    if (quantity <= 0) {
      this.remove(articleId);
      return;
    }
    const updated = current.map((l) =>
      l.articleId === articleId ? { ...l, quantity: Math.min(quantity, l.stock) } : l
    );
    this.persist(updated);
  }

  remove(articleId: string): void {
    this.persist(this.linesSignal().filter((l) => l.articleId !== articleId));
  }

  clear(): void {
    this.persist([]);
  }

  private persist(lines: CartLine[]): void {
    this.linesSignal.set(lines);
    localStorage.setItem(CART_KEY, JSON.stringify(lines));
  }

  private readStoredCart(): CartLine[] {
    const raw = localStorage.getItem(CART_KEY);
    return raw ? (JSON.parse(raw) as CartLine[]) : [];
  }
}
