import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';
import { RazorpayOrderResponse } from '../models/payment.model';

declare var Razorpay: any;

@Injectable({ providedIn: 'root' })
export class PaymentService {
  private readonly base = `${environment.apiUrl}/payments`;

  constructor(private http: HttpClient) {}

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

  // Three distinct outcomes, kept separate since they mean different
  // things to the user and to reporting:
  // - onSuccess: payment actually completed, verify with backend
  // - onFailure: Razorpay confirms the attempt failed (card declined,
  //   insufficient funds, etc.) — a real failed attempt, not just closing
  //   the popup. Useful to log/toast distinctly so support can tell "tried
  //   and failed" apart from "never attempted."
  // - onDismiss: customer closed the popup without a completed OR failed
  //   attempt reaching Razorpay's servers (e.g. closed before submitting)
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
