import { Currency, PaymentMethod, TransactionStatus } from "../../payment-provider.interface";
import {
  createDisburseInvoiceSuccessResponse,
  createInvoiceSuccessResponse,
  creditCardInvoiceSuccessResponse,
  getWaveInvoiceSuccessResponse,
  orangeMoneySuccessResponse,
  orangeMoneyQrCodeSuccessResponseWithUrl,
  orangeMoneyQrCodeSuccessResponseWithoutUrl,
  submitDisburseInvoiceSuccessResponse,
  wavePaymentSuccessResponse,
} from "../fixtures/paydunya.fixtures";
import PaydunyaPaymentProvider from "../paydunya";
import apisauce from "apisauce";
import MockAdapter from "axios-mock-adapter";

let paydunyaPaymentProvider: PaydunyaPaymentProvider;
let mockApi: MockAdapter;

jest.mock<typeof apisauce>("apisauce", () => {
  const realApisauce = jest.requireActual<typeof apisauce>("apisauce");
  return {
    ...realApisauce,
    create: jest.fn((config) => {
      const api = realApisauce.create(config);
      mockApi = new MockAdapter(api.axiosInstance);
      return api;
    }),
  };
});

beforeEach(() => {
  paydunyaPaymentProvider = new PaydunyaPaymentProvider({
    masterKey: "masterKey",
    mode: "live",
    privateKey: "privateKey",
    publicKey: "publicKey",
    store: {
      name: "store-name",
    },
    token: "token",
    callbackUrl: "https://example.com/callback",
  });
});

afterEach(() => {
  mockApi.reset();
});

test("calls wave API and returns a checkout result on success", async () => {
  mockApi
    .onPost("/v1/checkout-invoice/create")
    .replyOnce(200, createInvoiceSuccessResponse);
  mockApi
    .onPost("/v1/softpay/wave-senegal")
    .replyOnce(200, wavePaymentSuccessResponse);
  const checkoutResult = await paydunyaPaymentProvider.checkoutMobileMoney({
    amount: 100,
    currency: Currency.XOF,
    customer: {
      firstName: "Mamadou",
      lastName: "Diallo",
      phoneNumber: "+221781234567",
    },
    description: "description",
    paymentMethod: PaymentMethod.WAVE,
    transactionId: "transactionId",
    successRedirectUrl: "https://example.com/success",
    failureRedirectUrl: "https://example.com/failure",
    metadata: {
      text_meta: "value",
      number_meta: 1,
      boolean_meta: true,
    },
  });

  expect(mockApi.history).toMatchSnapshot();
  expect(checkoutResult).toMatchSnapshot();
});

test("calls orange money API and returns a checkout result on success", async () => {
  mockApi
    .onPost("/v1/checkout-invoice/create")
    .replyOnce(200, createInvoiceSuccessResponse);
  mockApi
    .onPost("/v1/softpay/new-orange-money-senegal")
    .replyOnce(200, orangeMoneySuccessResponse);
  const checkoutResult = await paydunyaPaymentProvider.checkoutMobileMoney({
    amount: 100,
    currency: Currency.XOF,
    customer: {
      firstName: "Mamadou",
      lastName: "Diallo",
      phoneNumber: "+221781234567",
    },
    description: "description",
    paymentMethod: PaymentMethod.ORANGE_MONEY,
    transactionId: "transactionId",
    authorizationCode: "12345",
    successRedirectUrl: "https://example.com/success",
    failureRedirectUrl: "https://example.com/failure",
    metadata: {
      text_meta: "value",
      number_meta: 1,
      boolean_meta: true,
    },
  });

  expect(mockApi.history).toMatchSnapshot();
  expect(checkoutResult).toMatchSnapshot();
});

test("calls paydunya cc API and returns a checkout result on success", async () => {
  mockApi
    .onPost("/v1/checkout-invoice/create")
    .replyOnce(200, creditCardInvoiceSuccessResponse);
  const checkoutResult = await paydunyaPaymentProvider.checkoutCreditCard({
    amount: 100,
    currency: Currency.XOF,
    customer: {
      firstName: "Mamadou",
      lastName: "Diallo",
      email: "mamadou.diallo@yopmail.com",
    },
    description: "description",
    paymentMethod: PaymentMethod.CREDIT_CARD,
    transactionId: "transactionId",
    cardNumber: "4242424242424242",
    cardExpirationMonth: "12",
    cardExpirationYear: "2025",
    cardCvv: "123",
    successRedirectUrl: "https://example.com/success",
    failureRedirectUrl: "https://example.com/failure",
    metadata: {
      text_meta: "value",
      number_meta: 1,
      boolean_meta: true,
    },
  });

  expect(mockApi.history).toMatchSnapshot();
  expect(checkoutResult).toMatchSnapshot();
});

test("emits a payment initiated event when given an event emitter", async () => {
  const eventEmitter = {
    emit: jest.fn(),
  };
  paydunyaPaymentProvider.useEventEmitter(eventEmitter as any);
  mockApi
    .onPost("/v1/checkout-invoice/create")
    .replyOnce(200, createInvoiceSuccessResponse);
  mockApi
    .onPost("/v1/softpay/wave-senegal")
    .replyOnce(200, wavePaymentSuccessResponse);
  await paydunyaPaymentProvider.checkoutMobileMoney({
    amount: 100,
    currency: Currency.XOF,
    customer: {
      firstName: "Mamadou",
      lastName: "Diallo",
      phoneNumber: "+221781234567",
    },
    description: "description",
    paymentMethod: PaymentMethod.WAVE,
    transactionId: "transactionId",
    metadata: {
      text_meta: "value",
      number_meta: 1,
      boolean_meta: true,
    },
  });

  expect(eventEmitter.emit).toMatchSnapshot();
});

test("throws unsupported payment method error when using checkout redirect", async () => {
  await expect(
    paydunyaPaymentProvider.checkoutRedirect({
      amount: 100,
      currency: Currency.XOF,
      customer: {
        firstName: "Mamadou",
        lastName: "Diallo",
        email: "mamadou.diallo@yopmail.com",
      },
      description: "description",
      paymentMethod: PaymentMethod.CREDIT_CARD,
      transactionId: "transactionId",
      successRedirectUrl: "https://example.com/success",
      failureRedirectUrl: "https://example.com/failure",
    })
  ).rejects.toThrowErrorMatchingSnapshot();
});

test("refunds a wave transaction properly", async () => {
  mockApi
    .onGet(/\/v1\/checkout-invoice\/confirm\/.+/)
    .reply(200, getWaveInvoiceSuccessResponse);
  mockApi
    .onPost("/v2/disburse/get-invoice")
    .reply(200, createDisburseInvoiceSuccessResponse);

  mockApi
    .onPost("/v2/disburse/submit-invoice")
    .reply(200, submitDisburseInvoiceSuccessResponse);

  const refundResult = await paydunyaPaymentProvider.refund({
    transactionId: "transactionId",
    refundedTransactionReference: "wave-transaction-reference",
  });

  expect(mockApi.history).toMatchSnapshot();
  expect(refundResult).toMatchSnapshot();
});

test("makes a payout to the provided customer", async () => {
  mockApi
    .onPost("/v2/disburse/get-invoice")
    .reply(200, createDisburseInvoiceSuccessResponse);
  mockApi
    .onPost("/v2/disburse/submit-invoice")
    .reply(200, submitDisburseInvoiceSuccessResponse);

  const payoutResult = await paydunyaPaymentProvider.payoutMobileMoney({
    amount: 150,
    currency: Currency.XOF,
    paymentMethod: PaymentMethod.WAVE,
    recipient: {
      phoneNumber: "+221781234567",
    },
    transactionId: "transactionId",
    transactionReference: "transactionReference",
    metadata: {
      text_meta: "value",
      number_meta: 1,
      boolean_meta: true,
    },
  });

  expect(mockApi.history).toMatchSnapshot();
  expect(payoutResult).toMatchSnapshot();
});

describe("Orange Money flow detection", () => {
  test("selects OTPCODE flow when authorizationCode is provided", async () => {
    mockApi
      .onPost("/v1/checkout-invoice/create")
      .replyOnce(200, createInvoiceSuccessResponse);
    mockApi
      .onPost("/v1/softpay/new-orange-money-senegal")
      .replyOnce(200, orangeMoneySuccessResponse);

    await paydunyaPaymentProvider.checkoutMobileMoney({
      amount: 100,
      currency: Currency.XOF,
      customer: {
        firstName: "Mamadou",
        lastName: "Diallo",
        phoneNumber: "+221781234567",
      },
      description: "description",
      paymentMethod: PaymentMethod.ORANGE_MONEY,
      transactionId: "transactionId",
      authorizationCode: "123456",
    });

    const orangeMoneyRequest = mockApi.history.post.find(
      (req) => req.url === "/v1/softpay/new-orange-money-senegal"
    );
    const requestData = JSON.parse(orangeMoneyRequest?.data || "{}");

    expect(requestData.api_type).toBe("OTPCODE");
    expect(requestData.authorization_code).toBe("123456");
  });

  test("selects QRCODE flow when authorizationCode is undefined", async () => {
    mockApi
      .onPost("/v1/checkout-invoice/create")
      .replyOnce(200, createInvoiceSuccessResponse);
    mockApi
      .onPost("/v1/softpay/new-orange-money-senegal")
      .replyOnce(200, orangeMoneySuccessResponse);

    await paydunyaPaymentProvider.checkoutMobileMoney({
      amount: 100,
      currency: Currency.XOF,
      customer: {
        firstName: "Mamadou",
        lastName: "Diallo",
        phoneNumber: "+221781234567",
      },
      description: "description",
      paymentMethod: PaymentMethod.ORANGE_MONEY,
      transactionId: "transactionId",
      // authorizationCode is undefined
    });

    const orangeMoneyRequest = mockApi.history.post.find(
      (req) => req.url === "/v1/softpay/new-orange-money-senegal"
    );
    const requestData = JSON.parse(orangeMoneyRequest?.data || "{}");

    expect(requestData.api_type).toBe("QRCODE");
    expect(requestData.authorization_code).toBeUndefined();
  });

  test("selects QRCODE flow when authorizationCode is empty string", async () => {
    mockApi
      .onPost("/v1/checkout-invoice/create")
      .replyOnce(200, createInvoiceSuccessResponse);
    mockApi
      .onPost("/v1/softpay/new-orange-money-senegal")
      .replyOnce(200, orangeMoneySuccessResponse);

    await paydunyaPaymentProvider.checkoutMobileMoney({
      amount: 100,
      currency: Currency.XOF,
      customer: {
        firstName: "Mamadou",
        lastName: "Diallo",
        phoneNumber: "+221781234567",
      },
      description: "description",
      paymentMethod: PaymentMethod.ORANGE_MONEY,
      transactionId: "transactionId",
      authorizationCode: "",
    });

    const orangeMoneyRequest = mockApi.history.post.find(
      (req) => req.url === "/v1/softpay/new-orange-money-senegal"
    );
    const requestData = JSON.parse(orangeMoneyRequest?.data || "{}");

    expect(requestData.api_type).toBe("QRCODE");
    expect(requestData.authorization_code).toBeUndefined();
  });
});

describe("Orange Money request payload builder", () => {
  test("OTPCODE request includes all common fields correctly", async () => {
    mockApi
      .onPost("/v1/checkout-invoice/create")
      .replyOnce(200, createInvoiceSuccessResponse);
    mockApi
      .onPost("/v1/softpay/new-orange-money-senegal")
      .replyOnce(200, orangeMoneySuccessResponse);

    await paydunyaPaymentProvider.checkoutMobileMoney({
      amount: 100,
      currency: Currency.XOF,
      customer: {
        firstName: "Mamadou",
        lastName: "Diallo",
        phoneNumber: "+221781234567",
      },
      description: "description",
      paymentMethod: PaymentMethod.ORANGE_MONEY,
      transactionId: "transactionId",
      authorizationCode: "123456",
    });

    const orangeMoneyRequest = mockApi.history.post.find(
      (req) => req.url === "/v1/softpay/new-orange-money-senegal"
    );
    const requestData = JSON.parse(orangeMoneyRequest?.data || "{}");

    expect(requestData.customer_name).toBe("Mamadou Diallo");
    expect(requestData.customer_email).toBe("+221781234567@yopmail.com");
    expect(requestData.phone_number).toBe("781234567");
    expect(requestData.invoice_token).toBe(createInvoiceSuccessResponse.token);
    expect(requestData.api_type).toBe("OTPCODE");
    expect(requestData.authorization_code).toBe("123456");
  });

  test("QRCODE request includes all common fields correctly and excludes authorization_code", async () => {
    mockApi
      .onPost("/v1/checkout-invoice/create")
      .replyOnce(200, createInvoiceSuccessResponse);
    mockApi
      .onPost("/v1/softpay/new-orange-money-senegal")
      .replyOnce(200, orangeMoneySuccessResponse);

    await paydunyaPaymentProvider.checkoutMobileMoney({
      amount: 100,
      currency: Currency.XOF,
      customer: {
        firstName: "Mamadou",
        lastName: "Diallo",
        phoneNumber: "+221781234567",
      },
      description: "description",
      paymentMethod: PaymentMethod.ORANGE_MONEY,
      transactionId: "transactionId",
      // authorizationCode not provided
    });

    const orangeMoneyRequest = mockApi.history.post.find(
      (req) => req.url === "/v1/softpay/new-orange-money-senegal"
    );
    const requestData = JSON.parse(orangeMoneyRequest?.data || "{}");

    expect(requestData.customer_name).toBe("Mamadou Diallo");
    expect(requestData.customer_email).toBe("+221781234567@yopmail.com");
    expect(requestData.phone_number).toBe("781234567");
    expect(requestData.invoice_token).toBe(createInvoiceSuccessResponse.token);
    expect(requestData.api_type).toBe("QRCODE");
    expect(requestData).not.toHaveProperty("authorization_code");
  });
});

describe("Orange Money QR code payment flow", () => {
  test("successful QR code payment with redirect URL in response", async () => {
    mockApi
      .onPost("/v1/checkout-invoice/create")
      .replyOnce(200, createInvoiceSuccessResponse);
    mockApi
      .onPost("/v1/softpay/new-orange-money-senegal")
      .replyOnce(200, orangeMoneyQrCodeSuccessResponseWithUrl);

    const checkoutResult = await paydunyaPaymentProvider.checkoutMobileMoney({
      amount: 5000,
      currency: Currency.XOF,
      customer: {
        firstName: "Alioune",
        lastName: "Faye",
        phoneNumber: "+221774563209",
      },
      description: "QR code payment test",
      paymentMethod: PaymentMethod.ORANGE_MONEY,
      transactionId: "test-txn-qr-001",
      // No authorizationCode - triggers QR_CODE flow
    });

    expect(checkoutResult.redirectUrl).toBe(
      "https://qr.paydunya.com/checkout?token=qr-token-123"
    );
    expect(checkoutResult.transactionStatus).toBe(TransactionStatus.PENDING);
    expect(checkoutResult.transactionAmount).toBe(5000);
    expect(checkoutResult.transactionCurrency).toBe(Currency.XOF);
    expect(checkoutResult.transactionId).toBe("test-txn-qr-001");
  });

  test("successful QR code payment without redirect URL", async () => {
    mockApi
      .onPost("/v1/checkout-invoice/create")
      .replyOnce(200, createInvoiceSuccessResponse);
    mockApi
      .onPost("/v1/softpay/new-orange-money-senegal")
      .replyOnce(200, orangeMoneyQrCodeSuccessResponseWithoutUrl);

    const checkoutResult = await paydunyaPaymentProvider.checkoutMobileMoney({
      amount: 3000,
      currency: Currency.XOF,
      customer: {
        firstName: "Alioune",
        lastName: "Faye",
        phoneNumber: "+221774563209",
      },
      description: "QR code payment without URL",
      paymentMethod: PaymentMethod.ORANGE_MONEY,
      transactionId: "test-txn-qr-002",
      // No authorizationCode - triggers QR_CODE flow
    });

    expect(checkoutResult.redirectUrl).toBeUndefined();
    expect(checkoutResult.transactionStatus).toBe(TransactionStatus.PENDING);
    expect(checkoutResult.transactionAmount).toBe(3000);
    expect(checkoutResult.transactionCurrency).toBe(Currency.XOF);
    expect(checkoutResult.transactionId).toBe("test-txn-qr-002");
  });

  test("QR code payment error handling", async () => {
    mockApi
      .onPost("/v1/checkout-invoice/create")
      .replyOnce(200, createInvoiceSuccessResponse);
    mockApi
      .onPost("/v1/softpay/new-orange-money-senegal")
      .replyOnce(500, {
        success: false,
        message: "Payment processing failed",
      });

    await expect(
      paydunyaPaymentProvider.checkoutMobileMoney({
        amount: 2000,
        currency: Currency.XOF,
        customer: {
          firstName: "Alioune",
          lastName: "Faye",
          phoneNumber: "+221774563209",
        },
        description: "QR code payment error test",
        paymentMethod: PaymentMethod.ORANGE_MONEY,
        transactionId: "test-txn-qr-error",
        // No authorizationCode - triggers QR_CODE flow
      })
    ).rejects.toThrow("Payment processing failed");
  });

  test("CheckoutResult includes redirectUrl when provided by API", async () => {
    mockApi
      .onPost("/v1/checkout-invoice/create")
      .replyOnce(200, createInvoiceSuccessResponse);
    mockApi
      .onPost("/v1/softpay/new-orange-money-senegal")
      .replyOnce(200, orangeMoneyQrCodeSuccessResponseWithUrl);

    const checkoutResult = await paydunyaPaymentProvider.checkoutMobileMoney({
      amount: 7500,
      currency: Currency.XOF,
      customer: {
        firstName: "Alioune",
        lastName: "Faye",
        phoneNumber: "+221774563209",
      },
      description: "QR code with redirect URL",
      paymentMethod: PaymentMethod.ORANGE_MONEY,
      transactionId: "test-txn-qr-003",
    });

    // Verify that redirectUrl is properly included in CheckoutResult
    expect(checkoutResult).toHaveProperty("redirectUrl");
    expect(checkoutResult.redirectUrl).toBe(
      "https://qr.paydunya.com/checkout?token=qr-token-123"
    );
    
    // Verify all other required fields are present
    expect(checkoutResult).toHaveProperty("transactionId");
    expect(checkoutResult).toHaveProperty("transactionReference");
    expect(checkoutResult).toHaveProperty("transactionStatus");
    expect(checkoutResult).toHaveProperty("transactionAmount");
    expect(checkoutResult).toHaveProperty("transactionCurrency");
  });
});

describe("Backward compatibility", () => {
  test("existing code with authorizationCode still works correctly", async () => {
    mockApi
      .onPost("/v1/checkout-invoice/create")
      .replyOnce(200, createInvoiceSuccessResponse);
    mockApi
      .onPost("/v1/softpay/new-orange-money-senegal")
      .replyOnce(200, orangeMoneySuccessResponse);

    // This is how existing code would call the API with authorizationCode
    const checkoutResult = await paydunyaPaymentProvider.checkoutMobileMoney({
      amount: 100,
      currency: Currency.XOF,
      customer: {
        firstName: "Mamadou",
        lastName: "Diallo",
        phoneNumber: "+221781234567",
      },
      description: "description",
      paymentMethod: PaymentMethod.ORANGE_MONEY,
      transactionId: "transactionId",
      authorizationCode: "12345",
      successRedirectUrl: "https://example.com/success",
      failureRedirectUrl: "https://example.com/failure",
      metadata: {
        text_meta: "value",
        number_meta: 1,
        boolean_meta: true,
      },
    });

    // Verify the result structure is consistent with previous implementation
    expect(checkoutResult).toHaveProperty("transactionId");
    expect(checkoutResult).toHaveProperty("transactionReference");
    expect(checkoutResult).toHaveProperty("transactionStatus");
    expect(checkoutResult).toHaveProperty("transactionAmount");
    expect(checkoutResult).toHaveProperty("transactionCurrency");
    expect(checkoutResult.transactionId).toBe("transactionId");
    expect(checkoutResult.transactionStatus).toBe(TransactionStatus.PENDING);
    expect(checkoutResult.transactionAmount).toBe(100);
    expect(checkoutResult.transactionCurrency).toBe(Currency.XOF);
  });

  test("OTPCODE flow produces same results as before", async () => {
    mockApi
      .onPost("/v1/checkout-invoice/create")
      .replyOnce(200, createInvoiceSuccessResponse);
    mockApi
      .onPost("/v1/softpay/new-orange-money-senegal")
      .replyOnce(200, orangeMoneySuccessResponse);

    const checkoutResult = await paydunyaPaymentProvider.checkoutMobileMoney({
      amount: 5000,
      currency: Currency.XOF,
      customer: {
        firstName: "Alioune",
        lastName: "Faye",
        phoneNumber: "+221774563209",
      },
      description: "Test payment",
      paymentMethod: PaymentMethod.ORANGE_MONEY,
      transactionId: "test-backward-compat-001",
      authorizationCode: "654321",
    });

    // Verify the request was made with OTPCODE api_type
    const orangeMoneyRequest = mockApi.history.post.find(
      (req) => req.url === "/v1/softpay/new-orange-money-senegal"
    );
    const requestData = JSON.parse(orangeMoneyRequest?.data || "{}");
    expect(requestData.api_type).toBe("OTPCODE");
    expect(requestData.authorization_code).toBe("654321");

    // Verify the result structure matches expected format
    expect(checkoutResult.transactionId).toBe("test-backward-compat-001");
    expect(checkoutResult.transactionReference).toBe(
      createInvoiceSuccessResponse.token
    );
    expect(checkoutResult.transactionStatus).toBe(TransactionStatus.PENDING);
    expect(checkoutResult.transactionAmount).toBe(5000);
    expect(checkoutResult.transactionCurrency).toBe(Currency.XOF);
    
    // OTPCODE flow should not have redirectUrl
    expect(checkoutResult.redirectUrl).toBeUndefined();
  });

  test("error handling remains consistent for invalid authorization code", async () => {
    mockApi
      .onPost("/v1/checkout-invoice/create")
      .replyOnce(200, createInvoiceSuccessResponse);
    mockApi
      .onPost("/v1/softpay/new-orange-money-senegal")
      .replyOnce(422, {
        success: false,
        message: "Invalid or expired OTP code!",
      });

    await expect(
      paydunyaPaymentProvider.checkoutMobileMoney({
        amount: 1000,
        currency: Currency.XOF,
        customer: {
          firstName: "Test",
          lastName: "User",
          phoneNumber: "+221781234567",
        },
        description: "Test invalid OTP",
        paymentMethod: PaymentMethod.ORANGE_MONEY,
        transactionId: "test-invalid-otp",
        authorizationCode: "invalid-code",
      })
    ).rejects.toThrow("Invalid or expired OTP code!");
  });

  test("error handling remains consistent for general API errors", async () => {
    mockApi
      .onPost("/v1/checkout-invoice/create")
      .replyOnce(200, createInvoiceSuccessResponse);
    mockApi
      .onPost("/v1/softpay/new-orange-money-senegal")
      .replyOnce(500, {
        success: false,
        message: "Internal server error",
      });

    await expect(
      paydunyaPaymentProvider.checkoutMobileMoney({
        amount: 2000,
        currency: Currency.XOF,
        customer: {
          firstName: "Test",
          lastName: "User",
          phoneNumber: "+221781234567",
        },
        description: "Test server error",
        paymentMethod: PaymentMethod.ORANGE_MONEY,
        transactionId: "test-server-error",
        authorizationCode: "123456",
      })
    ).rejects.toThrow("Internal server error");
  });

  test("error handling remains consistent for invalid phone number", async () => {
    await expect(
      paydunyaPaymentProvider.checkoutMobileMoney({
        amount: 1000,
        currency: Currency.XOF,
        customer: {
          firstName: "Test",
          lastName: "User",
          phoneNumber: "invalid-phone",
        },
        description: "Test invalid phone",
        paymentMethod: PaymentMethod.ORANGE_MONEY,
        transactionId: "test-invalid-phone",
        authorizationCode: "123456",
      })
    ).rejects.toThrow();
  });
});
