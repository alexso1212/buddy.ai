import crypto from 'crypto';

export function generateInviteCode(orgName: string): string {
  const prefix = orgName
    .replace(/[^a-zA-Z\s]/g, '')
    .split(/\s+/)
    .map(w => w[0]?.toUpperCase())
    .filter(Boolean)
    .join('')
    .slice(0, 3) || 'ORG';

  const random = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `${prefix}-${random}`;
}
