import EventEmitter2 from "eventemitter2";

interface PaymentProvider {
  checkoutMobileMoney(
    options: MobileMoneyCheckoutOptions
  ): Promise<CheckoutResult>;

  checkoutCreditCard(
    options: CreditCardCheckoutOptions
  ): Promise<CheckoutResult>;

  refund(options: RefundOptions): Promise<RefundResult>;

  useEventEmitter(eventEmitter: EventEmitter2): void;

  handleWebhook(body: Record<string, any>): Promise<void>;
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
  };
  metadata?: Record<string, any>;
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
};

type RefundResult = {
  transactionId: string;
  transactionReference: string;
  transactionStatus: TransactionStatus;
  transactionAmount: number;
  transactionCurrency: Currency;
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
  MobileMoneyCheckoutOptions,
  CheckoutResult,
  TransactionStatus,
  RefundOptions,
  RefundResult,
};
