import type {
  RazorpayCheckoutResponse,
  RazorpayPaymentOrder,
} from './razorpay.api';

interface RazorpayFailure {
  error?: { description?: string };
}

interface RazorpayCheckoutOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  handler: (response: RazorpayCheckoutResponse) => void;
  modal: { ondismiss: () => void };
  theme: { color: string };
}

interface RazorpayInstance {
  open(): void;
  on(event: 'payment.failed', callback: (response: RazorpayFailure) => void): void;
}

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayCheckoutOptions) => RazorpayInstance;
  }
}

let scriptPromise: Promise<void> | undefined;

export function loadRazorpayCheckout(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  const loading = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.id = 'razorpay-checkout-script';
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => {
      if (window.Razorpay) resolve();
      else reject(new Error('Razorpay Checkout did not initialize'));
    };
    script.onerror = () => reject(new Error('Could not load Razorpay Checkout'));
    document.head.appendChild(script);
  }).catch((error: unknown) => {
    scriptPromise = undefined;
    document.getElementById('razorpay-checkout-script')?.remove();
    throw error;
  });
  scriptPromise = loading;

  return loading;
}

export function openRazorpayCheckout(
  payment: RazorpayPaymentOrder,
  description: string,
  handlers: {
    onSuccess: (response: RazorpayCheckoutResponse) => void;
    onFailure: (message: string) => void;
    onDismiss: () => void;
  }
): void {
  if (!window.Razorpay) throw new Error('Razorpay Checkout is not loaded');
  const checkout = new window.Razorpay({
    key: payment.keyId,
    amount: payment.amount,
    currency: payment.currency,
    name: 'QueueLess Campus',
    description,
    order_id: payment.razorpayOrderId,
    handler: handlers.onSuccess,
    modal: { ondismiss: handlers.onDismiss },
    theme: { color: '#e85d04' },
  });
  checkout.on('payment.failed', (response) => {
    handlers.onFailure(response.error?.description ?? 'Razorpay payment failed');
  });
  checkout.open();
}
