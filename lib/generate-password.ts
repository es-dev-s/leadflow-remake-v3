/** Cryptographically strong temporary password for admin-issued credentials. */
export function generateTemporaryPassword(length = 12): string {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnopqrstuvwxyz";
  const digits = "23456789";
  const all = upper + lower + digits;
  const bytes = new Uint8Array(Math.max(10, length));
  crypto.getRandomValues(bytes);

  const chars: string[] = [
    upper[bytes[0]! % upper.length]!,
    lower[bytes[1]! % lower.length]!,
    digits[bytes[2]! % digits.length]!,
  ];
  for (let i = 3; i < length; i += 1) {
    chars.push(all[bytes[i]! % all.length]!);
  }
  // Fisher–Yates shuffle with remaining entropy.
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = bytes[i]! % (i + 1);
    const tmp = chars[i]!;
    chars[i] = chars[j]!;
    chars[j] = tmp;
  }
  return chars.join("");
}
