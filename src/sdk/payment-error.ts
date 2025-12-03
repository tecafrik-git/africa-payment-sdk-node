export class PaymentError extends Error {
  public readonly type: PaymentErrorType;
  constructor(
    message: string,
    type: PaymentErrorType = PaymentErrorType.UNKNOWN_ERROR
  ) {
    super(message);
    this.type = type;
  }
}

export enum PaymentErrorType {
  INVALID_AUTHORIZATION_CODE = "INVALID_AUTHORIZATION_CODE",
  UNSUPPORTED_PAYMENT_METHOD = "UNSUPPORTED_PAYMENT_METHOD",
  INVALID_PHONE_NUMBER = "INVALID_PHONE_NUMBER",
  UNKNOWN_ERROR = "UNKNOWN_ERROR",
  INVALID_OPERATION_CODE = "INVALID_OPERATION_CODE",
}
