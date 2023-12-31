# Synopsis

Payment methods in Africa are fragmented and payment providers are even more fragmented, but your software does not have to be. This SDK aims to provide a unified API to talk to any payment provider in the continent so you can focus on making your product better.

You will still need an account with any providers you intend to use, the SDK only acts as a bridge to the provider.

## Quick Start

- Install the SDK from npm

```bash
npm i @tecafrik/africa-payment-sdk
```

- Instantiate the SDK with one of the providers

```typescript
import AfricaPayments, {
  PaydunyaPaymentProvider,
} from "@tecafrik/africa-payment-sdk";

const africaPayments = new AfricaPayments(
  new PaydunyaPaymentProvider({
    masterKey: "<<YOUR_PAYDUNYA_MASTER_KEY>>",
    privateKey: "<<YOUR_PAYDUNYA_PRIVATE_KEY>>",
    publicKey: "<<YOUR_PAYDUNYA_PUBLIC_KEY>>",
    token: "<<YOUR_PAYDUNYA_TOKEN>>",
    mode: "live",
    store: {
      name: "Electronics Shop",
    },
  })
);
```

- Checkout so your users can pay

```typescript
const checkoutResult = await africaPayments.checkout({
  paymentMethod: PaymentMethod.WAVE,
  amount: 500,
  description: "Achat de téléphone",
  currency: Currency.XOF,
  customer: {
    firstName: "Mamadou",
    lastName: "Diop",
    phoneNumber: "+221771234567",
  },
  transactionId: "12314214",
  metadata: {
    orderId: "321421",
  },
});
```

Depending on the provider, the `checkoutResult` may contain a `redirectUrl` that you will need to redirect the user to in order to finish the payment

- Handle webhooks and listen for events

```typescript
// body comes from the raw request body (buffer or string) sent by the provider to your webhook endpoint
// you will need to configure that endpoint in the provider's interface most likely
africaPayments.handleWebhook(body);
africaPayments.on(PaymentEventType.PAYMENT_SUCCESSFUL, async (event) => {
  const orderId = event.metadata?.orderId;
  if (!orderId) {
    return;
  }
  await Order.update(
    {
      id: orderId,
    },
    {
      status: "PAID",
      transactionReference: event.transactionReference,
    }
  );
});
```


## Test with the bogus payment provider

In a testing environment, you do not want to make actual payments. Not all payment providers provide a sandbox mode and even when they do, not all of the features in the sandbox are testable. For integration tests you most likely don't want to involve external APIs, even sandbox ones.

That's why we made a `BogusPaymentProvider` that fakes all the checkout methods and webhook handling logic. It follows simple rules:
- For mobile money checkout, any phone number that ends with `13` will trigger a payment failure event and redirect to the failure url
- For credit card checkout, any card number that ends with `13` will trigger a payment failure event and redirect to the failure url
- For redirect checkout, any email that ends with `@failure.com` will trigger a payment failure event and redirect to the failure url
- Anything else will trigger a success event and redirect to the success url

This is when the `instantEvents` config is set to `true`. You can however opt into a more manual success/failure trigger mechanism by calling `handleWebhook` with various body payloads. The schema for the body can be found under the typescript type `BogusPaymentProviderWebhookBody`.

## API Reference

Coming soon. The project is written in TypeScript so feel free to browse the API via your IDE's intellisense features.
