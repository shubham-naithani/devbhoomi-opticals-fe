import { Injectable, computed, signal } from '@angular/core';
import { InventoryItem } from '../models/inventory.model';

export interface CartLine {
  inventoryItem: string;
  name: string;
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

  add(item: InventoryItem, quantity = 1): void {
    const current = this.linesSignal();
    const existing = current.find((l) => l.inventoryItem === item._id);

    if (existing) {
      const nextQty = Math.min(existing.quantity + quantity, item.stock);
      this.update(item._id, nextQty);
      return;
    }

    const line: CartLine = {
      inventoryItem: item._id,
      name: item.name,
      price: item.price,
      stock: item.stock,
      imageUrl: item.imageUrl,
      quantity: Math.min(quantity, item.stock),
    };
    this.persist([...current, line]);
  }

  update(inventoryItemId: string, quantity: number): void {
    const current = this.linesSignal();
    if (quantity <= 0) {
      this.remove(inventoryItemId);
      return;
    }
    const updated = current.map((l) =>
      l.inventoryItem === inventoryItemId ? { ...l, quantity: Math.min(quantity, l.stock) } : l
    );
    this.persist(updated);
  }

  remove(inventoryItemId: string): void {
    this.persist(this.linesSignal().filter((l) => l.inventoryItem !== inventoryItemId));
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
