import {
  PaymentCancelledEvent,
  PaymentEventType,
  PaymentFailedEvent,
  PaymentInitiatedEvent,
  PaymentSuccessfulEvent,
} from "./payment-events";
import { CheckoutOptions, PaymentProvider } from "./payment-provider.interface";
import { EventEmitter2 } from "eventemitter2";
class AfricaPaymentsProvider extends EventEmitter2 {
  constructor(private provider: PaymentProvider) {
    super();
    provider.useEventEmitter(this);
  }

  async checkout(options: CheckoutOptions) {
    return this.provider.checkout(options);
  }

  async handleWebhook(requestBody: Record<string, any>) {
    return this.provider.handleWebhook(requestBody);
  }

  on(
    event: PaymentEventType.PAYMENT_INITIATED,
    listener: (event: PaymentInitiatedEvent) => void
  ): this;

  on(
    event: PaymentEventType.PAYMENT_SUCCESSFUL,
    listener: (event: PaymentSuccessfulEvent) => void
  ): this;

  on(
    event: PaymentEventType.PAYMENT_FAILED,
    listener: (event: PaymentFailedEvent) => void
  ): this;

  on(
    event: PaymentEventType.PAYMENT_CANCELLED,
    listener: (event: PaymentCancelledEvent) => void
  ): this;

  on(event: PaymentEventType, listener: (event: any) => void): this {
    super.on(event, listener);
    return this;
  }
}

export default AfricaPaymentsProvider;
