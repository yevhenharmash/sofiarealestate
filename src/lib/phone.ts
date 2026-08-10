// Matches Bulgarian mobile numbers: 08xxxxxxxx or +359 8xxxxxxxx (mobile
// prefixes start with 87/88/89), tolerant of spaces and dashes.
const BG_MOBILE_REGEX = /^(?:0|\+359)8[7-9]\d{7}$/

export function normalizePhone(raw: string): string {
  return raw.replace(/[\s-]/g, '')
}

export function isValidBulgarianMobile(raw: string): boolean {
  return BG_MOBILE_REGEX.test(normalizePhone(raw))
}
