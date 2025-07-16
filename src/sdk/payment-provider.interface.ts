import EventEmitter2 from "eventemitter2";
import { PaymentEvent, PaymentSuccessfulEvent } from "./payment-events";

interface PaymentProvider {
  checkoutMobileMoney(
    options: MobileMoneyCheckoutOptions
  ): Promise<CheckoutResult>;

  checkoutCreditCard(
    options: CreditCardCheckoutOptions
  ): Promise<CheckoutResult>;

  checkoutRedirect(options: RedirectCheckoutOptions): Promise<CheckoutResult>;

  payoutMobileMoney(options: MobileMoneyPayoutOptions): Promise<PayoutResult>;

  refund(options: RefundOptions): Promise<RefundResult>;

  useEventEmitter(eventEmitter: EventEmitter2): void;

  handleWebhook(
    body: Buffer | string | Record<string, unknown>,
    options?: HandleWebhookOptions
  ): Promise<PaymentEvent | null>;

  callback?(
    internalId: string,
    timeInterval?: number,
    maxAttempts?: number
  ): Promise<
    Pick<
      TaarihTransactionStatusSuccessResponse,
      "status" | "amount" | "currency" | "bankAccountSender"
    >
  >;
}

enum PaymentMethod {
  WAVE = "WAVE",
  ORANGE_MONEY = "ORANGE_MONEY",
  CREDIT_CARD = "CREDIT_CARD",
}

enum Currency {
  XOF = "XOF",
}

type BasicCheckoutOptions = {
  amount: number;
  description: string;
  currency: Currency;
  transactionId: string;
  customer: {
    firstName: string;
    lastName: string;
    email?: string;
  };
  metadata?: Record<string, unknown>;
  successRedirectUrl?: string;
  failureRedirectUrl?: string;
};

type BasicMobileMoneyCheckoutOptions = BasicCheckoutOptions & {
  customer: BasicCheckoutOptions["customer"] & {
    phoneNumber: string;
  };
};

type WaveCheckoutOptions = BasicMobileMoneyCheckoutOptions & {
  paymentMethod: PaymentMethod.WAVE;
};

type OrangeMoneyCheckoutOptions = BasicMobileMoneyCheckoutOptions & {
  paymentMethod: PaymentMethod.ORANGE_MONEY;
  authorizationCode: string;
};

type CreditCardCheckoutOptions = BasicCheckoutOptions & {
  paymentMethod: PaymentMethod.CREDIT_CARD;
  cardNumber: string;
  cardExpirationMonth: string;
  cardExpirationYear: string;
  cardCvv: string;
};

type RedirectCheckoutOptions = BasicCheckoutOptions & {
  paymentMethod: PaymentMethod;
  successRedirectUrl: string;
  failureRedirectUrl: string;
};

type MobileMoneyCheckoutOptions =
  | WaveCheckoutOptions
  | OrangeMoneyCheckoutOptions;

type CheckoutResult = {
  transactionId: string;
  transactionReference: string;
  transactionStatus: TransactionStatus;
  transactionAmount: number;
  transactionCurrency: Currency;
  redirectUrl?: string;
};

enum TransactionStatus {
  PENDING = "PENDING",
  SUCCESS = "SUCCESS",
  FAILED = "FAILED",
  CANCELLED = "CANCELLED",
}

type RefundOptions = {
  transactionId: string;
  refundedTransactionReference: string;
  refundedAmount?: number;
  providerName?: string;
};

type RefundResult = {
  transactionId: string;
  transactionReference: string;
  transactionStatus: TransactionStatus;
  transactionAmount: number;
  transactionCurrency: Currency;
};

type MobileMoneyPayoutOptions = {
  paymentMethod: PaymentMethod.WAVE | PaymentMethod.ORANGE_MONEY;
  amount: number;
  currency: Currency;
  recipient: {
    phoneNumber: string;
  };
  transactionId: string;
  transactionReference: string;
  metadata?: Record<string, unknown>;
};

type PayoutResult = {
  transactionId: string;
  transactionReference: string;
  transactionStatus: TransactionStatus;
  transactionAmount: number;
  transactionCurrency: Currency;
};

type HandleWebhookOptions = {
  headers?: Record<string, string>;
  providerName?: string;
};

type CallbackOptions = {
  internalId: string;
  timeInterval?: number;
  maxAttempts?: number;
};

type TaarihTransactionStatusSuccessResponse = {
  status: string;
  amount: number;
  currency: string;
  bankAccountSender: string | null;
  bankAccount: {
    id: number;
    refId: string;
    commercial_name: string;
    technical_name: string;
    type: string;
    mainAccountNumber: string;
    subAccountNumber: (
      | {
          subAccountNumber: string;
          financialSubAccount: string;
        }
      | {
          subAccountNumber: string;
          financialSubAccount: string;
        }[]
    )[];
    externalId: string | null;
    lettrable: any | null;
    rules: any | null;
    active: boolean;
    createdAt: string;
    updatedAt: string;
    accountOwnerId: number | null;
    legalEntityOwnerId: number;
    technicalAccountType: string;
    balance: number;
    attributions: any[];
    partnerAccountNumber: string | null;
    financialProductId: number;
    status: string;
  };
};

export {
  PaymentProvider,
  PaymentMethod,
  Currency,
  BasicCheckoutOptions,
  BasicMobileMoneyCheckoutOptions,
  WaveCheckoutOptions,
  OrangeMoneyCheckoutOptions,
  CreditCardCheckoutOptions,
  RedirectCheckoutOptions,
  MobileMoneyCheckoutOptions,
  CheckoutResult,
  TransactionStatus,
  RefundOptions,
  RefundResult,
  HandleWebhookOptions,
  MobileMoneyPayoutOptions,
  PayoutResult,
  CallbackOptions,
  TaarihTransactionStatusSuccessResponse,
};
