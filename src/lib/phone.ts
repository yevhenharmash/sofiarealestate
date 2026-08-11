// Loose international phone check: optional leading +, 7-15 digits after
// stripping spaces/dashes. Not Bulgaria-specific — owners and renters here
// aren't necessarily calling from a Bulgarian number.
const PHONE_REGEX = /^\+?\d{7,15}$/

export function normalizePhone(raw: string): string {
  return raw.replace(/[\s-]/g, '')
}

export function isValidMobilePhone(raw: string): boolean {
  return PHONE_REGEX.test(normalizePhone(raw))
}
