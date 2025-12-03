import { castArray } from "lodash";
import {
  PaymentCancelledEvent,
  PaymentEventType,
  PaymentFailedEvent,
  PaymentInitiatedEvent,
  PaymentSuccessfulEvent,
} from "./payment-events";
import {
  CallbackOptions,
  CreditCardCheckoutOptions,
  HandleWebhookOptions,
  MobileMoneyCheckoutOptions,
  MobileMoneyPayoutOptions,
  PaymentProvider,
  RedirectCheckoutOptions,
  RefundOptions,
} from "./payment-provider.interface";
import { EventEmitter2 } from "eventemitter2";
import { PaymentError, PaymentErrorType } from "./payment-error";
class AfricaPaymentsProvider extends EventEmitter2 {
  private providers: PaymentProvider[];
  constructor(
    providers: PaymentProvider | [PaymentProvider, ...PaymentProvider[]]
  ) {
    super();
    this.providers = castArray(providers);
    this.providers.forEach((provider) => {
      provider.useEventEmitter(this);
    });
  }

  async checkoutMobileMoney(options: MobileMoneyCheckoutOptions) {
    return this.tryEachProvider((provider) =>
      provider.checkoutMobileMoney(options)
    );
  }

  async checkoutCreditCard(options: CreditCardCheckoutOptions) {
    return this.tryEachProvider((provider) =>
      provider.checkoutCreditCard(options)
    );
  }

  async checkoutRedirect(options: RedirectCheckoutOptions) {
    return this.tryEachProvider((provider) =>
      provider.checkoutRedirect(options)
    );
  }

  async payoutMobileMoney(options: MobileMoneyPayoutOptions) {
    return this.tryEachProvider((provider) =>
      provider.payoutMobileMoney(options)
    );
  }

  async tryEachProvider<T>(
    callback: (provider: PaymentProvider) => T | Promise<T>
  ): Promise<T> {
    for (const provider of this.providers) {
      try {
        return await callback(provider);
      } catch (error) {
        const err = error as PaymentError;
        if (err.type === PaymentErrorType.UNSUPPORTED_PAYMENT_METHOD) {
          continue;
        }
        throw error;
      }
    }
    throw new Error("No payment provider was able to process the request");
  }

  async refund(options: RefundOptions) {
    const providerToUse = this.providers.find(
      (provider) =>
        !options.providerName ||
        provider.constructor.name === options.providerName
    );
    if (!providerToUse) {
      throw new PaymentError(
        `No provider found with name ${options.providerName}`,
        PaymentErrorType.UNKNOWN_ERROR
      );
    }
    return providerToUse.refund(options);
  }

  async handleWebhook(
    requestBody: Buffer | string | Record<string, unknown>,
    options?: HandleWebhookOptions
  ) {
    const providerToUse = this.providers.find(
      (provider) =>
        !options?.providerName ||
        provider.constructor.name === options.providerName
    );
    if (!providerToUse) {
      throw new PaymentError(
        `No provider found with name ${options?.providerName}`,
        PaymentErrorType.UNKNOWN_ERROR
      );
    }
    return providerToUse.handleWebhook(requestBody, options);
  }

  async callback(
    internalId: string,
    timeInterval: number = 3000,
    maxAttempts: number = 4
  ) {
    return this.tryEachProvider((provider) =>
      provider.callback?.(internalId, timeInterval, maxAttempts)
    );
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
