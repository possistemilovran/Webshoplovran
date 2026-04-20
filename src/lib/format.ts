export function formatMoney(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

/** Replaces `{gift}` and `{amount}` in cart/checkout copy from site settings. */
export function fillCartPlaceholders(
  template: string,
  giftTitle: string,
  amountFormatted: string
): string {
  return template
    .replace(/\{gift\}/g, giftTitle)
    .replace(/\{amount\}/g, amountFormatted);
}
