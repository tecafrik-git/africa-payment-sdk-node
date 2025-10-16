# Design Document

## Overview

This design document outlines the implementation approach for updating the Paydunya payment provider to support the new Orange Money Senegal API endpoint with both `OTPCODE` and `QRCODE` payment flows. The solution maintains backward compatibility while adding new capabilities through intelligent flow detection based on the presence of an authorization code.

### Key Design Decisions

1. **Automatic Flow Selection**: The system will automatically determine which flow to use based on whether `authorizationCode` is provided in the checkout options
2. **Interface Modification**: The `OrangeMoneyCheckoutOptions` type will be updated to make `authorizationCode` optional instead of required
3. **Endpoint Migration**: All Orange Money Senegal requests will use the new `/v1/softpay/new-orange-money-senegal` endpoint
4. **Type Safety**: New TypeScript types will be introduced to represent the different API request/response structures

## Architecture

### Flow Selection Logic

```
┌─────────────────────────────────────┐
│  checkoutMobileMoney() called       │
│  with Orange Money payment method   │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  Check if authorizationCode exists  │
└──────────────┬──────────────────────┘
               │
       ┌───────┴───────┐
       │               │
       ▼               ▼
┌─────────────┐  ┌─────────────┐
│ OTPCODE    │  │  QRCODE    │
│ Flow        │  │  Flow       │
└──────┬──────┘  └──────┬──────┘
       │                │
       └────────┬───────┘
                ▼
    ┌──────────────────────┐
    │ POST to new endpoint │
    │ with api_type field  │
    └──────────────────────┘
```

### Component Interaction

```
┌──────────────────┐
│   Application    │
│      Code        │
└────────┬─────────┘
         │
         ▼
┌──────────────────────────────┐
│  PaydunyaPaymentProvider     │
│  - checkout()                │
│  - checkoutMobileMoney()     │
└────────┬─────────────────────┘
         │
         ▼
┌──────────────────────────────┐
│  Orange Money Flow Logic     │
│  - detectFlow()              │
│  - buildRequestPayload()     │
└────────┬─────────────────────┘
         │
         ▼
┌──────────────────────────────┐
│  Apisauce HTTP Client        │
│  POST /v1/softpay/           │
│  new-orange-money-senegal    │
└──────────────────────────────┘
```

## Components and Interfaces

### 1. Type Definitions

#### Updated OrangeMoneyCheckoutOptions

```typescript
type OrangeMoneyCheckoutOptions = BasicMobileMoneyCheckoutOptions & {
  paymentMethod: PaymentMethod.ORANGE_MONEY;
  authorizationCode?: string; // Changed from required to optional
};
```

#### New API Request Types

```typescript
type PaydunyaOrangeMoneyApiType = "OTPCODE" | "QRCODE";

type PaydunyaOrangeMoneyCodeOtpRequest = {
  customer_name: string;
  customer_email: string;
  phone_number: string;
  authorization_code: string;
  invoice_token: string;
  api_type: "OTPCODE";
};

type PaydunyaOrangeMoneyQrCodeRequest = {
  customer_name: string;
  customer_email: string;
  phone_number: string;
  invoice_token: string;
  api_type: "QRCODE";
};

type PaydunyaOrangeMoneyRequest =
  | PaydunyaOrangeMoneyCodeOtpRequest
  | PaydunyaOrangeMoneyQrCodeRequest;
```

#### Response Types

Based on the documentation, both flows return similar success responses. We'll verify if the QRCODE flow returns a `url` field like Wave does:

```typescript
type PaydunyaOrangeMoneyPaymentSuccessResponse = {
  success: true;
  message: string;
  fees?: number;
  currency?: string;
  url?: string; // May be present for QRCODE flow
};

type PaydunyaOrangeMoneyPaymentErrorResponse = {
  success: false | undefined;
  message: string;
};
```

### 2. Implementation Changes

#### Checkout Method Modifications

The `checkout()` method in `PaydunyaPaymentProvider` will be updated to:

1. Detect which Orange Money flow to use based on `authorizationCode` presence
2. Build the appropriate request payload with the correct `api_type`
3. Handle responses from both flows consistently

#### Flow Detection Logic

```typescript
private determineOrangeMoneyApiType(
  options: OrangeMoneyCheckoutOptions
): PaydunyaOrangeMoneyApiType {
  return options.authorizationCode ? "OTPCODE" : "QRCODE";
}
```

#### Request Payload Construction

```typescript
private buildOrangeMoneyRequest(
  options: OrangeMoneyCheckoutOptions,
  invoiceToken: string,
  parsedPhoneNumber: PhoneNumber
): PaydunyaOrangeMoneyRequest {
  const apiType = this.determineOrangeMoneyApiType(options);
  const basePayload = {
    customer_name: `${options.customer.firstName || ""} ${
      options.customer.lastName || ""
    }`.trim(),
    customer_email: `${options.customer.phoneNumber}@yopmail.com`,
    phone_number: parsedPhoneNumber.nationalNumber,
    invoice_token: invoiceToken,
    api_type: apiType,
  };

  if (apiType === "OTPCODE") {
    return {
      ...basePayload,
      authorization_code: options.authorizationCode!,
      api_type: "OTPCODE",
    };
  }

  return {
    ...basePayload,
    api_type: "QRCODE",
  };
}
```

### 3. Error Handling Updates

#### Response Transform

The existing response transform that handles invalid OTP codes needs to be updated to work with the new endpoint:

```typescript
this.api.addResponseTransform((response) => {
  if (
    response.config?.url?.endsWith("/softpay/new-orange-money-senegal") &&
    response.status === 422 &&
    response.data?.message === "Invalid or expired OTP code!"
  ) {
    throw new PaymentError(
      response.data.message,
      PaymentErrorType.INVALID_AUTHORIZATION_CODE
    );
  }
  // ... rest of error handling
});
```

### 4. Backward Compatibility

To ensure backward compatibility:

1. **Existing Code**: Applications currently passing `authorizationCode` will continue to work without changes, using the `OTPCODE` flow
2. **Type Safety**: TypeScript will not break existing code since we're making `authorizationCode` optional (less restrictive)
3. **Runtime Behavior**: The flow selection logic ensures the correct API call is made based on the provided options

## Data Models

### Request Flow Data

```typescript
// Input from application
MobileMoneyCheckoutOptions {
  paymentMethod: PaymentMethod.ORANGE_MONEY,
  authorizationCode?: string,  // Optional
  amount: number,
  customer: { phoneNumber, firstName, lastName },
  // ... other fields
}

// Internal processing
PaydunyaOrangeMoneyRequest {
  customer_name: string,
  customer_email: string,
  phone_number: string,
  invoice_token: string,
  api_type: "OTPCODE" | "QRCODE",
  authorization_code?: string,  // Only for OTPCODE
}

// Output to application
CheckoutResult {
  transactionId: string,
  transactionReference: string,
  transactionStatus: TransactionStatus.PENDING,
  transactionAmount: number,
  transactionCurrency: Currency.XOF,
  redirectUrl?: string,  // May be present for QRCODE flow
}
```

## Error Handling

### Error Scenarios

1. **Invalid Authorization Code (OTPCODE flow)**
   - HTTP Status: 422
   - Message: "Invalid or expired OTP code!"
   - Error Type: `PaymentErrorType.INVALID_AUTHORIZATION_CODE`

2. **Invalid Phone Number**
   - Thrown before API call
   - Error Type: `PaymentErrorType.INVALID_PHONE_NUMBER`

3. **API Request Failure**
   - Generic PaymentError with message from API response
   - Falls back to default error message if response is malformed

4. **Missing Response Data**
   - PaymentError: "Paydunya error: no payment response data"

### Error Handling Strategy

- Maintain existing error handling patterns
- Update endpoint check in response transform to use new endpoint path
- Ensure both flows throw consistent error types for similar failures

## Testing Strategy

### Unit Tests

1. **Flow Detection Tests**
   - Test that `OTPCODE` is selected when `authorizationCode` is provided
   - Test that `QRCODE` is selected when `authorizationCode` is undefined
   - Test that `QRCODE` is selected when `authorizationCode` is empty string

2. **Request Payload Tests**
   - Verify `OTPCODE` request includes `authorization_code` field
   - Verify `QRCODE` request excludes `authorization_code` field
   - Verify both requests include correct `api_type` value
   - Verify common fields are present in both request types

3. **Response Handling Tests**
   - Test successful `OTPCODE` payment response
   - Test successful `QRCODE` payment response with URL
   - Test successful `QRCODE` payment response without URL
   - Test error responses for both flows

4. **Error Handling Tests**
   - Test invalid OTP code error with new endpoint
   - Test invalid phone number error
   - Test API failure scenarios

5. **Backward Compatibility Tests**
   - Test existing code with `authorizationCode` still works
   - Test that CheckoutResult structure remains consistent

### Integration Tests

1. **End-to-End Flow Tests**
   - Test complete `OTPCODE` payment flow from checkout to webhook
   - Test complete `QRCODE` payment flow from checkout to webhook
   - Verify event emissions for both flows

2. **API Integration Tests**
   - Test actual API calls to sandbox environment (if available)
   - Verify request/response formats match documentation

### Test Data

```typescript
// OTPCODE test case
const codeOtpOptions: OrangeMoneyCheckoutOptions = {
  paymentMethod: PaymentMethod.ORANGE_MONEY,
  authorizationCode: "123456",
  amount: 5000,
  currency: Currency.XOF,
  transactionId: "test-txn-001",
  customer: {
    firstName: "Alioune",
    lastName: "Faye",
    phoneNumber: "+221774563209",
  },
};

// QRCODE test case
const qrCodeOptions: OrangeMoneyCheckoutOptions = {
  paymentMethod: PaymentMethod.ORANGE_MONEY,
  // authorizationCode not provided
  amount: 5000,
  currency: Currency.XOF,
  transactionId: "test-txn-002",
  customer: {
    firstName: "Alioune",
    lastName: "Faye",
    phoneNumber: "+221774563209",
  },
};
```

## Migration Notes

### For SDK Users

1. **No Breaking Changes**: Existing code will continue to work without modifications
2. **New Capability**: Users can now omit `authorizationCode` to use QR code flow
3. **Type Updates**: TypeScript users will see `authorizationCode` as optional in their IDE

### For SDK Maintainers

1. **Endpoint Update**: Old endpoint `/v1/softpay/orange-money-senegal` is replaced with `/v1/softpay/new-orange-money-senegal`
2. **New Field**: All Orange Money requests now include `api_type` field
3. **Response Handling**: QR code flow may return a `url` field for redirect

## Implementation Checklist

- [ ] Update `OrangeMoneyCheckoutOptions` type to make `authorizationCode` optional
- [ ] Define new TypeScript types for API requests and responses
- [ ] Implement flow detection logic
- [ ] Implement request payload builder for both flows
- [ ] Update endpoint path in checkout method
- [ ] Update error handling response transform for new endpoint
- [ ] Handle `redirectUrl` from QR code flow response
- [ ] Update existing tests to work with new implementation
- [ ] Add new tests for QR code flow
- [ ] Add tests for flow detection logic
- [ ] Update documentation/comments in code
