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
} from "../payment-provider.interface";
import EventEmitter2 from "eventemitter2";
import {
  PaymentEventType,
  PaymentFailedEvent,
  PaymentInitiatedEvent,
  PaymentSuccessfulEvent,
} from "../payment-events";
import Stripe from "stripe";
import { PaymentError, PaymentErrorType } from "../payment-error";
import { mapValues } from "lodash";

class StripePaymentProvider implements PaymentProvider {
  private eventEmitter?: EventEmitter2;
  private stripe: Stripe;
  private webhookSecret?: string;

  constructor(private config: StripePaymentProviderConfig) {
    this.stripe = new Stripe(config.privateKey, {
      apiVersion: "2023-08-16",
    });
    this.init().catch((error) => {
      console.error("Error initializing stripe provider", error);
    });
    this.webhookSecret = config.webhookSecret;
  }

  async init() {
    if (this.config.webhookUrl) {
      const existingWebhooks = await this.stripe.webhookEndpoints.list();
      const existingWebhook = existingWebhooks.data.find(
        (webhook) => webhook.url === this.config.webhookUrl
      );
      if (!existingWebhook) {
        const installedWebhook = await this.stripe.webhookEndpoints.create({
          enabled_events: [
            "checkout.session.completed",
            "checkout.session.expired",
            "checkout.session.async_payment_succeeded",
            "checkout.session.async_payment_failed",
          ],
          url: this.config.webhookUrl,
        });
        this.webhookSecret = installedWebhook.secret;
      }
    }
  }

  useEventEmitter(eventEmitter: EventEmitter2) {
    this.eventEmitter = eventEmitter;
  }

  async checkoutMobileMoney(
    options: MobileMoneyCheckoutOptions
  ): Promise<CheckoutResult> {
    throw new PaymentError(
      "Stripe does not support mobile money payments",
      PaymentErrorType.UNSUPPORTED_PAYMENT_METHOD
    );
  }

  async checkoutCreditCard(
    options: CreditCardCheckoutOptions
  ): Promise<CheckoutResult> {
    throw new PaymentError(
      "Stripe does not support credit card payments. Use credit card tokens instead",
      PaymentErrorType.UNSUPPORTED_PAYMENT_METHOD
    );
  }

  async checkoutRedirect(
    options: RedirectCheckoutOptions
  ): Promise<CheckoutResult> {
    const checkoutSession = await this.stripe.checkout.sessions.create({
      customer_email: options.customer.email,
      payment_method_types:
        options.paymentMethod === PaymentMethod.CREDIT_CARD
          ? ["card"]
          : undefined,
      line_items: [
        {
          price_data: {
            currency: options.currency,
            product_data: {
              name: options.description,
            },
            unit_amount: options.amount,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: options.successRedirectUrl,
      cancel_url: options.failureRedirectUrl,
      metadata: {
        ...mapValues(options.metadata, (value) => JSON.stringify(value)),
        transactionId: options.transactionId,
      },
    });
    if (!checkoutSession.url) {
      throw new PaymentError(
        "Stripe did not return a checkout URL",
        PaymentErrorType.UNKNOWN_ERROR
      );
    }
    return {
      transactionAmount: options.amount,
      transactionCurrency: options.currency,
      transactionId: options.transactionId,
      transactionReference: checkoutSession.id,
      transactionStatus: TransactionStatus.PENDING,
      redirectUrl: checkoutSession.url,
    };
  }

  async refund(options: RefundOptions): Promise<RefundResult> {
    throw new PaymentError(
      "Stripe does not support refunds",
      PaymentErrorType.UNSUPPORTED_PAYMENT_METHOD
    );
  }

  async handleWebhook(
    rawBody: Buffer | string,
    options: HandleWebhookOptions
  ): Promise<void> {
    const signature = options.headers?.["stripe-signature"];
    if (!signature) {
      console.warn("No signature found in stripe webhook request");
      return;
    }
    if (!this.webhookSecret) {
      console.warn("No stripe webhook secret found");
      return;
    }
    let event: Stripe.Event;
    debugger;
    try {
      event = this.stripe.webhooks.constructEvent(
        rawBody,
        signature,
        this.webhookSecret
      );
    } catch (error) {
      console.warn("Error verifying stripe webhook signature", error);
      return;
    }

    const emitSuccessfulPayment = (session: Stripe.Checkout.Session) => {
      if (!session.metadata?.transactionId) {
        console.warn("No transaction ID found in stripe webhook");
        return;
      }
      const paymentSuccessfulEvent: PaymentSuccessfulEvent = {
        type: PaymentEventType.PAYMENT_SUCCESSFUL,
        paymentMethod: PaymentMethod.CREDIT_CARD,
        transactionAmount: Number(session.amount_total),
        transactionCurrency: session.currency as Currency,
        transactionId: session.metadata?.transactionId,
        transactionReference: session.id,
        metadata: parseMetadata(session.metadata),
      };
      this.eventEmitter?.emit(
        PaymentEventType.PAYMENT_SUCCESSFUL,
        paymentSuccessfulEvent
      );
    };

    const parseMetadata = (
      metadata: Stripe.Metadata
    ): Record<string, string> => {
      return mapValues(metadata, (value) => {
        try {
          return JSON.parse(value);
        } catch (error) {
          return value;
        }
      });
    };

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;

      if (!session.metadata?.transactionId) {
        console.warn("No transaction ID found in stripe webhook");
        return;
      }

      const paymentInitiatedEvent: PaymentInitiatedEvent = {
        type: PaymentEventType.PAYMENT_INITIATED,
        paymentMethod: PaymentMethod.CREDIT_CARD,
        transactionAmount: Number(session.amount_total),
        transactionCurrency: session.currency as Currency,
        transactionId: session.metadata?.transactionId,
        transactionReference: session.id,
        metadata: parseMetadata(session.metadata),
      };
      this.eventEmitter?.emit(
        PaymentEventType.PAYMENT_INITIATED,
        paymentInitiatedEvent
      );

      if (session.payment_status === "paid") {
        emitSuccessfulPayment(session);
      }
    } else if (event.type === "checkout.session.async_payment_succeeded") {
      const session = event.data.object as Stripe.Checkout.Session;
      emitSuccessfulPayment(session);
    } else if (event.type === "checkout.session.async_payment_failed") {
      const session = event.data.object as Stripe.Checkout.Session;
      if (!session.metadata?.transactionId) {
        console.warn("No transaction ID found in stripe webhook");
        return;
      }
      const paymentFailedEvent: PaymentFailedEvent = {
        type: PaymentEventType.PAYMENT_FAILED,
        paymentMethod: PaymentMethod.CREDIT_CARD,
        transactionAmount: Number(session.amount_total),
        transactionCurrency: session.currency as Currency,
        transactionId: session.metadata?.transactionId,
        transactionReference: session.id,
        metadata: parseMetadata(session.metadata),
        reason: "Payment failed",
      };
      this.eventEmitter?.emit(
        PaymentEventType.PAYMENT_FAILED,
        paymentFailedEvent
      );
    }
  }
}

type StripePaymentProviderConfig = {
  privateKey: string;
  webhookUrl?: string;
  webhookSecret?: string;
};

export default StripePaymentProvider;
