import { db } from "../storage";
import { users, organizations, invitations, orgMemberships } from "@shared/schema";
import { eq, and, isNotNull } from "drizzle-orm";
import { generateInviteCode } from "../utils/inviteCode";

export async function migrateOnboarding() {
  const result1 = await db.update(users)
    .set({ onboardingCompleted: true })
    .where(and(
      isNotNull(users.orgId),
      eq(users.onboardingCompleted, false)
    ));

  const allOrgs = await db.select().from(organizations);
  let createdCount = 0;

  for (const org of allOrgs) {
    const existingInvite = await db.select()
      .from(invitations)
      .where(and(
        eq(invitations.orgId, org.id),
        eq(invitations.isActive, true)
      ))
      .limit(1);

    if (existingInvite.length === 0) {
      const ownerMembership = await db.select()
        .from(orgMemberships)
        .where(and(
          eq(orgMemberships.orgId, org.id),
          eq(orgMemberships.role, 'owner')
        ))
        .limit(1);

      let creatorId: number | null = null;

      if (ownerMembership.length > 0) {
        creatorId = ownerMembership[0].userId;
      } else {
        const anyMembership = await db.select()
          .from(orgMemberships)
          .where(eq(orgMemberships.orgId, org.id))
          .limit(1);

        if (anyMembership.length > 0) {
          creatorId = anyMembership[0].userId;
        }
      }

      if (creatorId) {
        const code = generateInviteCode(org.name);
        await db.insert(invitations).values({
          orgId: org.id,
          inviteCode: code,
          role: 'member',
          createdBy: creatorId,
          isActive: true,
          maxUses: 0,
          usedCount: 0,
        });
        createdCount++;
      }
    }
  }

  console.log(`Migration: onboarding migration completed (${allOrgs.length} orgs checked, ${createdCount} invite codes created)`);
}
