import AfricaPaymentsProvider from "./src/sdk/africa-payments";
import PaydunyaPaymentProvider from "./src/sdk/providers/paydunya";
import StripePaymentProvider from "./src/sdk/providers/stripe";
import BogusPaymentProvider from "./src/sdk/providers/bogus";
import TaarihPaymentProvider from "./src/sdk/providers/taarih";
import { Currency, PaymentMethod } from "./src/sdk/payment-provider.interface";

export default AfricaPaymentsProvider;
export {
  AfricaPaymentsProvider,
  PaydunyaPaymentProvider,
  StripePaymentProvider,
  BogusPaymentProvider,
  TaarihPaymentProvider,
};

export * from "./src/sdk/payment-provider.interface";
export * from "./src/sdk/providers/paydunya";
export * from "./src/sdk/providers/stripe";
export * from "./src/sdk/providers/bogus";
export * from "./src/sdk/providers/taarih";
export * from "./src/sdk/payment-events";
export * from "./src/sdk/payment-error";

const a = new AfricaPaymentsProvider(
  new TaarihPaymentProvider({
    phoneNumber: "773080892",
    password: "2025",
    mode: "test",
    callingCode: "+221",
    visitorId: "8e5604af-99db-47a5-b5e9-465040486690",
  })
);

async function main() {
  const checkout = await a.checkoutMobileMoney({
    amount: 100,
    currency: Currency.XOF,
    description: "Test payment",
    transactionId: "",
    customer: {
      firstName: "John",
      lastName: "Doe",
      phoneNumber: "771234567",
      email: "john.doe@example.com",
    },
    paymentMethod: PaymentMethod.WAVE,
  });
  console.log({ checkout });
  setTimeout(async () => {
    const callback = await a.callback(checkout.transactionReference);
    console.log({ callback });
  }, 10000);
}
main();
