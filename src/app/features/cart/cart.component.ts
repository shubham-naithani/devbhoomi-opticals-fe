import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CartService } from '../../core/services/cart.service';
import { OrderService } from '../../core/services/order.service';
import { ToastService } from '../../core/services/toast.service';

@Component({
  selector: 'app-cart',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './cart.component.html',
  styleUrl: './cart.component.scss',
})
export class CartComponent {
  cart = inject(CartService);
  private orderService = inject(OrderService);
  private toast = inject(ToastService);
  private router = inject(Router);

  shippingAddress = signal('');
  contactPhone = signal('');
  notes = signal('');
  isPlacingOrder = signal(false);

  increment(line: { inventoryItem: string; quantity: number; stock: number }): void {
    this.cart.update(line.inventoryItem, Math.min(line.quantity + 1, line.stock));
  }

  decrement(line: { inventoryItem: string; quantity: number }): void {
    this.cart.update(line.inventoryItem, line.quantity - 1);
  }

  placeOrder(): void {
    if (this.cart.lines().length === 0) return;

    if (!this.shippingAddress().trim() || !this.contactPhone().trim()) {
      this.toast.error('Please add a delivery address and phone number');
      return;
    }

    this.isPlacingOrder.set(true);

    const payload = {
      items: this.cart.lines().map((l) => ({ inventoryItem: l.inventoryItem, quantity: l.quantity })),
      shippingAddress: this.shippingAddress(),
      contactPhone: this.contactPhone(),
      notes: this.notes() || undefined,
    };

    this.orderService.create(payload).subscribe({
      next: () => {
        this.toast.success('Order placed! We will contact you to confirm.');
        this.cart.clear();
        this.isPlacingOrder.set(false);
        this.router.navigate(['/orders']);
      },
      error: (err) => {
        this.isPlacingOrder.set(false);
        this.toast.error(err?.error?.message || 'Could not place order');
      },
    });
  }
}
