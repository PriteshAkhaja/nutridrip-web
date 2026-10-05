/**
 * A payment that must not start: the thing is not payable, not yours, already
 * paid, or payment is switched off. Its message is shown as it is.
 */
export class PaymentRefusal extends Error {
  constructor(
    message: string,
    readonly status = 409,
    readonly extra?: Record<string, unknown>
  ) {
    super(message);
    this.name = "PaymentRefusal";
  }
}

/**
 * Paid, but what it paid for can no longer be done -- the slot went while the
 * patient was paying, the order moved on. The payment is refunded in full and
 * this message says why.
 */
export class NotApplied extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotApplied";
  }
}
