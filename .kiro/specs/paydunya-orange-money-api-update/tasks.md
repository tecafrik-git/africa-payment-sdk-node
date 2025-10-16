# Implementation Plan

- [x] 1. Update TypeScript type definitions for Orange Money API
  - Update `OrangeMoneyCheckoutOptions` in `src/sdk/payment-provider.interface.ts` to make `authorizationCode` optional
  - Add new type `PaydunyaOrangeMoneyApiType` as union of `"CODE_OTP"` and `"QR_CODE"` literals in `src/sdk/providers/paydunya.ts`
  - Add `PaydunyaOrangeMoneyCodeOtpRequest` type with all required fields including `authorization_code` and `api_type: "CODE_OTP"`
  - Add `PaydunyaOrangeMoneyQrCodeRequest` type with required fields excluding `authorization_code` but including `api_type: "QR_CODE"`
  - Add union type `PaydunyaOrangeMoneyRequest` combining both request types
  - Update `PaydunyaOrangeMoneyPaymentSuccessResponse` to include optional `url` field for QR code flow redirects
  - _Requirements: 1.2, 1.3, 4.1, 4.2, 4.3_

- [x] 2. Implement flow detection and request payload builder
- [x] 2.1 Create private method to determine API type based on authorization code
  - Implement `determineOrangeMoneyApiType()` private method that takes `OrangeMoneyCheckoutOptions`
  - Return `"CODE_OTP"` when `authorizationCode` is provided and truthy
  - Return `"QR_CODE"` when `authorizationCode` is undefined, null, or empty
  - _Requirements: 2.1, 5.1, 6.1, 6.2_

- [x] 2.2 Create private method to build request payload
  - Implement `buildOrangeMoneyRequest()` private method that takes options, invoice token, and parsed phone number
  - Build base payload with common fields: `customer_name`, `customer_email`, `phone_number`, `invoice_token`, `api_type`
  - Conditionally add `authorization_code` field only when `api_type` is `"CODE_OTP"`
  - Return properly typed `PaydunyaOrangeMoneyRequest` object
  - _Requirements: 1.3, 5.1, 6.3_

- [x] 3. Update checkout method to use new Orange Money API endpoint
- [x] 3.1 Update Orange Money payment flow in checkout method
  - Replace endpoint `/v1/softpay/orange-money-senegal` with `/v1/softpay/new-orange-money-senegal`
  - Use `buildOrangeMoneyRequest()` method to construct request payload instead of inline object
  - Ensure request includes `api_type` field with correct value
  - _Requirements: 1.1, 1.2, 1.3_

- [x] 3.2 Handle QR code flow response with redirect URL
  - Check if response contains `url` field for QR code flow
  - Set `redirectUrl` in `CheckoutResult` when `url` is present in response
  - Maintain existing behavior for CODE_OTP flow (no redirect URL expected)
  - _Requirements: 1.4, 5.3_

- [x] 4. Update error handling for new endpoint
  - Update response transform in constructor to check for `/softpay/new-orange-money-senegal` endpoint
  - Ensure invalid OTP code error (422 status) is caught and throws `INVALID_AUTHORIZATION_CODE` error
  - Maintain existing error handling for other error scenarios
  - _Requirements: 2.2, 3.4_

- [x] 5. Update existing tests for new implementation
  - Update test fixtures in `src/sdk/providers/fixtures/paydunya.fixtures.ts` to use new endpoint path
  - Update existing Orange Money test cases to include `api_type` field in expected requests
  - Ensure existing test snapshots are updated to reflect new request structure
  - Verify all existing tests pass with updated implementation
  - _Requirements: 3.1, 3.2, 3.3_

- [x] 6. Add unit tests for new QR code flow and flow detection
- [x] 6.1 Write tests for flow detection logic
  - Test that `CODE_OTP` is selected when `authorizationCode` is provided
  - Test that `QR_CODE` is selected when `authorizationCode` is undefined
  - Test that `QR_CODE` is selected when `authorizationCode` is empty string
  - _Requirements: 6.1, 6.2_

- [x] 6.2 Write tests for request payload builder
  - Test CODE_OTP request includes `authorization_code` and `api_type: "CODE_OTP"`
  - Test QR_CODE request excludes `authorization_code` and includes `api_type: "QR_CODE"`
  - Test both requests include common fields correctly
  - _Requirements: 6.3_

- [x] 6.3 Write tests for QR code payment flow
  - Test successful QR code payment with redirect URL in response
  - Test successful QR code payment without redirect URL
  - Test QR code payment error handling
  - Test that CheckoutResult includes redirectUrl when provided by API
  - _Requirements: 5.3, 5.4_

- [x] 6.4 Write tests for backward compatibility
  - Test that existing code with `authorizationCode` still works correctly
  - Test that CODE_OTP flow produces same results as before
  - Test that error handling remains consistent
  - _Requirements: 3.1, 3.2, 3.3, 3.4_
