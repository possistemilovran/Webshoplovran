/** Pretvori cm u inč (1 in = 2.54 cm). */
export function cmToInches(cm: number): number {
  return cm / 2.54;
}

function formatCmValue(cm: number): string {
  if (Number.isInteger(cm)) return String(cm);
  const s = cm.toFixed(1);
  return s.endsWith(".0") ? s.slice(0, -2) : s;
}

function formatInchValue(inches: number): string {
  const s = inches.toFixed(1);
  return s.endsWith(".0") ? s.slice(0, -2) : s;
}

/** Npr. "30 cm (11.8 in)" — za prikaz kupcu. */
export function formatCmWithInches(cm: number): string {
  const inch = cmToInches(cm);
  return `${formatCmValue(cm)} cm (${formatInchValue(inch)} in)`;
}
