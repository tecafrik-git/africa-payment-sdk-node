import { Currency, PaymentMethod } from "../../payment-provider.interface";
import {
  createDisburseInvoiceSuccessResponse,
  createInvoiceSuccessResponse,
  creditCardInvoiceSuccessResponse,
  getWaveInvoiceSuccessResponse,
  orangeMoneySuccessResponse,
  submitDisburseInvoiceSuccessResponse,
  wavePaymentSuccessResponse,
} from "../fixtures/paydunya.fixtures";
import PaydunyaPaymentProvider from "../paydunya";
import apisauce from "apisauce";
import MockAdapter from "axios-mock-adapter";

let paydunyaPaymentProvider: PaydunyaPaymentProvider;
let mockApi: MockAdapter;

jest.mock<Pick<typeof apisauce, "create">>("apisauce", () => {
  return {
    create: jest.fn((config) => {
      const realApisauce = jest.requireActual<typeof apisauce>("apisauce");
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
  });
});

afterEach(() => {
  mockApi.reset();
});

test("calls wave API and returns a checkout result on success", async () => {
  mockApi
    .onPost("/checkout-invoice/create")
    .replyOnce(200, createInvoiceSuccessResponse);
  mockApi
    .onPost("/softpay/wave-senegal")
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
    .onPost("/checkout-invoice/create")
    .replyOnce(200, createInvoiceSuccessResponse);
  mockApi
    .onPost("/softpay/orange-money-senegal")
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
    .onPost("/checkout-invoice/create")
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
    .onPost("/checkout-invoice/create")
    .replyOnce(200, createInvoiceSuccessResponse);
  mockApi
    .onPost("/softpay/wave-senegal")
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
    .onGet(/\/checkout-invoice\/confirm\/.+/)
    .reply(200, getWaveInvoiceSuccessResponse);
  mockApi
    .onPost("/disburse/get-invoice")
    .reply(200, createDisburseInvoiceSuccessResponse);

  mockApi
    .onPost("/disburse/submit-invoice")
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
    .onPost("/disburse/get-invoice")
    .reply(200, createDisburseInvoiceSuccessResponse);
  mockApi
    .onPost("/disburse/submit-invoice")
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
