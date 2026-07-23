import { HttpClient } from '@angular/common/http';
import { Inject, Injectable } from '@angular/core';
import { API_BASE_URL } from '../api-base-url.token';
import { RazorpayOrderResponse } from '../models/payment.model';

declare var Razorpay: any;

@Injectable({ providedIn: 'root' })
export class PaymentService {
  constructor(private http: HttpClient, @Inject(API_BASE_URL) private apiBaseUrl: string) {}

  private get base() { return `${this.apiBaseUrl}/payments`; }

  createRazorpayOrder(orderId: string) {
    return this.http.post<RazorpayOrderResponse>(`${this.base}/razorpay/order/${orderId}`, {});
  }

  verifyPayment(payload: {
    orderId: string;
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  }) {
    return this.http.post<{ order: any }>(`${this.base}/razorpay/verify`, payload);
  }

  openCheckout(
    data: RazorpayOrderResponse,
    customerName: string,
    onSuccess: (response: any) => void,
    onDismiss: () => void,
    onFailure?: (error: any) => void
  ): void {
    const options = {
      key: data.keyId,
      amount: data.amount,
      currency: data.currency,
      name: 'Devbhoomi Opticals',
      description: `Payment for order ${data.orderNumber}`,
      order_id: data.razorpayOrderId,
      prefill: { name: customerName },
      handler: (response: any) => onSuccess(response),
      modal: { ondismiss: onDismiss },
    };
    const rzp = new Razorpay(options);
    if (onFailure) {
      rzp.on('payment.failed', (response: any) => onFailure(response.error));
    }
    rzp.open();
  }
}
