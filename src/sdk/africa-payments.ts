import {
  PaymentCancelledEvent,
  PaymentEventType,
  PaymentFailedEvent,
  PaymentInitiatedEvent,
  PaymentSuccessfulEvent,
} from "./payment-events";
import {
  CreditCardCheckoutOptions,
  MobileMoneyCheckoutOptions,
  PaymentProvider,
  RefundOptions,
} from "./payment-provider.interface";
import { EventEmitter2 } from "eventemitter2";
class AfricaPaymentsProvider extends EventEmitter2 {
  constructor(private provider: PaymentProvider) {
    super();
    provider.useEventEmitter(this);
  }

  async checkoutMobileMoney(options: MobileMoneyCheckoutOptions) {
    return this.provider.checkoutMobileMoney(options);
  }

  async checkoutCreditCard(options: CreditCardCheckoutOptions) {
    return this.provider.checkoutCreditCard(options);
  }

  async refund(options: RefundOptions) {
    return this.provider.refund(options);
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
