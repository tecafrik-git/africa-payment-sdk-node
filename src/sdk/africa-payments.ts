import { CheckoutOptions, PaymentProvider } from "./payment-provider.interface";

class AfricaPaymentsProvider {
  constructor(private provider: PaymentProvider) {}

  async checkout(options: CheckoutOptions) {
    return this.provider.checkout(options);
  }
}

export default AfricaPaymentsProvider;
