/**
 * A v4 UUID for a message's `client_id` (BE-13: ≤64 chars of [A-Za-z0-9._:-]). It only has to
 * be unique per sender so a resend is recognised as the same message; it is not a secret, so
 * Math.random is enough when the platform has no `crypto.getRandomValues`.
 */
type CryptoLike = { getRandomValues?: (array: Uint8Array) => Uint8Array };

const randomBytes = (count: number): Uint8Array => {
  const bytes = new Uint8Array(count);
  const cryptoObj = (globalThis as { crypto?: CryptoLike }).crypto;
  if (cryptoObj?.getRandomValues) {
    cryptoObj.getRandomValues(bytes);
    return bytes;
  }
  for (let i = 0; i < count; i += 1) {
    bytes[i] = Math.floor(Math.random() * 256);
  }
  return bytes;
};

export const createClientId = (): string => {
  const bytes = randomBytes(16);
  bytes[6] = 0x40 + (bytes[6] % 16); // version 4: high nibble 0100
  bytes[8] = 0x80 + (bytes[8] % 64); // RFC 4122 variant: high bits 10
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

export const CLIENT_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
