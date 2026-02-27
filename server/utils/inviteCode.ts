export function generateInviteCode(orgName: string): string {
  const prefix = orgName
    .replace(/[^a-zA-Z\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 0)
    .map(w => w[0].toUpperCase())
    .join('')
    .slice(0, 3) || 'ORG';

  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let random = '';
  for (let i = 0; i < 4; i++) {
    random += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  return `${prefix}-${random}`;
}
