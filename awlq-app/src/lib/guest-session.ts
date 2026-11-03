export function getGuestDisplayName(guestSessionId: string): string {
  const slug = guestSessionId.replaceAll("-", "").slice(0, 6).toLowerCase();
  return `Convidado-${slug}`;
}
