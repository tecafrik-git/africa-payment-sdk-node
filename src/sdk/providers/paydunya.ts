import { parsePhoneNumber } from "libphonenumber-js";
import {
  CheckoutOptions,
  CheckoutResult,
  Currency,
  PaymentMethod,
  PaymentProvider,
  TransactionStatus,
} from "../payment-provider.interface";
import { ApisauceInstance, create } from "apisauce";

class PaydunyaPaymentProvider implements PaymentProvider {
  private api: ApisauceInstance;

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
      if (!response.ok) {
        throw new Error(
          "Paydunya error: " +
            response.problem +
            ". Status: " +
            response.status +
            ". Data: " +
            JSON.stringify(response.data)
        );
      }
    });
  }

  async checkout(options: CheckoutOptions): Promise<CheckoutResult> {
    if (options.currency !== Currency.XOF) {
      throw new Error(
        "Paydunya does not support the currency: " + options.currency
      );
    }
    const parsedCustomerPhoneNumber = parsePhoneNumber(
      options.customer.phoneNumber,
      "SN"
    );
    if (!parsedCustomerPhoneNumber.isValid()) {
      throw new Error("Invalid phone number: " + options.customer.phoneNumber);
    }
    if (!parsedCustomerPhoneNumber.isPossible()) {
      throw new Error(
        "Phone number is not possible: " + options.customer.phoneNumber
      );
    }
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
      custom_data: {
        transaction_id: options.transactionId,
        ...options.metadata,
      },
    });

    const invoiceData = createInvoiceResponse.data;

    if (!invoiceData) {
      throw new Error("Paydunya error: " + createInvoiceResponse.problem);
    }

    if (invoiceData.response_code !== "00") {
      throw new Error("Paydunya error: " + invoiceData.response_text);
    }

    if (!("token" in invoiceData)) {
      throw new Error(
        "Missing invoice token in Paydunya response: " +
          invoiceData.response_text
      );
    }

    const invoiceToken = invoiceData.token;

    if (options.paymentMethod === PaymentMethod.WAVE) {
      const paydunyaWaveResponse = await this.api.post<
        PaydunyaWavePaymentSuccessResponse,
        PaydunyaWavePaymentErrorResponse
      >("/softpay/wave-senegal", {
        wave_senegal_fullName: `${options.customer.firstName || ""} ${
          options.customer.lastName || ""
        }`.trim(),
        wave_senegal_email:
          options.customer.email ||
          `${options.customer.phoneNumber}@yopmail.com`,
        wave_senegal_phone: parsedCustomerPhoneNumber.nationalNumber,
        wave_senegal_payment_token: invoiceToken,
      });

      const waveData = paydunyaWaveResponse.data;

      if (!waveData) {
        throw new Error("Paydunya error: " + paydunyaWaveResponse.problem);
      }

      if (!waveData.success) {
        throw new Error("Paydunya error: " + waveData.message);
      }

      if (!waveData.url) {
        throw new Error(
          "Missing wave payment url in Paydunya response: " + waveData.message
        );
      }

      return {
        success: true,
        message: waveData.message,
        transactionAmount: options.amount,
        transactionCurrency: options.currency,
        transactionId: options.transactionId,
        transactionReference: invoiceToken,
        transactionStatus: TransactionStatus.PENDING,
        redirectUrl: waveData.url,
      };
    } else if (options.paymentMethod === PaymentMethod.ORANGE_MONEY) {
      throw new Error("Orange Money is not supported yet");
    } else {
      throw new Error(
        "Paydunya does not support the payment method: " + options.paymentMethod
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
  response_code: string;
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

export default PaydunyaPaymentProvider;
