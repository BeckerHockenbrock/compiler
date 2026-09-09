/**
 * Accidental-Corruption Checksum Utility
 *
 * NOTE: This checksum is strictly used to detect accidental transmission flaws,
 * copy-paste truncation, or partial writes during export and import.
 * It is NOT a cryptographic signature and does NOT provide tamper protection.
 * Users are free and encouraged to inspect or edit their own JSON backups.
 */

const FNV_PRIME = 0x01000193;
const FNV_OFFSET_BASIS = 0x811c9dc5;

/**
 * Calculates a 32-bit FNV-1a checksum formatted as an 8-character hex string.
 */
export function calculateChecksum(input: string): string {
  let hash = FNV_OFFSET_BASIS;

  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    // 32-bit integer multiplication
    hash = Math.imul(hash, FNV_PRIME);
  }

  // Convert to unsigned 32-bit integer and pad to 8-character hex
  return (hash >>> 0).toString(16).padStart(8, "0");
}

/**
 * Verifies that the input matches the expected checksum string.
 */
export function verifyChecksum(input: string, expectedChecksum: string): boolean {
  const computed = calculateChecksum(input);
  return computed.toLowerCase() === expectedChecksum.toLowerCase();
}
