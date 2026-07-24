import { Injectable, computed, signal } from '@angular/core';
import { Article, InventoryItem, describeArticle } from '../models/inventory.model';

export interface CartLine {
  inventoryItem: string;
  articleId: string;
  name: string;
  price: number;
  stock: number;
  imageUrl?: string;
  quantity: number;
}

const CART_KEY_PREFIX = 'devbhoomi_cart_';
const GUEST_NAMESPACE = 'guest';
const USER_KEY = 'devbhoomi_user';

@Injectable({ providedIn: 'root' })
export class CartService {
  private namespace = this.resolveInitialNamespace();
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

  /** Wipes the CURRENTLY ACTIVE cart bucket. Rarely what you want directly —
   *  prefer switchToUser()/switchToGuest() for login/logout transitions. */
  clear(): void {
    this.persist([]);
  }

  /** Call this right after a successful login/register (once the user id is known).
   *  Merges whatever was in the active (likely guest) cart into that user's saved
   *  cart, then makes the user's cart the active one. */
  switchToUser(userId: string): void {
    const carryOverLines = this.linesSignal();
    this.namespace = userId;
    const savedUserLines = this.readStoredCart();
    const merged = this.mergeLines(savedUserLines, carryOverLines);
    this.persist(merged);

    // The guest cart has now been folded into this user's cart — clear the
    // guest bucket so a future logout doesn't resurrect stale guest items.
    localStorage.removeItem(CART_KEY_PREFIX + GUEST_NAMESPACE);
  }

  /** Call this on logout — switches to a fresh guest cart without touching
   *  (or deleting) the cart that belongs to the account that just logged out. */
  switchToGuest(): void {
    this.namespace = GUEST_NAMESPACE;
    this.linesSignal.set(this.readStoredCart());
  }

  private mergeLines(base: CartLine[], additions: CartLine[]): CartLine[] {
    const merged = base.map((l) => ({ ...l }));
    for (const line of additions) {
      const existing = merged.find((l) => l.articleId === line.articleId);
      if (existing) {
        existing.quantity = Math.min(existing.quantity + line.quantity, existing.stock);
      } else {
        merged.push({ ...line });
      }
    }
    return merged;
  }

  private resolveInitialNamespace(): string {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return GUEST_NAMESPACE;
    try {
      const user = JSON.parse(raw);
      return user?._id || GUEST_NAMESPACE;
    } catch {
      return GUEST_NAMESPACE;
    }
  }

  private persist(lines: CartLine[]): void {
    this.linesSignal.set(lines);
    localStorage.setItem(this.key(), JSON.stringify(lines));
  }

  private readStoredCart(): CartLine[] {
    const raw = localStorage.getItem(this.key());
    if (!raw) return [];

    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as CartLine[]) : [];
    } catch {
      localStorage.removeItem(this.key());
      return [];
    }
  }

  private key(): string {
    return CART_KEY_PREFIX + this.namespace;
  }
}
