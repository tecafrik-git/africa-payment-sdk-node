import { PhoneNumber, parsePhoneNumber } from "libphonenumber-js";
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
} from "../payment-provider.interface";
import { ApisauceInstance, create } from "apisauce";
import EventEmitter2 from "eventemitter2";
import {
  PaymentCancelledEvent,
  PaymentEventType,
  PaymentFailedEvent,
  PaymentInitiatedEvent,
  PaymentSuccessfulEvent,
} from "../payment-events";
import { createHash } from "crypto";
import { PaymentError, PaymentErrorType } from "../payment-error";

class PaydunyaPaymentProvider implements PaymentProvider {
  private api: ApisauceInstance;
  private eventEmitter?: EventEmitter2;
  private masterKeySha512Hash: string;

  constructor(private config: PaydunyaPaymentProviderConfig) {
    this.api = create({
      baseURL:
        config.mode === "test"
          ? "https://app.sandbox.paydunya.com/api/v1/"
          : "https://app.paydunya.com/api/v1/",
      headers: {
        "Content-Type": "application/json",
        "PAYDUNYA-MASTER-KEY": config.masterKey,
        "PAYDUNYA-PRIVATE-KEY": config.privateKey,
        "PAYDUNYA-PUBLIC-KEY": config.publicKey,
        "PAYDUNYA-TOKEN": config.token,
      },
    });

    this.api.addResponseTransform((response) => {
      if (
        response.config?.url?.endsWith("/softpay/orange-money-senegal") &&
        response.status === 422 &&
        response.data?.message === "Invalid or expired OTP code!"
      ) {
        throw new PaymentError(
          response.data.message,
          PaymentErrorType.INVALID_AUTHORIZATION_CODE
        );
      }
      if (!response.ok) {
        const defaultErrorMessage =
          "Paydunya error: " +
          response.problem +
          ". Status: " +
          response.status +
          ". Data: " +
          JSON.stringify(response.data);
        throw new PaymentError(
          response.data
            ? "message" in response.data
              ? response.data.message
              : "response_text" in response.data
              ? response.data.response_text
              : defaultErrorMessage
            : defaultErrorMessage
        );
      }
    });

    const hash = createHash("sha512");
    hash.update(this.config.masterKey, "utf-8");
    this.masterKeySha512Hash = hash.digest("hex");
  }

  useEventEmitter(eventEmitter: EventEmitter2) {
    this.eventEmitter = eventEmitter;
  }

  async checkout(
    options: MobileMoneyCheckoutOptions | CreditCardCheckoutOptions
  ): Promise<CheckoutResult> {
    if (options.currency !== Currency.XOF) {
      throw new PaymentError(
        "Paydunya does not support the currency: " + options.currency,
        PaymentErrorType.UNSUPPORTED_PAYMENT_METHOD
      );
    }
    const isMobileMoney =
      options.paymentMethod === PaymentMethod.WAVE ||
      options.paymentMethod === PaymentMethod.ORANGE_MONEY;
    const createInvoiceResponse = await this.api.post<
      PaydunyaCreateInvoiceSuccessResponse,
      PaydunyaCreateInvoiceErrorResponse
    >("checkout-invoice/create", {
      invoice: {
        total_amount: options.amount,
        description: options.description,
      },
      store: {
        name: this.config.store.name,
      },
      channels:
        options.paymentMethod === PaymentMethod.CREDIT_CARD
          ? ["card"]
          : null,
      custom_data: {
        transaction_id: options.transactionId,
        ...options.metadata,
      },
      actions: {
        cancel_url: options.failureRedirectUrl,
        return_url: options.successRedirectUrl,
      },
    });

    const invoiceData = createInvoiceResponse.data;

    if (!invoiceData) {
      throw new PaymentError(
        "Paydunya error: " + createInvoiceResponse.problem
      );
    }

    if (invoiceData.response_code !== "00") {
      throw new PaymentError("Paydunya error: " + invoiceData.response_text);
    }

    if (!("token" in invoiceData)) {
      throw new PaymentError(
        "Missing invoice token in Paydunya response: " +
          invoiceData.response_text
      );
    }

    const invoiceToken = invoiceData.token;

    let paydunyaPaymentResponse:
      | PaydunyaWavePaymentSuccessResponse
      | PaydunyaOrangeMoneyPaymentSuccessResponse
      | null = null;

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

      if (options.paymentMethod === PaymentMethod.WAVE) {
        const paydunyaWaveResponse = await this.api.post<
          PaydunyaWavePaymentSuccessResponse,
          PaydunyaWavePaymentErrorResponse
        >("/softpay/wave-senegal", {
          wave_senegal_fullName: `${options.customer.firstName || ""} ${
            options.customer.lastName || ""
          }`.trim(),
          wave_senegal_email: `${options.customer.phoneNumber}@yopmail.com`,
          wave_senegal_phone: parsedCustomerPhoneNumber.nationalNumber,
          wave_senegal_payment_token: invoiceToken,
        });

        const waveData = paydunyaWaveResponse.data;

        if (!waveData) {
          throw new PaymentError(
            "Paydunya error: " + paydunyaWaveResponse.problem
          );
        }

        if (!waveData.success) {
          throw new PaymentError("Paydunya error: " + waveData.message);
        }

        if (!waveData.url) {
          throw new PaymentError(
            "Missing wave payment url in Paydunya response: " + waveData.message
          );
        }
        paydunyaPaymentResponse = waveData;
      } else if (options.paymentMethod === PaymentMethod.ORANGE_MONEY) {
        const paydunyaOrangeMoneyResponse = await this.api.post<
          PaydunyaOrangeMoneyPaymentSuccessResponse,
          PaydunyaOrangeMoneyPaymentErrorResponse
        >("/softpay/orange-money-senegal", {
          customer_name: `${options.customer.firstName || ""} ${
            options.customer.lastName || ""
          }`.trim(),
          customer_email: `${options.customer.phoneNumber}@yopmail.com`,
          phone_number: parsedCustomerPhoneNumber.nationalNumber,
          authorization_code: options.authorizationCode,
          invoice_token: invoiceToken,
        });

        const orangeMoneyData = paydunyaOrangeMoneyResponse.data;

        if (!orangeMoneyData) {
          throw new PaymentError(
            "Paydunya error: " + paydunyaOrangeMoneyResponse.problem
          );
        }

        if (!orangeMoneyData.success) {
          throw new PaymentError("Paydunya error: " + orangeMoneyData.message);
        }
        paydunyaPaymentResponse = orangeMoneyData;
      }
    }

    if (
      options.paymentMethod !== PaymentMethod.CREDIT_CARD &&
      !paydunyaPaymentResponse
    ) {
      throw new PaymentError("Paydunya error: no payment response data");
    }

    const redirectUrl =
      options.paymentMethod === PaymentMethod.CREDIT_CARD
        ? invoiceData.response_text
        : paydunyaPaymentResponse && "url" in paydunyaPaymentResponse
        ? paydunyaPaymentResponse.url
        : undefined;

    const result: CheckoutResult = {
      transactionAmount: options.amount,
      transactionCurrency: options.currency,
      transactionId: options.transactionId,
      transactionReference: invoiceToken,
      transactionStatus: TransactionStatus.PENDING,
      redirectUrl,
    };

    const paymentInitiatedEvent: PaymentInitiatedEvent = {
      type: PaymentEventType.PAYMENT_INITIATED,
      paymentMethod: options.paymentMethod,
      transactionId: options.transactionId,
      transactionAmount: options.amount,
      transactionCurrency: options.currency,
      transactionReference: invoiceToken,
      redirectUrl,
      metadata: options.metadata,
    };
    this.eventEmitter?.emit(
      PaymentEventType.PAYMENT_INITIATED,
      paymentInitiatedEvent
    );

    return result;
  }

  async checkoutMobileMoney(
    options: MobileMoneyCheckoutOptions
  ): Promise<CheckoutResult> {
    return this.checkout(options);
  }

  async checkoutCreditCard(
    options: CreditCardCheckoutOptions
  ): Promise<CheckoutResult> {
    return this.checkout(options);
  }

  async refund(options: RefundOptions): Promise<RefundResult> {
    const transactionReference = options.refundedTransactionReference;
    const getInvoiceResponse = await this.api.get<
      PaydunyaGetInvoiceSuccessResponse,
      PaydunyaGetInvoiceErrorResponse
    >(`/checkout-invoice/confirm/${transactionReference}`);

    if (!getInvoiceResponse.data) {
      throw new PaymentError("Paydunya error: " + getInvoiceResponse.problem);
    }

    if (getInvoiceResponse.data.response_code !== "00") {
      throw new PaymentError(
        "Paydunya error: " + getInvoiceResponse.data.response_text
      );
    }

    if (!("invoice" in getInvoiceResponse.data)) {
      throw new PaymentError(
        "Missing invoice in Paydunya response: " +
          getInvoiceResponse.data.response_text
      );
    }

    const invoiceToRefund = getInvoiceResponse.data.invoice;
    const amountToRefund =
      options.refundedAmount || parseInt(invoiceToRefund.total_amount, 10);
    const createDisburseInvoiceResponse = await this.api.post<
      PaydunyaCreateDisburseInvoiceSuccessResponse,
      PaydunyaCreateDisburseInvoiceErrorResponse
    >("/disburse/get-invoice", {
      account_alias: getInvoiceResponse.data.customer.phone,
      amount: amountToRefund,
      withdraw_mode: getInvoiceResponse.data.customer.payment_method.replace(
        /_/g,
        "-"
      ),
    });

    debugger;
    if (!createDisburseInvoiceResponse.data) {
      throw new PaymentError(
        "Paydunya error: " + createDisburseInvoiceResponse.problem
      );
    }

    if (createDisburseInvoiceResponse.data.response_code !== "00") {
      throw new PaymentError(
        "Paydunya error: " + createDisburseInvoiceResponse.data.response_text
      );
    }

    if (!("disburse_token" in createDisburseInvoiceResponse.data)) {
      throw new PaymentError(
        "Missing disburse token in Paydunya response: " +
          createDisburseInvoiceResponse.data.response_text
      );
    }

    const submitDisburseInvoiceResponse = await this.api.post<
      PaydunyaSubmitDisburseInvoiceSuccessResponse,
      PaydunyaSubmitDisburseInvoiceErrorResponse
    >("/disburse/submit-invoice", {
      disburse_invoice: createDisburseInvoiceResponse.data.disburse_token,
      disburse_id: options.transactionId,
    });

    debugger;
    if (!submitDisburseInvoiceResponse.data) {
      throw new PaymentError(
        "Paydunya error: " + submitDisburseInvoiceResponse.problem
      );
    }

    if (submitDisburseInvoiceResponse.data.response_code !== "00") {
      throw new PaymentError(
        "Paydunya error: " + submitDisburseInvoiceResponse.data.response_text
      );
    }

    debugger;
    return {
      transactionAmount: amountToRefund,
      transactionId: options.transactionId,
      transactionReference: createDisburseInvoiceResponse.data.disburse_token,
      transactionCurrency: Currency.XOF,
      transactionStatus: TransactionStatus.SUCCESS,
    };
  }

  async handleWebhook(body: PaydunyaPaymentWebhookBody): Promise<void> {
    if (!body.hash) {
      console.error("Missing hash in Paydunya webhook body");
      return;
    }
    if (body.hash !== this.masterKeySha512Hash) {
      console.error("Invalid hash in Paydunya webhook body");
      return;
    }
    const paymentMethod =
      body.customer.payment_method === "wave_senegal"
        ? PaymentMethod.WAVE
        : body.customer.payment_method === "orange_money_senegal"
        ? PaymentMethod.ORANGE_MONEY
        : null;
    if (body.status === "completed" && body.response_code == "00") {
      const paymentSuccessfulEvent: PaymentSuccessfulEvent = {
        type: PaymentEventType.PAYMENT_SUCCESSFUL,
        paymentMethod,
        transactionAmount: Number(body.invoice.total_amount),
        transactionCurrency: Currency.XOF,
        transactionId: body.custom_data.transaction_id,
        transactionReference: body.invoice.token,
        metadata: body.custom_data,
      };
      this.eventEmitter?.emit(
        PaymentEventType.PAYMENT_SUCCESSFUL,
        paymentSuccessfulEvent
      );
    } else if (body.status === "cancelled") {
      const paymentCancelledEvent: PaymentCancelledEvent = {
        type: PaymentEventType.PAYMENT_CANCELLED,
        paymentMethod,
        transactionAmount: Number(body.invoice.total_amount),
        transactionCurrency: Currency.XOF,
        transactionId: body.custom_data.transaction_id,
        transactionReference: body.invoice.token,
        metadata: body.custom_data,
        reason: body.response_text,
      };
      this.eventEmitter?.emit(
        PaymentEventType.PAYMENT_CANCELLED,
        paymentCancelledEvent
      );
    } else if (body.status === "failed") {
      const paymentFailedEvent: PaymentFailedEvent = {
        type: PaymentEventType.PAYMENT_FAILED,
        paymentMethod,
        transactionAmount: Number(body.invoice.total_amount),
        transactionCurrency: Currency.XOF,
        transactionId: body.custom_data.transaction_id,
        transactionReference: body.invoice.token,
        metadata: body.custom_data,
        reason: body.response_text,
      };
      this.eventEmitter?.emit(
        PaymentEventType.PAYMENT_FAILED,
        paymentFailedEvent
      );
    }
  }
}

type PaydunyaPaymentProviderConfig = {
  masterKey: string;
  privateKey: string;
  publicKey: string;
  token: string;
  mode: "test" | "live";
  store: {
    name: string;
  };
};

type PaydunyaCreateInvoiceSuccessResponse = {
  response_code: "00";
  response_text: string;
  description: string;
  token: string;
};

type PaydunyaCreateInvoiceErrorResponse = {
  response_code: Exclude<string, "00">;
  response_text: string;
};

type PaydunyaWavePaymentSuccessResponse = {
  success: true;
  message: string;
  url: string;
};

type PaydunyaWavePaymentErrorResponse = {
  success: false | undefined;
  message: string;
};

type PaydunyaOrangeMoneyPaymentSuccessResponse = {
  success: true;
  message: string;
  fees: number;
  currency: string;
};

type PaydunyaOrangeMoneyPaymentErrorResponse = {
  success: false | undefined;
  message: string;
};

type PaydunyaPaymentWebhookBody = {
  response_code: string;
  response_text: string;
  hash: string;
  invoice: PaydunyaInvoice;
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

type PaydunyaInvoice = {
  token: string;
  pal_is_on: string;
  total_amount: string;
  total_amount_without_fees: string;
  description: string;
  expire_date: string;
};

type PaydunyaGetInvoiceSuccessResponse = {
  response_code: "00";
  response_text: string;
  hash: string;
  invoice: PaydunyaInvoice;
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
  receipt_url: string;
};

type PaydunyaGetInvoiceErrorResponse = {
  response_code: Exclude<string, "00">;
  response_text: string;
};

type PaydunyaCreateDisburseInvoiceSuccessResponse = {
  response_code: "00";
  response_text: never;
  disburse_token: string;
};

type PaydunyaCreateDisburseInvoiceErrorResponse = {
  response_code: Exclude<string, "00">;
  response_text: string;
};

type PaydunyaSubmitDisburseInvoiceSuccessResponse = {
  response_code: "00";
  response_text: string;
  description: string;
  transaction_id: string;
  provider_ref?: string;
};

type PaydunyaSubmitDisburseInvoiceErrorResponse = {
  response_code: Exclude<string, "00">;
  response_text: string;
};

export default PaydunyaPaymentProvider;
