import {
  MobileMoneyCheckoutOptions,
  CheckoutResult,
  PaymentProvider,
  RefundOptions,
  RefundResult,
  CreditCardCheckoutOptions,
  RedirectCheckoutOptions,
  TransactionStatus,
  PaymentMethod,
  HandleWebhookOptions,
  Currency,
  MobileMoneyPayoutOptions,
  PayoutResult,
} from "../payment-provider.interface";
import EventEmitter2 from "eventemitter2";
import {
  PaymentEventType,
  PaymentFailedEvent,
  PaymentInitiatedEvent,
  PaymentSuccessfulEvent,
} from "../payment-events";

class BogusPaymentProvider implements PaymentProvider {
  private eventEmitter?: EventEmitter2;

  constructor(private config: BogusPaymentProviderConfig) {}

  useEventEmitter(eventEmitter: EventEmitter2) {
    this.eventEmitter = eventEmitter;
  }

  async checkout(
    options:
      | MobileMoneyCheckoutOptions
      | CreditCardCheckoutOptions
      | RedirectCheckoutOptions,
    isFailure: boolean
  ): Promise<CheckoutResult> {
    if (this.config.instantEvents) {
      this.eventEmitter?.emit(PaymentEventType.PAYMENT_INITIATED, {
        type: PaymentEventType.PAYMENT_INITIATED,
        transactionAmount: options.amount,
        transactionCurrency: options.currency,
        transactionId: options.transactionId,
        transactionReference: `${options.paymentMethod.toLowerCase()}-transaction-reference`,
        paymentMethod: PaymentMethod.WAVE,
        metadata: options.metadata,
        paymentProvider: BogusPaymentProvider.name,
      } as PaymentInitiatedEvent);

      if (isFailure) {
        this.eventEmitter?.emit(PaymentEventType.PAYMENT_FAILED, {
          type: PaymentEventType.PAYMENT_FAILED,
          transactionAmount: options.amount,
          transactionCurrency: options.currency,
          transactionId: options.transactionId,
          transactionReference: `${options.paymentMethod.toLowerCase()}-transaction-reference`,
          paymentMethod: PaymentMethod.WAVE,
          metadata: options.metadata,
          reason: "Payment failed",
          paymentProvider: BogusPaymentProvider.name,
        } as PaymentFailedEvent);
      } else {
        this.eventEmitter?.emit(PaymentEventType.PAYMENT_SUCCESSFUL, {
          type: PaymentEventType.PAYMENT_SUCCESSFUL,
          transactionAmount: options.amount,
          transactionCurrency: options.currency,
          transactionId: options.transactionId,
          transactionReference: `${options.paymentMethod.toLowerCase()}-transaction-reference`,
          paymentMethod: PaymentMethod.WAVE,
          metadata: options.metadata,
          paymentProvider: BogusPaymentProvider.name,
        } as PaymentSuccessfulEvent);
      }
    }

    return {
      transactionAmount: options.amount,
      transactionCurrency: options.currency,
      transactionId: options.transactionId,
      transactionReference: `${options.paymentMethod.toLowerCase()}-transaction-reference`,
      transactionStatus: TransactionStatus.PENDING,
      redirectUrl: isFailure
        ? options.failureRedirectUrl
        : options.successRedirectUrl,
    };
  }

  async checkoutMobileMoney(
    options: MobileMoneyCheckoutOptions
  ): Promise<CheckoutResult> {
    let isFailure = false;
    if (options.paymentMethod === PaymentMethod.WAVE) {
      isFailure = options.customer.phoneNumber.endsWith("13");
    } else if (options.paymentMethod === PaymentMethod.ORANGE_MONEY) {
      isFailure = options.authorizationCode?.endsWith("13") || false;
    }

    return this.checkout(options, isFailure);
  }

  async checkoutCreditCard(
    options: CreditCardCheckoutOptions
  ): Promise<CheckoutResult> {
    const isFailure = options.cardNumber?.endsWith("13") || false;
    return this.checkout(options, isFailure);
  }

  async checkoutRedirect(
    options: RedirectCheckoutOptions
  ): Promise<CheckoutResult> {
    const isFailure = options.customer.email?.endsWith("failure.com") ?? false;
    return this.checkout(options, isFailure);
  }

  async refund(options: RefundOptions): Promise<RefundResult> {
    console.debug("Refunding transaction", options.transactionId, options);
    return {
      transactionAmount: options.refundedAmount || 0,
      transactionCurrency: Currency.XOF,
      transactionId: options.transactionId,
      transactionReference: `refunded-transaction-reference`,
      transactionStatus: TransactionStatus.PENDING,
    };
  }

  async handleWebhook(rawBody: Buffer | string, options: HandleWebhookOptions) {
    const body = JSON.parse(
      rawBody.toString()
    ) as BogusPaymentProviderWebhookBody;
    const isFailure = body.success === false;
    const eventType = isFailure
      ? PaymentEventType.PAYMENT_FAILED
      : PaymentEventType.PAYMENT_SUCCESSFUL;
    const event = {
      type: eventType,
      transactionAmount: body.amount,
      transactionCurrency: body.currency,
      transactionId: body.transactionId,
      transactionReference: body.transactionReference,
      paymentMethod: body.paymentMethod,
      metadata: body.metadata,
      paymentProvider: BogusPaymentProvider.name,
    } as PaymentSuccessfulEvent | PaymentFailedEvent;
    this.eventEmitter?.emit(eventType, event);
    return event;
  }

  payoutMobileMoney(options: MobileMoneyPayoutOptions): Promise<PayoutResult> {
    console.debug("Paying out mobile money", options);
    return Promise.resolve({
      transactionAmount: options.amount,
      transactionCurrency: options.currency,
      transactionId: options.transactionId,
      transactionReference: `payout-transaction-reference`,
      transactionStatus: TransactionStatus.SUCCESS,
    });
  }
}

type BogusPaymentProviderConfig = {
  /**
   * Whether to emit events instantly or wait for the webhook to be called
   */
  instantEvents: boolean;
};

export type BogusPaymentProviderWebhookBody = {
  success: boolean;
  amount: number;
  transactionId: string;
  transactionReference: string;
  paymentMethod: PaymentMethod;
  currency: Currency;
  metadata?: Record<string, unknown>;
};

export default BogusPaymentProvider;
