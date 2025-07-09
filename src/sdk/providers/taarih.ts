import { parsePhoneNumber } from "libphonenumber-js";
import {
  MobileMoneyCheckoutOptions,
  CheckoutResult,
  Currency,
  PaymentMethod,
  PaymentProvider,
  RefundOptions,
  RefundResult,
  TransactionStatus,
  CreditCardCheckoutOptions,
  MobileMoneyPayoutOptions,
  PayoutResult,
  RedirectCheckoutOptions,
} from "../payment-provider.interface";
import { ApisauceInstance, create } from "apisauce";
import EventEmitter2 from "eventemitter2";
import { PaymentError, PaymentErrorType } from "../payment-error";
import { isObject, pick } from "lodash";

class TaarihPaymentProvider implements PaymentProvider {
  private api: ApisauceInstance;
  private eventEmitter?: EventEmitter2;

  constructor(private config: TaarihPaymentProviderConfig) {
    this.api = create({
      baseURL:
        config.mode === "test"
          ? "https://api-dev.taarih.com/api"
          : "https://api-prod.taarih.com/api",
      headers: {
        "Content-Type": "application/json",
      },
    });

    this.api.addResponseTransform((response) => {
      if (!response.ok) {
        const defaultErrorMessage =
          "Taarih error: " +
          response.problem +
          ". Status: " +
          response.status +
          ". Data: " +
          JSON.stringify(response.data);
        console.error(response);
        throw new PaymentError(
          response.data && isObject(response.data)
            ? "message" in response.data
              ? String(response.data.message)
              : "response_text" in response.data
              ? String(response.data.response_text)
              : defaultErrorMessage
            : defaultErrorMessage
        );
      }
    });
  }

  useEventEmitter(eventEmitter: EventEmitter2) {
    this.eventEmitter = eventEmitter;
  }

  private getTaarihPaymentMethod(paymentMethod: PaymentMethod) {
    switch (paymentMethod) {
      case PaymentMethod.WAVE:
        return "WAVE_TO_ACCOUNT";
      case PaymentMethod.ORANGE_MONEY:
        return "ORANGE_MONEY_TO_ACCOUNT";
      case PaymentMethod.CREDIT_CARD:
        return "CARD_TO_ACCOUNT";
      default:
        throw new PaymentError("Invalid payment method: " + paymentMethod);
    }
  }

  async login() {
    const signEndUserResponse = await this.api.post<
      SignEndUserOtpRequiredResponse | SignEndUserSuccessResponse,
      TaarihApiErrorResponse
    >("/auth/signin-end-user", {
      callingCode: this.config.callingCode,
      phoneNumber: this.config.phoneNumber,
      authMode: "SMS",
      visitorId: this.config.visitorId,
      password: this.config.password,
    });

    if (signEndUserResponse.data && "otpRequired" in signEndUserResponse.data) {
      throw new PaymentError(
        "Taarih error: " + signEndUserResponse.data.message
      );
    }

    if (signEndUserResponse.data && "invalidData" in signEndUserResponse.data) {
      throw new PaymentError(
        "Taarih error: " +
        signEndUserResponse.data.message +
        " " +
        signEndUserResponse.data.invalidData
          ? JSON.stringify(signEndUserResponse.data.invalidData)
          : ""
      );
    }

    if (signEndUserResponse.data && "token" in signEndUserResponse.data) {
      return signEndUserResponse.data;
    }
    throw new PaymentError("Taarih error: No token in response");
  }

  async checkoutPreAuth(
    options: MobileMoneyCheckoutOptions,
    token: string,
    bankAccountId: number
  ) {
    const taarihCheckoutResponse = await this.api.post<
      TaarihCheckoutPreAuthSuccessResponse,
      TaarihApiErrorResponse
    >(
      "/transaction/preauth-external-to-account",
      {
        bankAccountId: bankAccountId,
        amount: options.amount,
        callingCode: this.config.callingCode,
        phoneNumber: options.customer.phoneNumber,
        paymentMethod: this.getTaarihPaymentMethod(options.paymentMethod),
        currency: options.currency,
      },
      {
        headers: {
          ...this.api.headers,
          "x-access-token": token,
        },
      }
    );

    if (!taarihCheckoutResponse) {
      throw new PaymentError("Taarih error: no payment response data");
    }

    if (
      taarihCheckoutResponse.data &&
      "amount" in taarihCheckoutResponse.data
    ) {
      return taarihCheckoutResponse.data;
    }
    throw new PaymentError("Taarih error: response data is not valid");
  }

  async checkout(
    options: MobileMoneyCheckoutOptions | CreditCardCheckoutOptions
  ): Promise<CheckoutResult> {
    if (options.paymentMethod === PaymentMethod.CREDIT_CARD) {
      throw new PaymentError(
        "Taarih does not support credit card checkout",
        PaymentErrorType.UNSUPPORTED_PAYMENT_METHOD
      );
    }

    if (options.currency !== Currency.XOF) {
      throw new PaymentError(
        "Taarih does not support the currency: " + options.currency,
        PaymentErrorType.UNSUPPORTED_PAYMENT_METHOD
      );
    }
    const isMobileMoney =
      options.paymentMethod === PaymentMethod.WAVE ||
      options.paymentMethod === PaymentMethod.ORANGE_MONEY;

    const user = await this.login();
    const bankAccountId = user.userBankAccounts[0].id;

    await this.checkoutPreAuth(options, user.token, bankAccountId);

    const taarihCheckoutResponse = await this.api.post<
      TaarihCheckoutSuccessResponse,
      TaarihApiErrorResponse
    >(
      "/transaction/external-to-account",
      {
        bankAccountId: bankAccountId,
        amount: options.amount,
        callingCode: this.config.callingCode,
        phoneNumber: options.customer.phoneNumber,
        paymentMethod: this.getTaarihPaymentMethod(options.paymentMethod),
        currency: options.currency,
      },
      {
        headers: {
          ...this.api.headers,
          "x-access-token": user.token,
        },
      }
    );

    if (isMobileMoney) {
      const parsedCustomerPhoneNumber = parsePhoneNumber(
        options.customer.phoneNumber,
        "SN"
      );
      if (!parsedCustomerPhoneNumber.isValid()) {
        throw new PaymentError(
          "Invalid phone number: " + options.customer.phoneNumber,
          PaymentErrorType.INVALID_PHONE_NUMBER
        );
      }
      if (!parsedCustomerPhoneNumber.isPossible()) {
        throw new PaymentError(
          "Phone number is not possible: " + options.customer.phoneNumber,
          PaymentErrorType.INVALID_PHONE_NUMBER
        );
      }
    }

    if (!taarihCheckoutResponse) {
      throw new PaymentError("Taarih error: no payment response data");
    }

    if (
      taarihCheckoutResponse.data &&
      "externalId" in taarihCheckoutResponse.data &&
      "internalId" in taarihCheckoutResponse.data &&
      "payment_link" in taarihCheckoutResponse.data
    ) {
      const result: CheckoutResult = {
        transactionAmount: options.amount,
        transactionCurrency: options.currency,
        transactionId: taarihCheckoutResponse.data.externalId,
        transactionReference: taarihCheckoutResponse.data.internalId,
        transactionStatus: TransactionStatus.PENDING,
        redirectUrl: taarihCheckoutResponse.data.payment_link,
      };
      return result;
    }

    throw new PaymentError("Taarih error: response data is not valid");
  }

  async checkoutMobileMoney(
    options: MobileMoneyCheckoutOptions
  ): Promise<CheckoutResult> {
    return this.checkout(options);
  }

  async checkoutCreditCard(
    options: CreditCardCheckoutOptions
  ): Promise<CheckoutResult> {
    throw new PaymentError(
      "Taarih does not support credit card checkout",
      PaymentErrorType.UNSUPPORTED_PAYMENT_METHOD
    );
  }

  async checkoutRedirect(
    options: RedirectCheckoutOptions
  ): Promise<CheckoutResult> {
    throw new PaymentError(
      "Taarih redirect checkout not yet implemented",
      PaymentErrorType.UNSUPPORTED_PAYMENT_METHOD
    );
  }

  async refund(options: RefundOptions): Promise<RefundResult> {
    throw new PaymentError(
      "Taarih refund not yet implemented",
      PaymentErrorType.UNSUPPORTED_PAYMENT_METHOD
    );
  }

  async payoutMobileMoney(
    options: MobileMoneyPayoutOptions
  ): Promise<PayoutResult> {
    throw new PaymentError(
      "Taarih payout not yet implemented",
      PaymentErrorType.UNSUPPORTED_PAYMENT_METHOD
    );
  }

  async handleWebhook(rawBody: Buffer | string | Record<string, unknown>) {
    return null;
  }

  async callback(
    internalId: string,
    timeInterval: number = 3000,
    maxAttempts: number = 4
  ) {
    const user = await this.login();
    let attempts = 0;
    while (true) {
      const taarihTransactionStatusResponse = await this.api.get<
        TaarihTransactionStatusSuccessResponse,
        TaarihApiErrorResponse
      >(
        `/transaction/verify-transaction-status/${internalId}`,
        {},
        {
          headers: {
            ...this.api.headers,
            "x-access-token": user.token,
          },
        }
      );
      if (
        taarihTransactionStatusResponse.data &&
        "invalidData" in taarihTransactionStatusResponse.data
      ) {
        throw new PaymentError(
          "Taarih error: " + taarihTransactionStatusResponse.data.message
        );
      }

      const { data } = taarihTransactionStatusResponse;
      if (!data) {
        throw new PaymentError("Taarih error: no transaction status data");
      }

      const status = data.status;
      if (status !== "PENDING") {
        return pick(data, [
          "status",
          "amount",
          "currency",
          "bankAccountSender",
        ]);
      }

      attempts++;
      if (attempts >= maxAttempts) {
        return pick(data, [
          "status",
          "amount",
          "currency",
          "bankAccountSender",
        ]);
      }
      await new Promise((resolve) => setTimeout(resolve, timeInterval));
    }
  }
}

export type TaarihPaymentProviderConfig = {
  phoneNumber: string;
  password: string;
  mode: "test" | "live";
  visitorId: string;
  callingCode: string;
};

export type SignEndUserOtpRequiredResponse = {
  otpRequired: boolean;
  message: string;
  token: string;
};

export type SignEndUserSuccessResponse = {
  token: string;
  id: number;
  legalEntityId: number;
  legalEntityName: string;
  refreshToken: string;
  firstName: string;
  lastName: string;
  phoneNumber: string;
  userBankAccounts: {
    id: number;
    commercial_name: string;
    technical_name: string;
  }[];
};

export type TaarihApiErrorResponse = {
  statusCode: number;
  timestamp: string;
  path: string;
  message: string;
  invalidData: Record<string, string> | null;
};

export type TaarihCheckoutSuccessResponse = {
  externalId: string;
  payment_link: string;
  internalId: string;
};

export type TaarihCheckoutPreAuthSuccessResponse = {
  amount: number;
  fees: number;
  totalAmount: number;
  paymentMethod: string;
};

export type TaarihPaymentWebhookBody = {
  response_code: string;
  response_text: string;
  hash: string;
  custom_data: Record<string, any>;
  actions: {
    cancel_url: string;
    callback_url: string;
    return_url: string;
  };
  mode: string;
  status: string;
  fail_reason: string;
  customer: {
    name: string;
    phone: string;
    email: string;
    payment_method: string;
  };
  receipt_identifier: string;
  receipt_url: string;
  provider_reference: string;
};

export type TaarihTransactionStatusSuccessResponse = {
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

export default TaarihPaymentProvider;
