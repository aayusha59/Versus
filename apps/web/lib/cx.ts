export function cx(...xs: Array<string | false | null | undefined | 0>): string {
  return xs.filter(Boolean).join(" ");
}
