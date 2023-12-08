import {
  PaydunyaCreateDisburseInvoiceSuccessResponse,
  PaydunyaCreateInvoiceSuccessResponse,
  PaydunyaGetInvoiceSuccessResponse,
  PaydunyaOrangeMoneyPaymentSuccessResponse,
  PaydunyaSubmitDisburseInvoiceSuccessResponse,
  PaydunyaWavePaymentSuccessResponse,
} from "../paydunya";

export const createInvoiceSuccessResponse: PaydunyaCreateInvoiceSuccessResponse =
  {
    description: "description",
    response_code: "00",
    response_text: "success",
    token: "token",
  };

export const creditCardInvoiceSuccessResponse: PaydunyaCreateInvoiceSuccessResponse =
  {
    description: "description",
    response_code: "00",
    response_text: "https://app.paydunya.com/sandbox/checkout/invoice/token",
    token: "token",
  };

export const wavePaymentSuccessResponse: PaydunyaWavePaymentSuccessResponse = {
  message: "success",
  success: true,
  url: "https://checkout.wave.com/checkout.js?token=token",
};

export const orangeMoneySuccessResponse: PaydunyaOrangeMoneyPaymentSuccessResponse =
  {
    currency: "XOF",
    fees: 0,
    message: "success",
    success: true,
  };

export const getWaveInvoiceSuccessResponse: PaydunyaGetInvoiceSuccessResponse = {
  actions: {
    cancel_url: "https://example.com/cancel",
    return_url: "https://example.com/return",
    callback_url: "https://example.com/callback",
  },
  custom_data: {
    text_meta: "value",
    number_meta: 1,
    boolean_meta: true,
  },
  customer: {
    name: "Mamadou Diallo",
    email: "mamadou.diallo@yopmail.com",
    payment_method: "wave_senegal",
    phone: "+221781234567",
  },
  fail_reason: "",
  hash: "hash",
  invoice: {
    description: "description",
    expire_date: "2021-08-31T00:00:00.000Z",
    pal_is_on: "",
    token: "token",
    total_amount: "100",
    total_amount_without_fees: "100",
  },
  mode: "live",
  receipt_url: "https://example.com/receipt",
  response_code: "00",
  response_text: "success",
  status: "completed",
};

export const createDisburseInvoiceSuccessResponse: PaydunyaCreateDisburseInvoiceSuccessResponse =
  {
    disburse_token: "disburse_token",
    response_code: "00",
  };

export const submitDisburseInvoiceSuccessResponse: PaydunyaSubmitDisburseInvoiceSuccessResponse =
  {
    description: "description",
    response_code: "00",
    response_text: "success",
    transaction_id: "transaction_id",
    provider_ref: "provider_ref",
  };
