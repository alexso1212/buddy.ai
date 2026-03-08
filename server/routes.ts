import type { Express } from "express";
import { type Server } from "http";
import path from 'path';
import fs from 'fs';
import { storage } from "./storage";
import { chat as aiChat, chatStream as aiChatStream, codeToolChatStream, generateProjectTasks, extractMemories, generateConversationTitle } from "./services/ai/index";
import { generateDocx } from "./services/ai/documentGenerator";
import { executeAction, executeBatchActions } from "./services/ai/actionExecutor";
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { authMiddleware, generateToken, getTokenExpiry } from './middleware/auth';
import { setupAuth, registerAuthRoutes } from "./replit_integrations/auth";
import adminRouter, { adminOrOwnerMiddleware } from './routes/admin';
import {
  insertOrganizationSchema,
  insertDepartmentSchema,
  insertUserSchema,
  insertProjectSchema,
  insertTaskSchema,
  insertTaskDependencySchema,
  insertTaskCommentSchema,
  insertTaskParticipantSchema,
  insertJobRoleSchema,
  insertConversationSchema,
  insertChatMessageSchema,
  insertUserMemorySchema,
  insertKbDocumentSchema,
} from "@shared/schema";
import { processDocument } from './services/kb/processDocument';
import { searchKnowledge } from './services/kb/search';
import { judgeTaskAssignment } from "./services/ai/verdictService";
import { searchWeb } from "./services/ai/webSearch";
import { generateInviteCode } from "./utils/inviteCode";

function getActivityUserId(body: any, fallback: number = 1): number {
  return body?.userId ?? body?.creatorId ?? fallback;
}

export async function registerRoutes(server: Server, app: Express) {
  app.get("/api/health", (_req, res) => {
    res.status(200).json({ status: "ok", timestamp: Date.now() });
  });

  await setupAuth(app);
  registerAuthRoutes(app);

  app.get('/api/documents/:fileName', authMiddleware, (req: any, res) => {
    const fileName = req.params.fileName;
    if (fileName.includes('..') || fileName.includes('/') || fileName.includes('\\')) {
      return res.status(400).json({ error: 'Invalid filename' });
    }
    const filePath = path.join(process.cwd(), 'uploads', 'documents', fileName);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Document not found' });
    }
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`);
    res.sendFile(filePath);
  });

  app.use("/api/admin", authMiddleware, adminOrOwnerMiddleware, adminRouter);

  app.get("/api/auth/oidc/complete", async (req: any, res) => {
    try {
      if (!req.user || !req.user.claims) {
        return res.redirect('/login');
      }

      const claims = req.user.claims;
      const sub = claims.sub;
      const email = claims.email;
      const firstName = claims.first_name || '';
      const lastName = claims.last_name || '';
      const displayName = [firstName, lastName].filter(Boolean).join(' ') || email || 'User';
      const avatarUrl = claims.profile_image_url || null;

      let user = await storage.getUserByProvider('oidc', sub);

      if (!user && email) {
        user = await storage.getUserByEmail(email);
        if (user) {
          await storage.updateUser(user.id, { authProvider: 'oidc', authProviderId: sub, avatarUrl: avatarUrl || user.avatarUrl } as any);
        }
      }

      if (!user) {
        const org = await storage.createOrganization({ name: displayName + '的团队' });
        user = await storage.createUser({
          orgId: org.id,
          email: email || `oidc_${sub}@placeholder.local`,
          displayName,
          avatarUrl,
          role: 'owner',
          isActive: true,
          authProvider: 'oidc',
          authProviderId: sub,
        } as any);
        await storage.createOrgMembership({ userId: user.id, orgId: org.id, role: 'owner', isActive: true });
      }

      await storage.updateUser(user.id, { lastLoginAt: new Date(), avatarUrl: avatarUrl || user.avatarUrl } as any);

      const token = generateToken({ userId: user.id, orgId: user.orgId, role: user.role });

      return res.redirect(`/login?token=${encodeURIComponent(token)}`);
    } catch (e: any) {
      console.error('OIDC complete error:', e);
      return res.redirect('/login?error=auth_failed');
    }
  });

  app.post("/api/auth/telegram", async (req, res) => {
    try {
      const { hash, ...userData } = req.body;

      if (!hash || !userData.id || !userData.auth_date) {
        return res.status(400).json({ error: 'Missing required Telegram auth fields' });
      }

      const botToken = process.env.TELEGRAM_BOT_TOKEN;
      if (!botToken) {
        return res.status(500).json({ error: 'Telegram bot token not configured' });
      }

      const authDate = Number(userData.auth_date);
      const now = Math.floor(Date.now() / 1000);
      if (now - authDate > 86400) {
        return res.status(401).json({ error: 'Telegram auth data is expired' });
      }

      const dataCheckString = Object.keys(userData)
        .sort()
        .map(key => `${key}=${userData[key]}`)
        .join('\n');

      const secretKey = crypto.createHash('sha256').update(botToken).digest();
      const hmac = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

      if (hmac !== hash) {
        return res.status(401).json({ error: 'Invalid Telegram auth hash' });
      }

      const telegramId = String(userData.id);
      const firstName = userData.first_name || '';
      const lastName = userData.last_name || '';
      const username = userData.username || '';
      const photoUrl = userData.photo_url || null;
      const displayName = [firstName, lastName].filter(Boolean).join(' ') || username || 'Telegram User';

      let user = await storage.getUserByProvider('telegram', telegramId);

      if (!user) {
        const org = await storage.createOrganization({ name: displayName + '的团队' });
        user = await storage.createUser({
          orgId: org.id,
          email: `telegram_${telegramId}@placeholder.local`,
          displayName,
          avatarUrl: photoUrl,
          role: 'owner',
          isActive: true,
          authProvider: 'telegram',
          authProviderId: telegramId,
        } as any);
        await storage.createOrgMembership({ userId: user.id, orgId: org.id, role: 'owner', isActive: true });
      }

      await storage.updateUser(user.id, { lastLoginAt: new Date(), avatarUrl: photoUrl || user.avatarUrl } as any);

      const token = generateToken({ userId: user.id, orgId: user.orgId, role: user.role });
      return res.json({
        token,
        user: { id: user.id, email: user.email, displayName: user.displayName, role: user.role, orgId: user.orgId, avatarUrl: user.avatarUrl },
      });
    } catch (e: any) {
      console.error('Telegram auth error:', e);
      return res.status(500).json({ error: e.message });
    }
  });

  async function generateTeamNotifications(
    triggeredByUserId: number,
    entityType: 'task' | 'project',
    entityId: number,
    entityTitle: string,
    orgId: number,
    type: string,
    message: string
  ) {
    const recipientIds = new Set<number>();

    if (entityType === 'task') {
      const task = await storage.getTaskById(entityId);
      if (task) {
        if (task.assigneeId && task.assigneeId !== triggeredByUserId) recipientIds.add(task.assigneeId);
        if (task.creatorId !== triggeredByUserId) recipientIds.add(task.creatorId);
        const participants = await storage.getTaskParticipants(entityId);
        for (const p of participants) {
          if (p.userId !== triggeredByUserId) recipientIds.add(p.userId);
        }
      }
    } else if (entityType === 'project') {
      const project = await storage.getProjectById(entityId);
      if (project) {
        if (project.ownerId !== triggeredByUserId) recipientIds.add(project.ownerId);
        const projectTasks = await storage.getTasks({ projectId: entityId });
        for (const t of projectTasks) {
          if (t.assigneeId && t.assigneeId !== triggeredByUserId) recipientIds.add(t.assigneeId);
          if (t.creatorId !== triggeredByUserId) recipientIds.add(t.creatorId);
        }
      }
    }

    // Team vs Personal: Only notify superiors if there are already other recipients
    // (meaning it's a team event, not a purely personal task)
    if (recipientIds.size > 0) {
      const triggerUser = await storage.getUserById(triggeredByUserId);
      if (triggerUser && triggerUser.deptId) {
        const allUsers = await storage.getUsers();
        const heads = allUsers.filter(u => u.deptId === triggerUser.deptId && (u.role === 'head' || u.role === 'admin' || u.role === 'owner') && u.id !== triggeredByUserId);
        for (const h of heads) {
          recipientIds.add(h.id);
        }
        const ownerUsers = allUsers.filter(u => u.role === 'owner' && u.id !== triggeredByUserId);
        for (const o of ownerUsers) {
          recipientIds.add(o.id);
        }
      }
    }

    if (recipientIds.size === 0) return;

    const notificationData = Array.from(recipientIds).map(userId => ({
      orgId,
      userId,
      type,
      entityType,
      entityId,
      entityTitle,
      message,
      triggeredBy: triggeredByUserId,
      isRead: false,
    }));

    await storage.createManyNotifications(notificationData);
  }

  // ===================== Auth =====================
  app.post("/api/auth/register", async (req, res) => {
    try {
      const { email, password, displayName } = req.body;

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!email || !emailRegex.test(email)) {
        return res.status(400).json({ error: '请输入有效的邮箱地址' });
      }
      if (!password || password.length < 8) {
        return res.status(400).json({ error: '密码至少需要8个字符' });
      }
      if (!displayName) {
        return res.status(400).json({ error: '请输入显示名称' });
      }

      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ error: '该邮箱已被注册' });
      }

      const passwordHash = await bcrypt.hash(password, 10);
      const org = await storage.createOrganization({ name: displayName + '的团队' });
      const user = await storage.createUser({
        orgId: org.id,
        email,
        passwordHash,
        displayName,
        role: 'owner',
        isActive: true,
      } as any);

      await storage.createOrgMembership({ userId: user.id, orgId: org.id, role: 'owner', isActive: true });

      const token = generateToken({ userId: user.id, orgId: user.orgId, role: user.role });
      return res.status(201).json({
        token,
        user: { id: user.id, email: user.email, displayName: user.displayName, role: user.role, orgId: user.orgId, avatarUrl: user.avatarUrl },
      });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body;

      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(401).json({ error: '邮箱或密码错误' });
      }

      if (!user.passwordHash) {
        return res.status(401).json({ error: '请先注册账户' });
      }

      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) {
        return res.status(401).json({ error: '邮箱或密码错误' });
      }

      await storage.updateUser(user.id, { lastLoginAt: new Date() } as any);

      const token = generateToken({ userId: user.id, orgId: user.orgId, role: user.role });
      return res.json({
        token,
        user: { id: user.id, email: user.email, displayName: user.displayName, role: user.role, orgId: user.orgId, avatarUrl: user.avatarUrl },
      });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/auth/me", authMiddleware, async (req, res) => {
    try {
      const user = await storage.getUserById(req.currentUserId);
      if (!user) {
        return res.status(404).json({ error: '用户不存在' });
      }

      const org = user.orgId ? await storage.getOrganizationById(user.orgId) : undefined;

      let activeInviteCode: string | undefined;
      if (user.orgId) {
        const orgInvitations = await storage.getOrgInvitations(user.orgId);
        if (orgInvitations.length > 0) {
          activeInviteCode = orgInvitations[0].inviteCode;
        }
      }

      const adminEmails = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim()).filter(Boolean);
      const isSuperAdmin = user.isSuperAdmin || adminEmails.includes(user.email);

      const userData = {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
        orgId: user.orgId,
        avatarUrl: user.avatarUrl,
        onboardingCompleted: user.onboardingCompleted ?? false,
        orgName: org?.name,
        orgType: org?.type || 'project',
        orgDescription: org?.description,
        activeInviteCode,
        isSuperAdmin,
      };

      const authHeader = req.headers.authorization;
      const currentToken = authHeader?.split(' ')[1];
      let refreshedToken: string | undefined;

      if (currentToken) {
        const expiry = getTokenExpiry(currentToken);
        if (expiry) {
          const remainingSec = expiry - Math.floor(Date.now() / 1000);
          if (remainingSec < 86400) {
            refreshedToken = generateToken({
              userId: user.id,
              orgId: user.orgId,
              role: user.role,
            });
          }
        }
      }

      return res.json({
        user: userData,
        ...(refreshedToken ? { token: refreshedToken } : {}),
      });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.put("/api/auth/profile", authMiddleware, async (req, res) => {
    try {
      const { displayName, avatarUrl } = req.body;
      const data: any = {};
      if (displayName !== undefined) data.displayName = displayName;
      if (avatarUrl !== undefined) data.avatarUrl = avatarUrl;

      const updated = await storage.updateUser(req.currentUserId, data);
      return res.json({ user: updated });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.put("/api/auth/password", authMiddleware, async (req, res) => {
    try {
      const { currentPassword, newPassword } = req.body;

      if (!newPassword || newPassword.length < 8) {
        return res.status(400).json({ error: '新密码至少需要8个字符' });
      }

      const user = await storage.getUserById(req.currentUserId);
      if (!user) {
        return res.status(404).json({ error: '用户不存在' });
      }

      if (!user.passwordHash) {
        return res.status(400).json({ error: '当前账户未设置密码' });
      }

      const valid = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!valid) {
        return res.status(401).json({ error: '当前密码错误' });
      }

      const passwordHash = await bcrypt.hash(newPassword, 10);
      await storage.updateUser(req.currentUserId, { passwordHash } as any);

      return res.json({ message: '密码修改成功' });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  // ===================== Multi-Org & Invitations =====================
  app.get("/api/user/orgs", authMiddleware, async (req: any, res) => {
    try {
      const orgs = await storage.getUserOrgsWithDetails(req.currentUserId);
      res.json({ data: orgs });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/user/switch-org", authMiddleware, async (req: any, res) => {
    try {
      const { orgId } = req.body;
      if (!orgId) return res.status(400).json({ error: 'orgId is required' });

      const membership = await storage.getOrgMembershipByUserAndOrg(req.currentUserId, orgId);
      if (!membership || !membership.isActive) {
        return res.status(403).json({ error: 'You are not a member of this organization' });
      }

      const user = await storage.switchActiveOrg(req.currentUserId, orgId);
      if (!user) return res.status(404).json({ error: 'User not found' });

      const org = await storage.getOrganizationById(orgId);
      const token = generateToken({ userId: user.id, orgId: user.orgId, role: membership.role });

      res.json({
        data: {
          token,
          user: {
            id: user.id, email: user.email, displayName: user.displayName,
            role: membership.role, orgId: user.orgId, avatarUrl: user.avatarUrl,
            orgName: org?.name,
            orgType: org?.type || 'project',
          }
        }
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/org/members", authMiddleware, async (req: any, res) => {
    try {
      const members = await storage.getOrgMembers(req.orgId);
      res.json({ data: members });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/invitations", authMiddleware, async (req: any, res) => {
    try {
      const membership = await storage.getOrgMembershipByUserAndOrg(req.currentUserId, req.orgId);
      if (!membership || !['owner', 'admin'].includes(membership.role)) {
        return res.status(403).json({ error: 'Only owner or admin can create invitations' });
      }

      const inviteCode = crypto.randomBytes(6).toString('hex');
      const { role, maxUses, expiresInDays } = req.body;

      const invitation = await storage.createInvitation({
        orgId: req.orgId,
        inviteCode,
        role: role || 'member',
        createdBy: req.currentUserId,
        maxUses: maxUses || null,
        expiresAt: expiresInDays ? new Date(Date.now() + expiresInDays * 86400000) : null,
        isActive: true,
      });

      res.json({ data: invitation });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/invitations", authMiddleware, async (req: any, res) => {
    try {
      const orgInvitations = await storage.getOrgInvitations(req.orgId);
      res.json({ data: orgInvitations });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.delete("/api/invitations/:id", authMiddleware, async (req: any, res) => {
    try {
      const result = await storage.deactivateInvitation(Number(req.params.id));
      res.json({ data: result });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/invitations/verify/:code", async (req, res) => {
    try {
      const invitation = await storage.getInvitationByCode(req.params.code);
      if (!invitation || !invitation.isActive) {
        return res.status(404).json({ error: 'Invalid or expired invitation' });
      }
      if (invitation.expiresAt && new Date() > invitation.expiresAt) {
        return res.status(410).json({ error: 'Invitation has expired' });
      }
      if (invitation.maxUses && invitation.usedCount >= invitation.maxUses) {
        return res.status(410).json({ error: 'Invitation has reached maximum uses' });
      }

      const org = await storage.getOrganizationById(invitation.orgId);
      res.json({ data: { orgName: org?.name, orgType: org?.type, role: invitation.role } });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ==================== 3.2 POST /api/organizations — 创建组织 ====================
  app.post("/api/organizations", authMiddleware, async (req: any, res) => {
    try {
      const { name, description } = req.body;
      if (!name || !name.trim()) {
        return res.status(400).json({ error: '组织名称不能为空' });
      }

      const org = await storage.createOrganization({ name: name.trim(), description: description || null });

      let inviteCode = '';
      for (let i = 0; i < 5; i++) {
        const code = generateInviteCode(name);
        const existing = await storage.getInvitationByCode(code);
        if (!existing) {
          inviteCode = code;
          break;
        }
      }
      if (!inviteCode) {
        inviteCode = generateInviteCode(name) + Math.floor(Math.random() * 100);
      }

      await storage.createInvitation({
        orgId: org.id,
        inviteCode,
        role: 'member',
        createdBy: req.currentUserId,
        isActive: true,
        maxUses: 0,
        usedCount: 0,
      });

      await storage.updateUser(req.currentUserId, {
        orgId: org.id,
        role: 'owner',
        onboardingCompleted: true,
      } as any);

      await storage.createOrgMembership({
        userId: req.currentUserId,
        orgId: org.id,
        role: 'owner',
      });

      const newToken = generateToken({ userId: req.currentUserId, orgId: org.id, role: 'owner' });

      res.json({ data: { organization: org, inviteCode, token: newToken } });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ==================== 3.3 GET /api/organizations/search — 通过邀请码搜索组织 ====================
  app.get("/api/organizations/search", authMiddleware, async (req: any, res) => {
    try {
      const code = req.query.code as string;
      if (!code) {
        return res.status(400).json({ error: '请提供邀请码' });
      }

      const invitation = await storage.getInvitationByCode(code);
      if (!invitation || !invitation.isActive) {
        return res.status(404).json({ error: '未找到该邀请码对应的组织' });
      }

      const org = await storage.getOrganizationById(invitation.orgId);
      if (!org) {
        return res.status(404).json({ error: '未找到该邀请码对应的组织' });
      }

      const memberCount = await storage.countOrgMembers(org.id);

      res.json({ data: { id: org.id, name: org.name, description: org.description, memberCount } });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ==================== 3.4 POST /api/organizations/:id/join-requests — 提交加入申请 ====================
  app.post("/api/organizations/:id/join-requests", authMiddleware, async (req: any, res) => {
    try {
      const orgId = Number(req.params.id);
      const { inviteCode: code, message } = req.body;

      if (!code) {
        return res.status(400).json({ error: '请提供邀请码' });
      }

      const invitation = await storage.getInvitationByCode(code);
      if (!invitation || !invitation.isActive || invitation.orgId !== orgId) {
        return res.status(400).json({ error: '邀请码无效或不属于该组织' });
      }

      if (invitation.maxUses && invitation.maxUses > 0 && invitation.usedCount >= invitation.maxUses) {
        return res.status(400).json({ error: '该邀请码已达到使用上限' });
      }

      const user = await storage.getUserById(req.currentUserId);
      if (user && user.orgId === orgId) {
        return res.status(400).json({ error: '你已经是该组织的成员' });
      }

      const existingRequest = await storage.getPendingJoinRequestByUserId(req.currentUserId, orgId);
      if (existingRequest) {
        return res.status(400).json({ error: '你已有待审批的加入申请' });
      }

      const org = await storage.getOrganizationById(orgId);
      if (org && org.maxMembers) {
        const memberCount = await storage.countOrgMembers(orgId);
        if (memberCount >= org.maxMembers) {
          return res.status(400).json({ error: '该组织已达到最大成员数' });
        }
      }

      const joinRequest = await storage.createJoinRequest({
        orgId,
        userId: req.currentUserId,
        message: message || null,
        inviteCode: code,
        status: 'pending',
      });

      res.json({ data: joinRequest });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ==================== 3.5 GET /api/organizations/:id/join-requests — 获取申请列表 ====================
  app.get("/api/organizations/:id/join-requests", authMiddleware, async (req: any, res) => {
    try {
      const orgId = Number(req.params.id);

      const membership = await storage.getOrgMembershipByUserAndOrg(req.currentUserId, orgId);
      if (!membership || !['owner', 'admin'].includes(membership.role)) {
        return res.status(403).json({ error: '仅组织 owner 或 admin 可查看申请列表' });
      }

      const status = req.query.status as string | undefined;
      const requests = await storage.getJoinRequestsByOrgId(orgId, status);

      res.json({ data: requests });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ==================== 3.6 PUT /api/organizations/:id/join-requests/:requestId — 审批 ====================
  app.put("/api/organizations/:id/join-requests/:requestId", authMiddleware, async (req: any, res) => {
    try {
      const orgId = Number(req.params.id);
      const requestId = Number(req.params.requestId);

      const membership = await storage.getOrgMembershipByUserAndOrg(req.currentUserId, orgId);
      if (!membership || !['owner', 'admin'].includes(membership.role)) {
        return res.status(403).json({ error: '仅组织 owner 或 admin 可审批申请' });
      }

      const joinRequest = await storage.getJoinRequestById(requestId);
      if (!joinRequest) {
        return res.status(404).json({ error: '申请不存在' });
      }

      if (joinRequest.status !== 'pending') {
        return res.status(400).json({ error: '该申请已处理' });
      }

      const { status, reviewNote } = req.body;
      if (!['approved', 'rejected'].includes(status)) {
        return res.status(400).json({ error: 'status 必须为 approved 或 rejected' });
      }

      const updated = await storage.updateJoinRequest(requestId, {
        status,
        reviewedBy: req.currentUserId,
        reviewedAt: new Date(),
        reviewNote: reviewNote || null,
      });

      if (status === 'approved') {
        let assignedRole = 'member';
        if (joinRequest.inviteCode) {
          const invitation = await storage.getInvitationByCode(joinRequest.inviteCode);
          if (invitation) {
            assignedRole = invitation.role || 'member';
            await storage.incrementInvitationUsedCount(invitation.id);
          }
        }

        await storage.updateUser(joinRequest.userId, {
          orgId,
          role: assignedRole,
          onboardingCompleted: true,
        } as any);

        await storage.createOrgMembership({
          userId: joinRequest.userId,
          orgId,
          role: assignedRole,
        });

        await storage.cancelOtherPendingJoinRequests(joinRequest.userId, orgId, requestId);

        const newUser = await storage.getUserById(joinRequest.userId);
        if (newUser) {
          const pendingProfiles = await storage.getPendingProfilesByOrg(orgId);
          let suggestedProfile = null;
          for (const profile of pendingProfiles) {
            if (profile.email && newUser.email && profile.email.toLowerCase() === newUser.email.toLowerCase()) {
              suggestedProfile = profile;
              break;
            }
            if (profile.fullName === newUser.displayName) {
              suggestedProfile = profile;
              break;
            }
            let aliases: string[] = [];
            try { aliases = profile.aliases ? JSON.parse(profile.aliases) : []; } catch {}
            if (aliases.some((alias: string) => alias.toLowerCase() === newUser.displayName.toLowerCase())) {
              suggestedProfile = profile;
              break;
            }
          }
          if (suggestedProfile) {
            return res.json({ data: { ...updated, suggestedProfile } });
          }
        }
      }

      res.json({ data: updated });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ==================== 3.7 GET /api/organizations/:id/invite-code — 获取邀请码 ====================
  app.get("/api/organizations/:id/invite-code", authMiddleware, async (req: any, res) => {
    try {
      const orgId = Number(req.params.id);

      const membership = await storage.getOrgMembershipByUserAndOrg(req.currentUserId, orgId);
      if (!membership || !['owner', 'admin'].includes(membership.role)) {
        return res.status(403).json({ error: '仅组织 owner 或 admin 可查看邀请码' });
      }

      const orgInvitations = await storage.getOrgInvitations(orgId);
      if (orgInvitations.length === 0) {
        return res.status(404).json({ error: '该组织没有活跃的邀请码' });
      }

      const latest = orgInvitations[0];
      res.json({ data: { inviteCode: latest.inviteCode, createdAt: latest.createdAt, maxUses: latest.maxUses, usedCount: latest.usedCount } });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ==================== 3.8 POST /api/organizations/:id/invite-code/regenerate — 重新生成 ====================
  app.post("/api/organizations/:id/invite-code/regenerate", authMiddleware, async (req: any, res) => {
    try {
      const orgId = Number(req.params.id);

      const membership = await storage.getOrgMembershipByUserAndOrg(req.currentUserId, orgId);
      if (!membership || membership.role !== 'owner') {
        return res.status(403).json({ error: '仅组织 owner 可重新生成邀请码' });
      }

      await storage.deactivateOrgInvitations(orgId);

      const org = await storage.getOrganizationById(orgId);
      let inviteCode = '';
      for (let i = 0; i < 5; i++) {
        const code = generateInviteCode(org?.name || 'ORG');
        const existing = await storage.getInvitationByCode(code);
        if (!existing) {
          inviteCode = code;
          break;
        }
      }
      if (!inviteCode) {
        inviteCode = generateInviteCode(org?.name || 'ORG') + Math.floor(Math.random() * 100);
      }

      await storage.createInvitation({
        orgId,
        inviteCode,
        role: 'member',
        createdBy: req.currentUserId,
        isActive: true,
        maxUses: 0,
        usedCount: 0,
      });

      res.json({ data: { inviteCode } });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/invitations/accept/:code", authMiddleware, async (req: any, res) => {
    try {
      const invitation = await storage.getInvitationByCode(req.params.code);
      if (!invitation || !invitation.isActive) {
        return res.status(404).json({ error: 'Invalid or expired invitation' });
      }
      if (invitation.expiresAt && new Date() > invitation.expiresAt) {
        return res.status(410).json({ error: 'Invitation has expired' });
      }
      if (invitation.maxUses && invitation.usedCount >= invitation.maxUses) {
        return res.status(410).json({ error: 'Invitation has reached maximum uses' });
      }

      const existing = await storage.getOrgMembershipByUserAndOrg(req.currentUserId, invitation.orgId);
      if (existing && existing.isActive) {
        return res.status(409).json({ error: 'You are already a member of this organization' });
      }

      await storage.createOrgMembership({
        userId: req.currentUserId,
        orgId: invitation.orgId,
        role: invitation.role,
        isActive: true,
      });

      await storage.incrementInvitationUsedCount(invitation.id);

      const user = await storage.switchActiveOrg(req.currentUserId, invitation.orgId);
      const org = await storage.getOrganizationById(invitation.orgId);
      const token = generateToken({ userId: req.currentUserId, orgId: invitation.orgId, role: invitation.role });

      res.json({
        data: {
          token,
          user: {
            id: user!.id, email: user!.email, displayName: user!.displayName,
            role: invitation.role, orgId: invitation.orgId, avatarUrl: user!.avatarUrl,
            orgName: org?.name,
            orgType: org?.type || 'project',
          }
        }
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ===================== Organizations =====================
  app.get("/api/organizations", authMiddleware, async (req: any, res) => {
    try {
      const all = await storage.getOrganizations();
      const data = all.filter((o: any) => o.id === req.orgId);
      return res.json({ data });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/organizations", authMiddleware, async (req: any, res) => {
    try {
      const parsed = insertOrganizationSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
      const org = await storage.createOrganization(parsed.data);
      await storage.createActivityLog({
        orgId: org.id,
        userId: getActivityUserId(req.body, req.currentUserId),
        entityType: "organization",
        entityId: org.id,
        action: "create",
        changes: JSON.stringify(parsed.data),
        source: "manual",
      });
      return res.status(201).json({ data: org });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.patch("/api/organizations/:id", authMiddleware, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      if (id !== req.orgId) return res.status(403).json({ error: "Cannot modify another organization" });
      const existing = await storage.getOrganizationById(id);
      if (!existing) return res.status(404).json({ error: "Organization not found" });
      const updated = await storage.updateOrganization(id, req.body);
      await storage.createActivityLog({
        orgId: id,
        userId: req.currentUserId,
        entityType: "organization",
        entityId: id,
        action: "update",
        changes: JSON.stringify(req.body),
        source: "manual",
      });
      return res.json({ data: updated });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  // ===================== Departments =====================
  app.get("/api/departments", authMiddleware, async (req: any, res) => {
    try {
      const all = await storage.getDepartments();
      const data = all.filter((d: any) => d.orgId === req.orgId);
      return res.json({ data });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/departments", authMiddleware, async (req: any, res) => {
    try {
      const parsed = insertDepartmentSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
      const dept = await storage.createDepartment(parsed.data);
      await storage.createActivityLog({
        orgId: dept.orgId,
        userId: getActivityUserId(req.body, req.currentUserId),
        entityType: "department",
        entityId: dept.id,
        action: "create",
        changes: JSON.stringify(parsed.data),
        source: "manual",
      });
      return res.status(201).json({ data: dept });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.patch("/api/departments/:id", authMiddleware, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const existing = await storage.getDepartmentById(id);
      if (!existing) return res.status(404).json({ error: "Department not found" });
      const updated = await storage.updateDepartment(id, req.body);
      await storage.createActivityLog({
        orgId: existing.orgId,
        userId: getActivityUserId(req.body, req.currentUserId),
        entityType: "department",
        entityId: id,
        action: "update",
        changes: JSON.stringify(req.body),
        source: "manual",
      });
      return res.json({ data: updated });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.delete("/api/departments/:id", authMiddleware, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const existing = await storage.getDepartmentById(id);
      if (!existing) return res.status(404).json({ error: "Department not found" });
      await storage.deleteDepartment(id);
      await storage.createActivityLog({
        orgId: existing.orgId,
        userId: getActivityUserId(req.body, req.currentUserId),
        entityType: "department",
        entityId: id,
        action: "delete",
        changes: JSON.stringify({ id, name: existing.name }),
        source: "manual",
      });
      return res.json({ data: { success: true } });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  // ===================== Department Stats =====================
  app.get("/api/departments/stats", authMiddleware, async (req: any, res) => {
    try {
      const allTasks = await storage.getTasks({});
      const tasks = allTasks.filter((t: any) => t.orgId === req.orgId);
      const allUsers = await storage.getUsers();
      const orgUsers = allUsers.filter((u: any) => u.orgId === req.orgId);
      const now = new Date();
      const soon = new Date(now.getTime() + 48 * 60 * 60 * 1000);

      const deptStatsMap: Record<number, { total: number; active: number; done: number; overdue: number; dueSoon: number; blocked: number; urged: number }> = {};

      const userDeptMap: Record<number, number> = {};
      for (const u of orgUsers) {
        if (u.deptId) userDeptMap[u.id] = u.deptId;
      }

      for (const task of tasks) {
        const deptId = task.assigneeId ? userDeptMap[task.assigneeId] : undefined;
        if (!deptId) continue;

        if (!deptStatsMap[deptId]) {
          deptStatsMap[deptId] = { total: 0, active: 0, done: 0, overdue: 0, dueSoon: 0, blocked: 0, urged: 0 };
        }
        const s = deptStatsMap[deptId];
        s.total++;
        if (task.status === "done") { s.done++; }
        else if (task.status === "in_progress" || task.status === "todo") { s.active++; }
        if (task.status === "blocked") { s.blocked++; }
        if (task.status !== "done" && task.status !== "cancelled" && task.dueDate) {
          const due = new Date(task.dueDate);
          if (due < now) { s.overdue++; s.urged++; }
          else if (due < soon) { s.dueSoon++; }
        }
      }

      return res.json(deptStatsMap);
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  // ===================== User Stats =====================
  app.get("/api/users/stats", authMiddleware, async (req: any, res) => {
    try {
      const allTasks = await storage.getTasks({});
      const tasks = allTasks.filter((t: any) => t.orgId === req.orgId);
      const now = new Date();
      const soon = new Date(now.getTime() + 48 * 60 * 60 * 1000);

      const userStatsMap: Record<number, { total: number; active: number; done: number; overdue: number; dueSoon: number; blocked: number; urged: number }> = {};

      for (const task of tasks) {
        if (!task.assigneeId) continue;
        const uid = task.assigneeId;
        if (!userStatsMap[uid]) {
          userStatsMap[uid] = { total: 0, active: 0, done: 0, overdue: 0, dueSoon: 0, blocked: 0, urged: 0 };
        }
        const s = userStatsMap[uid];
        s.total++;
        if (task.status === "done") { s.done++; }
        else if (task.status === "in_progress" || task.status === "todo") { s.active++; }
        if (task.status === "blocked") { s.blocked++; }
        if (task.status !== "done" && task.status !== "cancelled" && task.dueDate) {
          const due = new Date(task.dueDate);
          if (due < now) { s.overdue++; s.urged++; }
          else if (due < soon) { s.dueSoon++; }
        }
      }

      return res.json(userStatsMap);
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  // ===================== Users =====================
  app.get("/api/users", authMiddleware, async (req: any, res) => {
    try {
      const all = await storage.getUsers();
      const data = all.filter((u: any) => u.orgId === req.orgId);
      return res.json({ data });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/users", authMiddleware, async (req: any, res) => {
    try {
      const parsed = insertUserSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
      const user = await storage.createUser(parsed.data);
      await storage.createActivityLog({
        orgId: user.orgId,
        userId: getActivityUserId(req.body, req.currentUserId),
        entityType: "user",
        entityId: user.id,
        action: "create",
        changes: JSON.stringify(parsed.data),
        source: "manual",
      });
      return res.status(201).json({ data: user });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.patch("/api/users/:id", authMiddleware, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const existing = await storage.getUserById(id);
      if (!existing) return res.status(404).json({ error: "User not found" });
      const updated = await storage.updateUser(id, req.body);
      await storage.createActivityLog({
        orgId: existing.orgId,
        userId: getActivityUserId(req.body, req.currentUserId),
        entityType: "user",
        entityId: id,
        action: "update",
        changes: JSON.stringify(req.body),
        source: "manual",
      });
      return res.json({ data: updated });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.delete("/api/users/:id", authMiddleware, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const existing = await storage.getUserById(id);
      if (!existing) return res.status(404).json({ error: "User not found" });
      const updated = await storage.deleteUser(id);
      await storage.createActivityLog({
        orgId: existing.orgId,
        userId: getActivityUserId(req.body, req.currentUserId),
        entityType: "user",
        entityId: id,
        action: "delete",
        changes: JSON.stringify({ id, displayName: existing.displayName }),
        source: "manual",
      });
      return res.json({ data: updated });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  // ===================== Projects =====================
  app.get("/api/projects", authMiddleware, async (req: any, res) => {
    try {
      const projects = await storage.getProjects();
      const users = await storage.getUsers();
      const departments = await storage.getDepartments();
      const allTasks = await storage.getTasks({});
      const orgProjects = projects.filter((p: any) => p.orgId === req.orgId);
      const data = orgProjects.map(p => {
        const projectTasks = allTasks.filter((t: any) => t.projectId === p.id);
        const taskCount = projectTasks.length;
        const doneCount = projectTasks.filter((t: any) => t.status === 'done' || t.status === 'completed').length;
        return {
          ...p,
          owner: users.find(u => u.id === p.ownerId) || null,
          department: departments.find(d => d.id === p.deptId) || null,
          taskCount,
          doneCount,
        };
      });
      return res.json({ data });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/projects/:id", authMiddleware, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const project = await storage.getProjectById(id);
      if (!project) return res.status(404).json({ error: "Project not found" });
      if (project.orgId !== req.orgId) return res.status(403).json({ error: "Access denied" });
      const tasks = await storage.getTasks({ projectId: id });
      return res.json({ data: { ...project, tasks } });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/projects", authMiddleware, async (req: any, res) => {
    try {
      const parsed = insertProjectSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
      const project = await storage.createProject(parsed.data);
      await storage.createActivityLog({
        orgId: project.orgId,
        userId: getActivityUserId(req.body, req.currentUserId),
        entityType: "project",
        entityId: project.id,
        action: "create",
        changes: JSON.stringify(parsed.data),
        source: "manual",
      });
      return res.status(201).json({ data: project });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.patch("/api/projects/:id", authMiddleware, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const existing = await storage.getProjectById(id);
      if (!existing) return res.status(404).json({ error: "Project not found" });
      const updated = await storage.updateProject(id, req.body);
      await storage.createActivityLog({
        orgId: existing.orgId,
        userId: getActivityUserId(req.body, req.currentUserId),
        entityType: "project",
        entityId: id,
        action: "update",
        changes: JSON.stringify(req.body),
        source: "manual",
      });
      if (req.body.status && req.body.status !== existing.status) {
        const triggerUserId = getActivityUserId(req.body, req.currentUserId);
        const triggerUser = await storage.getUserById(triggerUserId);
        const triggerName = triggerUser?.displayName || '某人';
        const statusLabels: Record<string, string> = {
          active: '进行中', paused: '已暂停', completed: '已完成', archived: '已归档'
        };
        const newStatusLabel = statusLabels[req.body.status] || req.body.status;
        await generateTeamNotifications(
          triggerUserId, 'project', id, existing.name, existing.orgId,
          req.body.status === 'completed' ? 'completed' : 'status_change',
          `${triggerName} 将项目「${existing.name}」状态更改为「${newStatusLabel}」`
        );
      }
      return res.json({ data: updated });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.delete("/api/projects/:id", authMiddleware, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const existing = await storage.getProjectById(id);
      if (!existing) return res.status(404).json({ error: "Project not found" });

      const triggerUserId = getActivityUserId(req.body, req.currentUserId);
      const recipientIds = new Set<number>();
      if (existing.ownerId !== triggerUserId) recipientIds.add(existing.ownerId);
      const projectTasks = await storage.getTasks({ projectId: id });
      for (const t of projectTasks) {
        if (t.assigneeId && t.assigneeId !== triggerUserId) recipientIds.add(t.assigneeId);
        if (t.creatorId !== triggerUserId) recipientIds.add(t.creatorId);
      }
      const triggerUser = await storage.getUserById(triggerUserId);
      if (triggerUser && recipientIds.size > 0) {
        const allUsers = await storage.getUsers();
        const ownerUsers = allUsers.filter(u => u.role === 'owner' && u.id !== triggerUserId);
        for (const o of ownerUsers) recipientIds.add(o.id);
      }

      await storage.deleteProject(id);
      await storage.createActivityLog({
        orgId: existing.orgId,
        userId: triggerUserId,
        entityType: "project",
        entityId: id,
        action: "delete",
        changes: JSON.stringify({ id, name: existing.name }),
        source: "manual",
      });

      if (recipientIds.size > 0) {
        const triggerName = triggerUser?.displayName || '某人';
        const notifs = Array.from(recipientIds).map(userId => ({
          orgId: existing.orgId,
          userId,
          type: 'deleted' as const,
          entityType: 'project' as const,
          entityId: id,
          entityTitle: existing.name,
          message: `${triggerName} 删除了项目「${existing.name}」`,
          triggeredBy: triggerUserId,
          isRead: false,
        }));
        await storage.createManyNotifications(notifs);
      }

      return res.json({ data: { success: true } });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  // ===================== Tasks =====================
  app.get("/api/tasks", authMiddleware, async (req: any, res) => {
    try {
      const filters: { projectId?: number; assigneeId?: number; status?: string[]; parentTaskId?: number | null } = {};

      if (req.query.projectId) filters.projectId = parseInt(req.query.projectId as string);
      if (req.query.assigneeId) filters.assigneeId = parseInt(req.query.assigneeId as string);
      if (req.query.status) filters.status = (req.query.status as string).split(",");
      if (req.query.parentTaskId !== undefined) {
        const val = req.query.parentTaskId as string;
        filters.parentTaskId = val === "null" ? null : parseInt(val);
      }

      const allTasks = await storage.getTasks(Object.keys(filters).length > 0 ? filters : undefined);
      const tasksData = allTasks.filter((t: any) => t.orgId === req.orgId);
      const taskIds = tasksData.map(t => t.id);
      const allParticipants = await storage.getTaskParticipantsByTaskIds(taskIds);
      const allUsers = await storage.getUsers();
      const data = tasksData.map(t => ({
        ...t,
        participants: allParticipants
          .filter(p => p.taskId === t.id)
          .map(p => ({ ...p, user: allUsers.find(u => u.id === p.userId) || null })),
      }));
      return res.json({ data });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/tasks/:id", authMiddleware, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const task = await storage.getTaskById(id);
      if (!task) return res.status(404).json({ error: "Task not found" });
      if (task.orgId !== req.orgId) return res.status(403).json({ error: "Access denied" });
      const [subtasks, dependencies, comments, participantsRaw] = await Promise.all([
        storage.getTasks({ parentTaskId: id }),
        storage.getTaskDependencies(id),
        storage.getTaskComments(id),
        storage.getTaskParticipants(id),
      ]);
      const allUsers = await storage.getUsers();
      const participants = participantsRaw.map(p => ({
        ...p,
        user: allUsers.find(u => u.id === p.userId) || null,
      }));
      return res.json({ data: { ...task, subtasks, dependencies, comments, participants } });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/tasks", authMiddleware, async (req: any, res) => {
    try {
      const parsed = insertTaskSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
      const task = await storage.createTask(parsed.data);
      await storage.createActivityLog({
        orgId: task.orgId,
        userId: getActivityUserId(req.body, req.currentUserId),
        entityType: "task",
        entityId: task.id,
        action: "create",
        changes: JSON.stringify(parsed.data),
        source: "manual",
      });
      return res.status(201).json({ data: task });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.patch("/api/tasks/:id", authMiddleware, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const existing = await storage.getTaskById(id);
      if (!existing) return res.status(404).json({ error: "Task not found" });
      const updated = await storage.updateTask(id, req.body);
      await storage.createActivityLog({
        orgId: existing.orgId,
        userId: getActivityUserId(req.body, req.currentUserId),
        entityType: "task",
        entityId: id,
        action: "update",
        changes: JSON.stringify(req.body),
        source: "manual",
      });
      if (req.body.status && req.body.status !== existing.status) {
        const triggerUserId = getActivityUserId(req.body, req.currentUserId);
        const statusLabels: Record<string, string> = {
          todo: '待办', in_progress: '进行中', in_review: '审核中', done: '已完成', cancelled: '已取消'
        };
        const newStatusLabel = statusLabels[req.body.status] || req.body.status;
        const triggerUser = await storage.getUserById(triggerUserId);
        const triggerName = triggerUser?.displayName || '某人';
        await generateTeamNotifications(
          triggerUserId, 'task', id, existing.title, existing.orgId,
          req.body.status === 'done' ? 'completed' : 'status_change',
          `${triggerName} 将任务「${existing.title}」状态更改为「${newStatusLabel}」`
        );
      }
      return res.json({ data: updated });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.delete("/api/tasks/:id", authMiddleware, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const existing = await storage.getTaskById(id);
      if (!existing) return res.status(404).json({ error: "Task not found" });

      const triggerUserId = getActivityUserId(req.body, req.currentUserId);
      const participants = await storage.getTaskParticipants(id);
      const recipientIds = new Set<number>();
      if (existing.assigneeId && existing.assigneeId !== triggerUserId) recipientIds.add(existing.assigneeId);
      if (existing.creatorId !== triggerUserId) recipientIds.add(existing.creatorId);
      for (const p of participants) {
        if (p.userId !== triggerUserId) recipientIds.add(p.userId);
      }
      const triggerUser = await storage.getUserById(triggerUserId);
      if (triggerUser && recipientIds.size > 0) {
        const allUsers = await storage.getUsers();
        const ownerUsers = allUsers.filter(u => u.role === 'owner' && u.id !== triggerUserId);
        for (const o of ownerUsers) recipientIds.add(o.id);
      }

      await storage.deleteTask(id);
      await storage.createActivityLog({
        orgId: existing.orgId,
        userId: triggerUserId,
        entityType: "task",
        entityId: id,
        action: "delete",
        changes: JSON.stringify({ id, title: existing.title }),
        source: "manual",
      });

      if (recipientIds.size > 0) {
        const triggerName = triggerUser?.displayName || '某人';
        const notifs = Array.from(recipientIds).map(userId => ({
          orgId: existing.orgId,
          userId,
          type: 'deleted' as const,
          entityType: 'task' as const,
          entityId: id,
          entityTitle: existing.title,
          message: `${triggerName} 删除了任务「${existing.title}」`,
          triggeredBy: triggerUserId,
          isRead: false,
        }));
        await storage.createManyNotifications(notifs);
      }

      return res.json({ data: { success: true } });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  // ===================== Task Dependencies =====================
  app.get("/api/tasks/:id/dependencies", authMiddleware, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const data = await storage.getTaskDependencies(id);
      return res.json({ data });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/task-dependencies", authMiddleware, async (req: any, res) => {
    try {
      const parsed = insertTaskDependencySchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
      const dep = await storage.createTaskDependency(parsed.data);
      const task = await storage.getTaskById(dep.taskId);
      await storage.createActivityLog({
        orgId: task?.orgId ?? req.orgId,
        userId: getActivityUserId(req.body, req.currentUserId),
        entityType: "task_dependency",
        entityId: dep.id,
        action: "create",
        changes: JSON.stringify(parsed.data),
        source: "manual",
      });
      return res.status(201).json({ data: dep });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.delete("/api/task-dependencies/:id", authMiddleware, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const task = await storage.getTaskById(id);
      await storage.deleteTaskDependency(id);
      await storage.createActivityLog({
        orgId: task?.orgId ?? req.orgId,
        userId: getActivityUserId(req.body, req.currentUserId),
        entityType: "task_dependency",
        entityId: id,
        action: "delete",
        changes: JSON.stringify({ id }),
        source: "manual",
      });
      return res.json({ data: { success: true } });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  // ===================== Task Comments =====================
  app.get("/api/tasks/:id/comments", authMiddleware, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const data = await storage.getTaskComments(id);
      return res.json({ data });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/tasks/:id/comments", authMiddleware, async (req: any, res) => {
    try {
      const taskId = parseInt(req.params.id);
      const body = { ...req.body, taskId };
      const parsed = insertTaskCommentSchema.safeParse(body);
      if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
      const comment = await storage.createTaskComment(parsed.data);
      const task = await storage.getTaskById(taskId);
      await storage.createActivityLog({
        orgId: task?.orgId ?? req.orgId,
        userId: getActivityUserId(req.body, req.currentUserId),
        entityType: "task_comment",
        entityId: comment.id,
        action: "create",
        changes: JSON.stringify(parsed.data),
        source: "manual",
      });
      return res.status(201).json({ data: comment });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  // ===================== Task Participants =====================
  app.get("/api/tasks/:id/participants", authMiddleware, async (req: any, res) => {
    try {
      const taskId = parseInt(req.params.id);
      const participants = await storage.getTaskParticipants(taskId);
      const users = await storage.getUsers();
      const data = participants.map(p => ({
        ...p,
        user: users.find(u => u.id === p.userId) || null,
      }));
      return res.json({ data });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/tasks/:id/participants", authMiddleware, async (req: any, res) => {
    try {
      const taskId = parseInt(req.params.id);
      const task = await storage.getTaskById(taskId);
      if (!task) return res.status(404).json({ error: "Task not found" });

      const parsed = insertTaskParticipantSchema.safeParse({ ...req.body, taskId });
      if (!parsed.success) return res.status(400).json({ error: parsed.error.message });

      const participant = await storage.addTaskParticipant(parsed.data);
      await storage.createActivityLog({
        orgId: task.orgId,
        userId: getActivityUserId(req.body, req.currentUserId),
        entityType: "task",
        entityId: taskId,
        action: "add_participant",
        changes: JSON.stringify({ userId: parsed.data.userId, role: parsed.data.role }),
        source: "manual",
      });
      return res.status(201).json({ data: participant });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.delete("/api/tasks/:taskId/participants/:userId", authMiddleware, async (req: any, res) => {
    try {
      const taskId = parseInt(req.params.taskId);
      const userId = parseInt(req.params.userId);
      const task = await storage.getTaskById(taskId);
      if (!task) return res.status(404).json({ error: "Task not found" });

      await storage.removeTaskParticipantByTaskAndUser(taskId, userId);
      await storage.createActivityLog({
        orgId: task.orgId,
        userId: getActivityUserId(req.body, req.currentUserId),
        entityType: "task",
        entityId: taskId,
        action: "remove_participant",
        changes: JSON.stringify({ userId }),
        source: "manual",
      });
      return res.json({ data: { success: true } });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  // ===================== Task Deliverables =====================
  const express = (await import('express')).default;
  app.use('/uploads', express.static('uploads'));

  const multer = (await import('multer')).default;
  const pathModule = await import('path');
  const uploadStorage = multer.diskStorage({
    destination: (_req: any, _file: any, cb: any) => cb(null, 'uploads/'),
    filename: (_req: any, file: any, cb: any) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      const ext = pathModule.extname(file.originalname);
      cb(null, uniqueSuffix + ext);
    },
  });
  const upload = multer({ storage: uploadStorage, limits: { fileSize: 50 * 1024 * 1024 } });

  app.post("/api/tasks/:taskId/deliverables", upload.single('file'), async (req: any, res) => {
    try {
      const taskId = parseInt(req.params.taskId);
      const task = await storage.getTaskById(taskId);
      if (!task) return res.status(404).json({ error: "任务不存在" });

      const orgId = req.orgId || task.orgId;
      const userId = req.currentUserId;
      if (task.orgId !== orgId) return res.status(403).json({ error: "无权访问该任务" });

      let deliverableData: any = {
        taskId,
        orgId,
        submittedBy: userId,
      };

      if (req.file) {
        deliverableData.type = 'file';
        deliverableData.title = req.body.title || req.file.originalname;
        deliverableData.description = req.body.description || null;
        deliverableData.fileUrl = `/uploads/${req.file.filename}`;
        deliverableData.fileName = req.file.originalname;
        deliverableData.fileSize = req.file.size;
        deliverableData.fileMimeType = req.file.mimetype;
      } else {
        const { type, title, description, linkUrl, content } = req.body;
        if (!type || !title) return res.status(400).json({ error: "type 和 title 为必填项" });
        deliverableData.type = type;
        deliverableData.title = title;
        deliverableData.description = description || null;
        if (type === 'link') deliverableData.linkUrl = linkUrl;
        if (type === 'text') deliverableData.content = content;
      }

      const existing = await storage.getDeliverablesByTaskId(taskId);
      const sameTitle = existing.filter(d => d.title === deliverableData.title && d.type === deliverableData.type);
      const maxVersion = sameTitle.length > 0 ? Math.max(...sameTitle.map(d => d.version)) : 0;
      deliverableData.version = maxVersion + 1;

      if (maxVersion > 0) {
        await storage.markPreviousVersions(taskId, deliverableData.type, deliverableData.title);
      }

      const deliverable = await storage.createDeliverable(deliverableData);

      await storage.createActivityLog({
        orgId,
        userId: getActivityUserId(req.body, userId),
        entityType: "task",
        entityId: taskId,
        action: "add_deliverable",
        changes: JSON.stringify({ deliverableId: deliverable.id, type: deliverable.type, title: deliverable.title }),
        source: "manual",
      });

      return res.json({ data: deliverable });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/tasks/:taskId/deliverables/from-chat", authMiddleware, async (req: any, res) => {
    try {
      const taskId = parseInt(req.params.taskId);
      const { messageId, title, format } = req.body;
      const userId = req.currentUserId;
      const orgId = req.orgId;

      if (!messageId) return res.status(400).json({ error: "messageId 为必填项" });

      const task = await storage.getTaskById(taskId);
      if (!task) return res.status(404).json({ error: "任务不存在" });
      if (task.orgId !== orgId) return res.status(403).json({ error: "无权访问该任务" });

      const isAssignee = task.assigneeId === userId;
      const isCreator = task.creatorId === userId;
      const userRole = req.userRole;
      const isAdminOrOwner = userRole === 'owner' || userRole === 'admin';
      if (!isAssignee && !isCreator && !isAdminOrOwner) {
        return res.status(403).json({ error: "只有任务的指派人、创建者或管理员可以操作" });
      }

      const chatMessage = await storage.getChatMessageById(messageId);
      if (!chatMessage) return res.status(404).json({ error: "聊天消息不存在" });

      const conversation = await storage.getConversationById(chatMessage.conversationId);
      if (!conversation || conversation.orgId !== orgId || conversation.userId !== userId) {
        return res.status(403).json({ error: "无权访问该聊天消息" });
      }

      const content = chatMessage.content;
      const deliverableTitle = title || content.slice(0, 30).replace(/\n/g, ' ') || 'AI 生成内容';

      const existing = await storage.getDeliverablesByTaskId(taskId);
      const sameTitle = existing.filter(d => d.title === deliverableTitle && d.type === 'text');
      const maxVersion = sameTitle.length > 0 ? Math.max(...sameTitle.map(d => d.version)) : 0;

      if (maxVersion > 0) {
        await storage.markPreviousVersions(taskId, 'text', deliverableTitle);
      }

      const deliverable = await storage.createDeliverable({
        taskId,
        orgId,
        type: 'text',
        title: deliverableTitle,
        description: `来源: AI 对话 (消息 #${messageId}, 格式: ${format || 'markdown'})`,
        content,
        submittedBy: userId,
        version: maxVersion + 1,
      });

      await storage.createActivityLog({
        orgId,
        userId,
        entityType: "task",
        entityId: taskId,
        action: "add_deliverable",
        changes: JSON.stringify({ deliverableId: deliverable.id, type: 'text', title: deliverableTitle, source: 'ai_chat', messageId }),
        source: "ai",
      });

      return res.json({ data: deliverable });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/tasks/:taskId/deliverables", authMiddleware, async (req: any, res) => {
    try {
      const taskId = parseInt(req.params.taskId);
      const task = await storage.getTaskById(taskId);
      if (!task) return res.status(404).json({ error: "任务不存在" });

      const onlyLatest = req.query.latest === 'true';
      const data = await storage.getDeliverablesByTaskId(taskId, onlyLatest);
      return res.json({ data });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.delete("/api/tasks/:taskId/deliverables/:id", authMiddleware, async (req: any, res) => {
    try {
      const taskId = parseInt(req.params.taskId);
      const id = parseInt(req.params.id);
      const deliverable = await storage.getDeliverableById(id);
      if (!deliverable) return res.status(404).json({ error: "交付物不存在" });
      if (deliverable.taskId !== taskId) return res.status(400).json({ error: "交付物不属于该任务" });

      const userId = req.currentUserId;
      const orgId = req.orgId;
      const user = await storage.getUserById(userId);
      if (deliverable.submittedBy !== userId && user?.role !== 'owner' && user?.role !== 'admin') {
        return res.status(403).json({ error: "无权删除该交付物" });
      }

      if (deliverable.fileUrl) {
        try {
          const fs = await import('fs');
          const filePath = (await import('path')).join(process.cwd(), deliverable.fileUrl);
          if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        } catch {}
      }

      await storage.deleteDeliverable(id);

      await storage.createActivityLog({
        orgId: orgId || deliverable.orgId,
        userId: getActivityUserId(req.body, userId),
        entityType: "task",
        entityId: taskId,
        action: "delete_deliverable",
        changes: JSON.stringify({ deliverableId: id, title: deliverable.title }),
        source: "manual",
      });

      return res.json({ data: { success: true } });
    } catch (e: any) {
      if (e.message.includes('已关联')) return res.status(400).json({ error: e.message });
      return res.status(500).json({ error: e.message });
    }
  });

  // ===================== Task Submissions =====================
  app.post("/api/tasks/:taskId/submissions", authMiddleware, async (req: any, res) => {
    try {
      const taskId = parseInt(req.params.taskId);
      const task = await storage.getTaskById(taskId);
      if (!task) return res.status(404).json({ error: "任务不存在" });

      const userId = req.currentUserId;
      const orgId = req.orgId || task.orgId;

      if (task.assigneeId !== userId) {
        return res.status(403).json({ error: "只有任务负责人才能提交审核" });
      }

      if (!['in_progress', 'revision_requested'].includes(task.status)) {
        return res.status(400).json({ error: `当前任务状态为「${task.status}」，只有「进行中」或「需要修改」的任务可以提交审核` });
      }

      const { note, deliverableIds } = req.body;
      if (!deliverableIds || !Array.isArray(deliverableIds) || deliverableIds.length === 0) {
        return res.status(400).json({ error: "请选择至少一个交付物" });
      }

      const deliverables = await storage.getDeliverablesByTaskId(taskId);
      const validIds = new Set(deliverables.map(d => d.id));
      const invalidIds = deliverableIds.filter((id: number) => !validIds.has(id));
      if (invalidIds.length > 0) {
        return res.status(400).json({ error: `以下交付物不属于该任务: ${invalidIds.join(', ')}` });
      }

      const submission = await storage.createSubmission({
        taskId,
        orgId,
        submittedBy: userId,
        note: note || null,
        deliverableIds,
        status: 'pending',
      });

      await storage.updateTask(taskId, { status: 'submitted' } as any);

      await storage.createActivityLog({
        orgId,
        userId: getActivityUserId(req.body, userId),
        entityType: "task",
        entityId: taskId,
        action: "submit_for_review",
        changes: JSON.stringify({ submissionId: submission.id, deliverableCount: deliverableIds.length }),
        source: "manual",
      });

      return res.json({ data: submission });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/tasks/:taskId/submissions", authMiddleware, async (req: any, res) => {
    try {
      const taskId = parseInt(req.params.taskId);
      const task = await storage.getTaskById(taskId);
      if (!task) return res.status(404).json({ error: "任务不存在" });

      const data = await storage.getSubmissionsByTaskId(taskId);
      return res.json({ data });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/organizations/:orgId/pending-reviews", authMiddleware, async (req: any, res) => {
    try {
      const orgId = parseInt(req.params.orgId);
      const userId = req.currentUserId;
      const user = await storage.getUserById(userId);
      if (!user || (user.role !== 'owner' && user.role !== 'admin' && user.role !== 'head')) {
        return res.status(403).json({ error: "无权查看待审核列表" });
      }

      const data = await storage.getPendingSubmissionsByOrgId(orgId);
      return res.json({ data });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.put("/api/tasks/:taskId/submissions/:submissionId/review", authMiddleware, async (req: any, res) => {
    try {
      const taskId = parseInt(req.params.taskId);
      const submissionId = parseInt(req.params.submissionId);
      const task = await storage.getTaskById(taskId);
      if (!task) return res.status(404).json({ error: "任务不存在" });

      const userId = req.currentUserId;
      const user = await storage.getUserById(userId);
      if (!user || (user.role !== 'owner' && user.role !== 'admin' && user.role !== 'head')) {
        return res.status(403).json({ error: "无权审核" });
      }

      const submission = await storage.getSubmissionById(submissionId);
      if (!submission) return res.status(404).json({ error: "提交记录不存在" });
      if (submission.taskId !== taskId) return res.status(400).json({ error: "提交记录不属于该任务" });
      if (submission.status !== 'pending') return res.status(400).json({ error: "该提交已被审核" });

      const { status, reviewNote, overallScore } = req.body;
      if (!['approved', 'rejected', 'revision_requested'].includes(status)) {
        return res.status(400).json({ error: "无效的审核状态" });
      }

      const updated = await storage.updateSubmission(submissionId, {
        status,
        reviewedBy: userId,
        reviewedAt: new Date(),
        reviewNote: reviewNote || null,
        overallScore: overallScore || null,
      });

      if (status === 'approved') {
        await storage.updateTask(taskId, { status: 'done', completedAt: new Date() } as any);
      } else if (status === 'rejected' || status === 'revision_requested') {
        await storage.updateTask(taskId, { status: 'in_progress' } as any);
      }

      await storage.createActivityLog({
        orgId: task.orgId,
        userId: getActivityUserId(req.body, userId),
        entityType: "task",
        entityId: taskId,
        action: status === 'approved' ? 'approve_submission' : status === 'rejected' ? 'reject_submission' : 'request_revision',
        changes: JSON.stringify({ submissionId, status, score: overallScore }),
        source: "manual",
      });

      return res.json({ data: updated });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  // ===================== Activity Logs =====================
  app.get("/api/activity-logs", authMiddleware, async (req: any, res) => {
    try {
      const filters: { entityType?: string; entityId?: number } = {};
      if (req.query.entityType) filters.entityType = req.query.entityType as string;
      if (req.query.entityId) filters.entityId = parseInt(req.query.entityId as string);
      const allLogs = await storage.getActivityLogs(Object.keys(filters).length > 0 ? filters : undefined);
      const data = allLogs.filter((l: any) => l.orgId === req.orgId);
      return res.json({ data });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  // ===================== Graph Visualization =====================
  app.get("/api/graph/data", authMiddleware, async (req: any, res) => {
    try {
      const { projectId, deptId, status } = req.query;

      const projectColors = [
        '#6366f1', '#f59e0b', '#10b981', '#ef4444', '#3b82f6',
        '#ec4899', '#8b5cf6', '#14b8a6', '#f97316', '#64748b',
      ];

      const defaultDeptColor = '#9ca3af';

      // Get all tasks with filters
      const taskFilters: any = {};
      if (projectId) taskFilters.projectId = parseInt(projectId as string);
      if (status) {
        // status is comma-separated
      }

      const rawTasks = await storage.getTasks(taskFilters);
      const allTasks = rawTasks.filter((t: any) => t.orgId === req.orgId);
      
      // Get all projects for color mapping
      const rawProjects = await storage.getProjects();
      const allProjects = rawProjects.filter((p: any) => p.orgId === req.orgId);
      const projectMap = new Map(allProjects.map(p => [p.id, p]));

      // Get all departments for color mapping
      const rawDepartments = await storage.getDepartments();
      const allDepartments = rawDepartments.filter((d: any) => d.orgId === req.orgId);
      const deptMap = new Map(allDepartments.map(d => [d.id, d]));

      // Get all users for assignee names
      const allUsers = await storage.getUsers();
      const userMap = new Map(allUsers.map(u => [u.id, u]));

      // Get all dependencies
      const allDeps = await storage.getAllTaskDependencies();

      // Filter by status if provided
      const statusFilter = status ? (status as string).split(',') : null;

      // Filter: only top-level tasks (parentTaskId === null), apply filters
      let filteredTasks = allTasks.filter(t => t.parentTaskId === null);
      if (deptId) {
        const deptIdNum = parseInt(deptId as string);
        const projectsInDept = allProjects.filter(p => p.deptId === deptIdNum).map(p => p.id);
        filteredTasks = filteredTasks.filter(t => projectsInDept.includes(t.projectId));
      }
      if (statusFilter) {
        filteredTasks = filteredTasks.filter(t => statusFilter.includes(t.status));
      }

      // Check which tasks have subtasks
      const tasksWithSubtasks = new Set(
        allTasks.filter(t => t.parentTaskId !== null).map(t => t.parentTaskId)
      );

      const now = new Date();
      const filteredIds = new Set(filteredTasks.map(t => t.id));

      const projectColorMap = new Map<number, string>();
      const projectIds = Array.from(new Set(filteredTasks.map(t => t.projectId)));
      projectIds.forEach((pid, idx) => {
        projectColorMap.set(pid, projectColors[idx % projectColors.length]);
      });

      const nodes = filteredTasks.map(t => {
        const project = projectMap.get(t.projectId);
        const assignee = t.assigneeId ? userMap.get(t.assigneeId) : null;
        const nodeDeptId = project?.deptId ?? null;
        const dept = nodeDeptId ? deptMap.get(nodeDeptId) : null;
        return {
          id: t.id,
          title: t.title,
          status: t.status,
          priority: t.priority,
          weight: t.weight,
          progress: t.progress,
          projectId: t.projectId,
          projectName: project?.name ?? '',
          projectColor: projectColorMap.get(t.projectId) ?? defaultDeptColor,
          deptId: nodeDeptId,
          deptColor: dept?.color ?? defaultDeptColor,
          assigneeId: t.assigneeId,
          assigneeName: assignee?.displayName ?? null,
          dueDate: t.dueDate ? t.dueDate.toISOString() : null,
          isOverdue: !!(t.dueDate && t.dueDate < now && t.status !== 'done' && t.status !== 'cancelled'),
          type: t.type,
          parentTaskId: t.parentTaskId,
          hasSubtasks: tasksWithSubtasks.has(t.id),
        };
      });

      // Build a map of task statuses for isBlocking calculation
      const taskStatusMap = new Map(allTasks.map(t => [t.id, t.status]));

      const links = allDeps
        .filter(d => filteredIds.has(d.taskId) && filteredIds.has(d.dependsOnTaskId))
        .map(d => ({
          source: d.dependsOnTaskId,
          target: d.taskId,
          type: d.type,
          isBlocking: taskStatusMap.get(d.dependsOnTaskId) !== 'done',
        }));

      const projectsUsed = Array.from(new Set(filteredTasks.map(t => t.projectId)));
      const projectsInfo = projectsUsed.map((pid, idx) => ({
        id: pid,
        name: projectMap.get(pid)?.name ?? '',
        color: projectColors[idx % projectColors.length],
      }));

      const deptIds = new Set(nodes.map(n => n.deptId).filter(Boolean));
      const departmentsInfo = Array.from(deptIds).map(did => {
        const d = deptMap.get(did!);
        return { id: did!, name: d?.name ?? '', color: d?.color ?? defaultDeptColor };
      });

      return res.json({ data: { nodes, links, projects: projectsInfo, departments: departmentsInfo } });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/graph/subtasks/:taskId", authMiddleware, async (req: any, res) => {
    try {
      const taskId = parseInt(req.params.taskId);
      const allTasks = await storage.getTasks({ parentTaskId: taskId });
      const allProjects = await storage.getProjects();
      const projectMap = new Map(allProjects.map(p => [p.id, p]));
      const allUsers = await storage.getUsers();
      const userMap = new Map(allUsers.map(u => [u.id, u]));
      const allDeps = await storage.getAllTaskDependencies();
      const allTasksAll = await storage.getTasks({});
      const tasksWithSubtasks = new Set(
        allTasksAll.filter(t => t.parentTaskId !== null).map(t => t.parentTaskId)
      );
      const now = new Date();
      const subtaskIds = new Set(allTasks.map(t => t.id));
      const taskStatusMap = new Map(allTasksAll.map(t => [t.id, t.status]));

      const nodes = allTasks.map(t => {
        const project = projectMap.get(t.projectId);
        const assignee = t.assigneeId ? userMap.get(t.assigneeId) : null;
        return {
          id: t.id,
          title: t.title,
          status: t.status,
          priority: t.priority,
          weight: t.weight,
          progress: t.progress,
          projectId: t.projectId,
          projectName: project?.name ?? '',
          deptId: project?.deptId ?? null,
          assigneeId: t.assigneeId,
          assigneeName: assignee?.displayName ?? null,
          dueDate: t.dueDate ? t.dueDate.toISOString() : null,
          isOverdue: !!(t.dueDate && t.dueDate < now && t.status !== 'done' && t.status !== 'cancelled'),
          type: t.type,
          parentTaskId: t.parentTaskId,
          hasSubtasks: tasksWithSubtasks.has(t.id),
        };
      });

      const links = allDeps
        .filter(d => subtaskIds.has(d.taskId) && subtaskIds.has(d.dependsOnTaskId))
        .map(d => ({
          source: d.dependsOnTaskId,
          target: d.taskId,
          type: d.type,
          isBlocking: taskStatusMap.get(d.dependsOnTaskId) !== 'done',
        }));

      const projectColors = [
        '#6366f1', '#f59e0b', '#10b981', '#ef4444', '#3b82f6',
        '#ec4899', '#8b5cf6', '#14b8a6', '#f97316', '#64748b',
      ];
      const projectsUsed = Array.from(new Set(allTasks.map(t => t.projectId)));
      const projectsInfo = projectsUsed.map((pid, idx) => ({
        id: pid,
        name: projectMap.get(pid)?.name ?? '',
        color: projectColors[idx % projectColors.length],
      }));

      return res.json({ data: { nodes, links, projects: projectsInfo } });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  // ===================== Cross-Department Collaboration Health =====================
  app.get("/api/graph/collaboration-health", authMiddleware, async (req: any, res) => {
    try {
      const allTasks = await storage.getTasks({});
      const allProjects = await storage.getProjects();
      const allUsers = await storage.getUsers();
      const allDepartments = await storage.getDepartments();

      const projectMap = new Map(allProjects.map(p => [p.id, p]));
      const userMap = new Map(allUsers.map(u => [u.id, u]));

      const userDeptMap = new Map<number, number | null>();
      for (const u of allUsers) {
        userDeptMap.set(u.id, u.deptId ?? null);
      }

      const crossDeptPairs = new Map<string, {
        deptA: number;
        deptB: number;
        total: number;
        completed: number;
        overdue: number;
        blocked: number;
        active: number;
      }>();

      const now = new Date();

      for (const task of allTasks) {
        const project = projectMap.get(task.projectId);
        const projectDeptId = project?.deptId ?? null;
        const assigneeDeptId = task.assigneeId ? userDeptMap.get(task.assigneeId) ?? null : null;

        if (projectDeptId === null || assigneeDeptId === null) continue;
        if (projectDeptId === assigneeDeptId) continue;

        const dA = Math.min(projectDeptId, assigneeDeptId);
        const dB = Math.max(projectDeptId, assigneeDeptId);
        const key = `${dA}-${dB}`;

        if (!crossDeptPairs.has(key)) {
          crossDeptPairs.set(key, { deptA: dA, deptB: dB, total: 0, completed: 0, overdue: 0, blocked: 0, active: 0 });
        }
        const pair = crossDeptPairs.get(key)!;
        pair.total++;

        if (task.status === 'done') pair.completed++;
        if (task.status === 'blocked') pair.blocked++;
        if (task.status !== 'done' && task.status !== 'cancelled') pair.active++;
        if (task.dueDate && task.dueDate < now && task.status !== 'done' && task.status !== 'cancelled') pair.overdue++;
      }

      const results = Array.from(crossDeptPairs.values()).map(pair => {
        const volumeScore = Math.min(pair.total / 10, 1);
        const completionScore = pair.total > 0 ? pair.completed / pair.total : 0;
        const timelinessScore = pair.total > 0 ? 1 - (pair.overdue / pair.total) : 1;
        const flowScore = pair.active > 0 ? 1 - (pair.blocked / pair.active) : 1;

        const healthScore = 0.15 * volumeScore + 0.30 * completionScore + 0.25 * timelinessScore + 0.30 * flowScore;

        return {
          deptA: pair.deptA,
          deptB: pair.deptB,
          healthScore: Math.round(healthScore * 1000) / 1000,
          taskCount: pair.total,
          metrics: {
            volume: Math.round(volumeScore * 1000) / 1000,
            completion: Math.round(completionScore * 1000) / 1000,
            timeliness: Math.round(timelinessScore * 1000) / 1000,
            flow: Math.round(flowScore * 1000) / 1000,
          },
        };
      });

      const deptIds = new Set<number>();
      results.forEach(r => { deptIds.add(r.deptA); deptIds.add(r.deptB); });
      const deptMap = new Map(allDepartments.map(d => [d.id, d]));
      const allDeptIds = new Set(allDepartments.map(d => d.id));

      allDeptIds.forEach(id => deptIds.add(id));

      for (const dA of deptIds) {
        for (const dB of deptIds) {
          if (dA >= dB) continue;
          const key = `${dA}-${dB}`;
          if (!crossDeptPairs.has(key)) {
            results.push({
              deptA: dA,
              deptB: dB,
              healthScore: 0.55,
              taskCount: 0,
              metrics: { volume: 0, completion: 0, timeliness: 1, flow: 1 },
            });
          }
        }
      }

      return res.json({ data: results });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/graph/ai-analysis", authMiddleware, async (req: any, res) => {
    try {
      const allTasks = await storage.getTasks({});
      const allDeps = await storage.getAllTaskDependencies();
      const allUsers = await storage.getUsers();
      const allProjects = await storage.getProjects();

      const activeTasks = allTasks.filter(t => t.status !== 'done' && t.status !== 'cancelled');
      const userMap = new Map(allUsers.map(u => [u.id, u.displayName || u.email || `User ${u.id}`]));
      const projectMap = new Map(allProjects.map(p => [p.id, p.name]));

      const depsByTask = new Map<number, number[]>();
      for (const dep of allDeps) {
        if (!depsByTask.has(dep.taskId)) depsByTask.set(dep.taskId, []);
        depsByTask.get(dep.taskId)!.push(dep.dependsOnTaskId);
      }

      const taskSummaries = activeTasks.map(t => ({
        id: t.id,
        title: t.title,
        status: t.status,
        priority: t.priority,
        progress: t.progress ?? 0,
        assignee: t.assigneeId ? userMap.get(t.assigneeId) || 'Unknown' : 'Unassigned',
        project: projectMap.get(t.projectId) || 'Unknown',
        dueDate: t.dueDate ? new Date(t.dueDate).toISOString().split('T')[0] : null,
        isOverdue: t.dueDate ? new Date(t.dueDate) < new Date() : false,
        dependsOn: depsByTask.get(t.id) || [],
        blocksOthers: allDeps.filter(d => d.dependsOnTaskId === t.id).map(d => d.taskId),
      }));

      const OpenAI = (await import('openai')).default;
      const client = new OpenAI({
        baseURL: 'https://api.anthropic.com/v1/',
        apiKey: process.env.CLAUDE_SIMPLE_API_KEY,
        timeout: 30000,
      });

      const systemPrompt = `You are a project management analyst. Analyze the following active tasks and identify:

1. **followUp**: Tasks that most urgently need follow-up action (e.g., overdue, stalled, low progress with approaching deadline)
2. **important**: The most strategically important tasks (e.g., milestones, high-weight tasks, tasks that many others depend on)
3. **bottleneck**: Tasks that are blocking progress or are bottleneck/chokepoints (e.g., blocked tasks, tasks with many downstream dependencies that are not progressing)

Today's date: ${new Date().toISOString().split('T')[0]}

Return a JSON object with exactly this structure (no markdown, no code fence):
{
  "followUp": [{ "id": <taskId>, "reason": "<brief reason in Chinese>" }],
  "important": [{ "id": <taskId>, "reason": "<brief reason in Chinese>" }],
  "bottleneck": [{ "id": <taskId>, "reason": "<brief reason in Chinese>" }]
}

Each array should have 2-5 items. A task can appear in multiple categories. Keep reasons concise (under 20 chars).`;

      const response = await client.chat.completions.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2048,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: JSON.stringify(taskSummaries, null, 2) },
        ],
      });

      const content = response.choices[0]?.message?.content || '{}';
      const cleaned = content.replace(/```json\n?|```\n?/g, '').trim();
      const analysis = JSON.parse(cleaned);

      return res.json({ data: analysis });
    } catch (e: any) {
      console.error('AI graph analysis error:', e.message);
      return res.status(500).json({ error: e.message });
    }
  });

  // ===================== Job Roles =====================
  app.get("/api/job-roles", authMiddleware, async (req: any, res) => {
    try {
      const allRoles = await storage.getJobRoles();
      const data = allRoles.filter((r: any) => r.orgId === req.orgId);
      return res.json({ data });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/job-roles", authMiddleware, async (req: any, res) => {
    try {
      const parsed = insertJobRoleSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
      const role = await storage.createJobRole(parsed.data);
      await storage.createActivityLog({
        orgId: role.orgId,
        userId: getActivityUserId(req.body, req.currentUserId),
        entityType: "job_role",
        entityId: role.id,
        action: "create",
        changes: JSON.stringify(parsed.data),
        source: "manual",
      });
      return res.status(201).json({ data: role });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.patch("/api/job-roles/:id", authMiddleware, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const existing = await storage.getJobRoleById(id);
      if (!existing) return res.status(404).json({ error: "Job role not found" });
      const updated = await storage.updateJobRole(id, req.body);
      await storage.createActivityLog({
        orgId: existing.orgId,
        userId: getActivityUserId(req.body, req.currentUserId),
        entityType: "job_role",
        entityId: id,
        action: "update",
        changes: JSON.stringify(req.body),
        source: "manual",
      });
      return res.json({ data: updated });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.delete("/api/job-roles/:id", authMiddleware, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const existing = await storage.getJobRoleById(id);
      if (!existing) return res.status(404).json({ error: "Job role not found" });
      await storage.deleteJobRole(id);
      await storage.createActivityLog({
        orgId: existing.orgId,
        userId: getActivityUserId(req.body, req.currentUserId),
        entityType: "job_role",
        entityId: id,
        action: "delete",
        changes: JSON.stringify({ id, title: existing.title }),
        source: "manual",
      });
      return res.json({ data: { success: true } });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.patch("/api/users/:id/job-role", authMiddleware, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const existing = await storage.getUserById(id);
      if (!existing) return res.status(404).json({ error: "User not found" });
      const { jobRoleId } = req.body;
      const updated = await storage.updateUser(id, { jobRoleId });
      await storage.createActivityLog({
        orgId: existing.orgId,
        userId: getActivityUserId(req.body, req.currentUserId),
        entityType: "user",
        entityId: id,
        action: "assign_job_role",
        changes: JSON.stringify({ jobRoleId }),
        source: "manual",
      });
      return res.json({ data: updated });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  // ===================== Verdicts =====================
  app.post("/api/verdicts/judge", authMiddleware, async (req: any, res) => {
    try {
      const { taskId, userId, requestedBy } = req.body;
      if (!taskId || !userId) return res.status(400).json({ error: "taskId and userId are required" });

      const task = await storage.getTaskById(taskId);
      if (!task) return res.status(404).json({ error: "Task not found" });
      if (task.orgId !== req.orgId) return res.status(403).json({ error: "Access denied" });

      const orgId = req.orgId;
      const reqUserId = requestedBy || req.currentUserId;
      const verdictResult = await judgeTaskAssignment(taskId, userId, req.orgId);

      const verdict = await storage.createVerdict({
        orgId,
        taskId,
        userId,
        verdict: verdictResult.verdict,
        confidence: verdictResult.confidence,
        reasoning: verdictResult.reasoning,
        matchedResponsibilities: JSON.stringify(verdictResult.matchedResponsibilities),
        suggestedAssignee: verdictResult.suggestedAssigneeId,
        suggestedReason: verdictResult.suggestedReason,
        requestedBy: reqUserId,
        status: 'completed',
      });

      if (verdictResult.tokenUsage) {
        const { calculateCost } = await import('./services/ai/tokenCost');
        const cost = calculateCost(verdictResult.tokenUsage.model, verdictResult.tokenUsage.promptTokens, verdictResult.tokenUsage.completionTokens);
        try {
          await storage.createTokenUsage({
            orgId,
            userId: reqUserId,
            model: verdictResult.tokenUsage.model,
            promptTokens: verdictResult.tokenUsage.promptTokens,
            completionTokens: verdictResult.tokenUsage.completionTokens,
            totalTokens: verdictResult.tokenUsage.totalTokens,
            costUsd: cost,
            purpose: 'verdict',
          });
        } catch (tokenErr) {
          console.error('Failed to record verdict token usage:', tokenErr);
        }
      }

      const suggestedUser = verdictResult.suggestedAssigneeId
        ? await storage.getUserById(verdictResult.suggestedAssigneeId)
        : null;

      await storage.createActivityLog({
        orgId,
        userId: reqUserId,
        entityType: "verdict",
        entityId: verdict.id,
        action: "judge",
        changes: JSON.stringify({ taskId, userId, verdict: verdictResult.verdict }),
        source: "system",
      });

      return res.json({
        data: {
          verdict: {
            id: verdict.id,
            verdict: verdict.verdict,
            confidence: verdict.confidence,
            reasoning: verdict.reasoning,
            matchedResponsibilities: verdictResult.matchedResponsibilities,
            suggestedAssignee: suggestedUser ? {
              id: suggestedUser.id,
              name: suggestedUser.displayName,
              reason: verdictResult.suggestedReason,
            } : undefined,
          },
        },
      });
    } catch (e: any) {
      console.error('Verdict judge error:', e);
      return res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/verdicts/judge-assignment", authMiddleware, async (req: any, res) => {
    try {
      const { taskId, userId, requestedBy } = req.body;
      if (!taskId || !userId) return res.status(400).json({ error: "taskId and userId are required" });

      const task = await storage.getTaskById(taskId);
      if (!task) return res.status(404).json({ error: "Task not found" });
      if (task.orgId !== req.orgId) return res.status(403).json({ error: "Access denied" });

      const orgId = req.orgId;
      const reqUserId = requestedBy || req.currentUserId;
      const verdictResult = await judgeTaskAssignment(taskId, userId, req.orgId);

      const verdict = await storage.createVerdict({
        orgId,
        taskId,
        userId,
        verdict: verdictResult.verdict,
        confidence: verdictResult.confidence,
        reasoning: verdictResult.reasoning,
        matchedResponsibilities: JSON.stringify(verdictResult.matchedResponsibilities),
        suggestedAssignee: verdictResult.suggestedAssigneeId,
        suggestedReason: verdictResult.suggestedReason,
        requestedBy: reqUserId,
        status: 'completed',
      });

      if (verdictResult.tokenUsage) {
        const { calculateCost } = await import('./services/ai/tokenCost');
        const cost = calculateCost(verdictResult.tokenUsage.model, verdictResult.tokenUsage.promptTokens, verdictResult.tokenUsage.completionTokens);
        try {
          await storage.createTokenUsage({
            orgId,
            userId: reqUserId,
            model: verdictResult.tokenUsage.model,
            promptTokens: verdictResult.tokenUsage.promptTokens,
            completionTokens: verdictResult.tokenUsage.completionTokens,
            totalTokens: verdictResult.tokenUsage.totalTokens,
            costUsd: cost,
            purpose: 'verdict',
          });
        } catch (tokenErr) {
          console.error('Failed to record verdict token usage:', tokenErr);
        }
      }

      return res.json({ data: verdict });
    } catch (e: any) {
      console.error('Verdict judge-assignment error:', e);
      return res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/verdicts/task/:taskId", authMiddleware, async (req: any, res) => {
    try {
      const taskId = parseInt(req.params.taskId);
      const data = await storage.getVerdictsByTaskId(taskId);
      return res.json({ data });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/verdicts/user/:userId", authMiddleware, async (req: any, res) => {
    try {
      const userId = parseInt(req.params.userId);
      const data = await storage.getVerdictsByUserId(userId);
      return res.json({ data });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.patch("/api/verdicts/:id/accept", authMiddleware, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const existing = await storage.getVerdictById(id);
      if (!existing) return res.status(404).json({ error: "Verdict not found" });
      const updated = await storage.updateVerdict(id, { status: 'accepted' });
      await storage.createActivityLog({
        orgId: existing.orgId,
        userId: getActivityUserId(req.body, req.currentUserId),
        entityType: "verdict",
        entityId: id,
        action: "accept",
        changes: JSON.stringify({ status: 'accepted' }),
        source: "manual",
      });
      return res.json({ data: updated });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.patch("/api/verdicts/:id/override", authMiddleware, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const existing = await storage.getVerdictById(id);
      if (!existing) return res.status(404).json({ error: "Verdict not found" });
      const { overrideReason } = req.body;
      if (!overrideReason) return res.status(400).json({ error: "overrideReason is required" });
      const updated = await storage.updateVerdict(id, { status: 'overridden', overrideReason });
      await storage.createActivityLog({
        orgId: existing.orgId,
        userId: getActivityUserId(req.body, req.currentUserId),
        entityType: "verdict",
        entityId: id,
        action: "override",
        changes: JSON.stringify({ status: 'overridden', overrideReason }),
        source: "manual",
      });
      return res.json({ data: updated });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/verdicts/stats", authMiddleware, async (req: any, res) => {
    try {
      const allVerdicts = await storage.getAllVerdicts();
      const allUsers = await storage.getUsers();
      const orgUserIds = new Set(allUsers.filter((u: any) => u.orgId === req.orgId).map(u => u.id));
      const orgVerdicts = allVerdicts.filter(v => orgUserIds.has(v.userId));
      const userMap = new Map(allUsers.map(u => [u.id, u]));

      const statsByUser: Record<number, { displayName: string; in_scope: number; stretch: number; out_of_scope: number; shared: number; total: number }> = {};

      for (const v of orgVerdicts) {
        if (!statsByUser[v.userId]) {
          const user = userMap.get(v.userId);
          statsByUser[v.userId] = {
            displayName: user?.displayName ?? 'Unknown',
            in_scope: 0,
            stretch: 0,
            out_of_scope: 0,
            shared: 0,
            total: 0,
          };
        }
        const s = statsByUser[v.userId];
        if (v.verdict === 'in_scope') s.in_scope++;
        else if (v.verdict === 'stretch') s.stretch++;
        else if (v.verdict === 'out_of_scope') s.out_of_scope++;
        else if (v.verdict === 'shared') s.shared++;
        s.total++;
      }

      return res.json({ data: Object.entries(statsByUser).map(([userId, stats]) => ({ userId: parseInt(userId), ...stats })) });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  // ===================== Notifications =====================
  app.get("/api/notifications", authMiddleware, async (req: any, res) => {
    try {
      const userId = parseInt(req.query.userId as string) || req.currentUserId;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
      const data = await storage.getNotificationsByUserId(userId, limit);
      const allUsers = await storage.getUsers();
      const enriched = data.map(n => ({
        ...n,
        triggeredByUser: allUsers.find(u => u.id === n.triggeredBy) || null,
      }));
      return res.json({ data: enriched });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/notifications/unread-count", authMiddleware, async (req: any, res) => {
    try {
      const userId = parseInt(req.query.userId as string) || req.currentUserId;
      const count = await storage.getUnreadNotificationCount(userId);
      return res.json({ data: { count } });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.patch("/api/notifications/:id/read", authMiddleware, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const notification = await storage.markNotificationRead(id);
      return res.json({ data: notification });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/notifications/mark-all-read", authMiddleware, async (req: any, res) => {
    try {
      const userId = req.body.userId || req.currentUserId;
      await storage.markAllNotificationsRead(userId);
      return res.json({ data: { success: true } });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  // ===================== Stats Overview =====================
  app.get("/api/stats/overview", authMiddleware, async (req: any, res) => {
    try {
      const allTasks = await storage.getTasks({});
      const tasks = allTasks.filter((t: any) => t.orgId === req.orgId);
      const now = new Date();

      const totalTasks = tasks.length;
      const inProgressCount = tasks.filter(t => t.status === "in_progress").length;
      const completedCount = tasks.filter(t => t.status === "done").length;
      const overdueCount = tasks.filter(t => {
        if (t.status === "done" || t.status === "cancelled") return false;
        if (!t.dueDate) return false;
        return new Date(t.dueDate) < now;
      }).length;
      const needsReviewCount = tasks.filter(t => t.needsReview).length;
      const decisionStats = await storage.getDecisionTaskStats(req.orgId);

      const todayStart = new Date(now);
      todayStart.setHours(0, 0, 0, 0);

      const weekStart = new Date(todayStart);
      const dayOfWeek = weekStart.getDay();
      const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      weekStart.setDate(weekStart.getDate() - mondayOffset);

      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      const todayNew = tasks.filter(t => new Date(t.createdAt) >= todayStart).length;
      const weekNew = tasks.filter(t => new Date(t.createdAt) >= weekStart).length;
      const monthNew = tasks.filter(t => new Date(t.createdAt) >= monthStart).length;

      return res.json({
        data: {
          totalTasks,
          inProgressCount,
          completedCount,
          overdueCount,
          needsReviewCount,
          pendingDecisionCount: decisionStats.pendingCount,
          todayNew,
          weekNew,
          monthNew,
        }
      });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  // ===================== Decision Tasks =====================
  app.get("/api/tasks/:id/decisions", authMiddleware, async (req: any, res) => {
    try {
      const taskId = parseInt(req.params.id);
      if (isNaN(taskId)) return res.status(400).json({ error: "Invalid task ID" });
      const task = await storage.getTaskById(taskId);
      if (!task || task.orgId !== req.orgId) {
        return res.status(404).json({ error: "Task not found" });
      }
      const decisions = await storage.getDecisionTasksForTask(taskId);
      return res.json({ data: decisions });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/decision-tasks/pending", authMiddleware, async (req: any, res) => {
    try {
      const pending = await storage.getPendingDecisionTasksForUser(req.currentUserId, req.orgId);
      return res.json({ data: pending });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  // ===================== Conversations =====================
  app.get("/api/conversations", authMiddleware, async (req: any, res) => {
    try {
      const data = await storage.getConversationsByOrg(req.orgId);
      return res.json({ data });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/conversations/search", authMiddleware, async (req: any, res) => {
    try {
      const q = String(req.query.q || '').trim();
      if (!q) return res.json({ data: [] });
      const data = await storage.searchConversations(req.orgId, q);
      return res.json({ data });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/chat-messages/recent-assistant", authMiddleware, async (req: any, res) => {
    try {
      const userId = req.currentUserId;
      const orgId = req.orgId;
      const limit = parseInt(req.query.limit as string) || 50;

      const userConvs = await storage.getConversationsByUser(orgId, userId);
      const convIds = userConvs.map(c => c.id);

      if (convIds.length === 0) return res.json({ data: [] });

      const allMessages: any[] = [];
      for (const convId of convIds.slice(0, 20)) {
        const msgs = await storage.getChatMessages(convId);
        const assistantMsgs = msgs
          .filter(m => m.role === 'assistant' && m.content && m.content.length > 100)
          .map(m => ({
            id: m.id,
            conversationId: convId,
            content: m.content,
            createdAt: m.createdAt,
            preview: m.content.slice(0, 80).replace(/\n/g, ' '),
          }));
        allMessages.push(...assistantMsgs);
      }

      allMessages.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      return res.json({ data: allMessages.slice(0, limit) });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/conversations/:id", authMiddleware, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const data = await storage.getConversationById(id);
      if (!data) return res.status(404).json({ error: "Conversation not found" });
      if (data.orgId !== req.orgId) return res.status(403).json({ error: "Access denied" });
      return res.json({ data });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/conversations", authMiddleware, async (req: any, res) => {
    try {
      const parsed = insertConversationSchema.parse(req.body);
      const data = await storage.createConversation(parsed);
      return res.json({ data });
    } catch (e: any) {
      return res.status(400).json({ error: e.message });
    }
  });

  app.patch("/api/conversations/:id", authMiddleware, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const data = await storage.updateConversation(id, req.body);
      if (!data) return res.status(404).json({ error: "Conversation not found" });
      return res.json({ data });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.delete("/api/conversations/:id", authMiddleware, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteConversation(id);
      return res.json({ data: { success: true } });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  // ===================== Chat Messages =====================
  app.get("/api/conversations/:id/messages", authMiddleware, async (req: any, res) => {
    try {
      const conversationId = parseInt(req.params.id);
      const data = await storage.getChatMessages(conversationId);
      return res.json({ data });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/conversations/:id/messages", authMiddleware, async (req: any, res) => {
    try {
      const conversationId = parseInt(req.params.id);
      const messageData = { ...req.body, conversationId };
      const parsed = insertChatMessageSchema.parse(messageData);
      const data = await storage.createChatMessage(parsed);
      return res.json({ data });
    } catch (e: any) {
      return res.status(400).json({ error: e.message });
    }
  });

  app.delete("/api/conversations/:id/messages/after/:messageId", authMiddleware, async (req: any, res) => {
    try {
      const conversationId = parseInt(req.params.id);
      const afterMessageId = parseInt(req.params.messageId);
      if (isNaN(conversationId) || isNaN(afterMessageId)) {
        return res.status(400).json({ error: 'Invalid parameters' });
      }
      const deletedCount = await storage.deleteChatMessagesAfter(conversationId, afterMessageId);
      return res.json({ data: { deletedCount } });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/conversations/:id/messages/truncate", authMiddleware, async (req: any, res) => {
    try {
      const conversationId = parseInt(req.params.id);
      const { keepCount } = req.body;
      if (isNaN(conversationId) || typeof keepCount !== 'number' || keepCount < 0) {
        return res.status(400).json({ error: 'Invalid parameters' });
      }
      const deletedCount = await storage.truncateChatMessages(conversationId, keepCount);
      return res.json({ data: { deletedCount } });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  // ===================== AI Suggest Task =====================
  app.post("/api/ai/suggest-task", authMiddleware, async (req: any, res) => {
    try {
      const { title, projectId } = req.body;
      const orgId = req.orgId || parseInt(req.headers['x-org-id'] as string) || 1;

      if (!title || !title.trim()) {
        return res.status(400).json({ error: 'title is required' });
      }

      let projectInfo = '';
      if (projectId) {
        const project = await storage.getProjectById(projectId);
        if (project) {
          projectInfo = `Project: "${project.name}" - ${project.description || 'No description'}. Status: ${project.status}.`;
        }
      }

      const allUsers = await storage.getUsers();
      const orgUsers = allUsers.filter(u => u.orgId === orgId && u.isActive !== false);
      const allJobRoles = await storage.getJobRoles();
      const jobRoleMap = new Map(allJobRoles.map(r => [r.id, r]));

      const allTasks = await storage.getTasks();
      const activeStatuses = ['todo', 'in_progress', 'in_review'];
      const taskCountByUser = new Map<number, number>();
      for (const t of allTasks) {
        if (t.assigneeId && activeStatuses.includes(t.status)) {
          taskCountByUser.set(t.assigneeId, (taskCountByUser.get(t.assigneeId) || 0) + 1);
        }
      }

      const usersContext = orgUsers.map(u => {
        const role = u.jobRoleId ? jobRoleMap.get(u.jobRoleId) : null;
        return {
          id: u.id,
          name: u.displayName,
          jobTitle: role?.title || 'N/A',
          responsibilities: role?.responsibilities || 'N/A',
          activeTaskCount: taskCountByUser.get(u.id) || 0,
        };
      });

      const OpenAI = (await import('openai')).default;
      const client = new OpenAI({
        baseURL: 'https://vip.aipro.love/v1',
        apiKey: process.env.CLAUDE_SIMPLE_API_KEY,
        timeout: 90000,
      });

      const systemPrompt = `You are a project management assistant. Given a task title and team context, suggest appropriate task fields.

${projectInfo}

Team members:
${JSON.stringify(usersContext, null, 2)}

Today's date: ${new Date().toISOString().split('T')[0]}

Based on the task title, return a JSON object (no markdown, no code fence) with:
{
  "description": "<suggested task description in Chinese, 2-3 sentences>",
  "priority": "<one of: low, medium, high, urgent>",
  "assigneeId": <user id number or null if unclear>,
  "assigneeReason": "<brief reason for assignee suggestion in Chinese>",
  "dueDays": <estimated number of days to complete, integer>,
  "confidence": <0.0 to 1.0, your confidence in these suggestions>
}

When choosing assigneeId:
1. Match the task to a user whose job responsibilities are most relevant
2. Among equally relevant users, prefer the one with fewer active tasks
3. If no user clearly matches, set assigneeId to null`;

      const response = await client.chat.completions.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        temperature: 0.3,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Task title: "${title}"` },
        ],
      });

      const content = response.choices[0]?.message?.content || '{}';
      const cleaned = content.replace(/```json\n?|```\n?/g, '').trim();
      const suggestion = JSON.parse(cleaned);

      const dueDays = suggestion.dueDays || 7;
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + dueDays);

      return res.json({
        data: {
          description: suggestion.description || '',
          priority: suggestion.priority || 'medium',
          assigneeId: suggestion.assigneeId || null,
          assigneeReason: suggestion.assigneeReason || '',
          dueDate: dueDate.toISOString().split('T')[0],
          confidence: suggestion.confidence || 0.5,
        },
      });
    } catch (e: any) {
      console.error('AI suggest-task error:', e.message);
      return res.status(500).json({ error: e.message });
    }
  });

  // ===================== AI Suggest Dependencies =====================
  app.post("/api/ai/suggest-dependencies", authMiddleware, async (req: any, res) => {
    try {
      const { taskId } = req.body;
      const orgId = parseInt(req.headers['x-org-id'] as string) || 1;

      if (!taskId) {
        return res.status(400).json({ error: 'taskId is required' });
      }

      const targetTask = await storage.getTaskById(taskId);
      if (!targetTask) {
        return res.status(404).json({ error: 'Task not found' });
      }

      const projectTasks = await storage.getTasks({ projectId: targetTask.projectId });
      const otherTasks = projectTasks.filter(t => t.id !== taskId);

      if (otherTasks.length === 0) {
        return res.json({ data: [] });
      }

      const { claudeComplete } = await import('./services/ai/index');

      const taskListStr = otherTasks.map(t =>
        `- ID: ${t.id}, Title: "${t.title}", Status: ${t.status}, Description: "${t.description || 'N/A'}"`
      ).join('\n');

      const prompt = `You are a project management expert. Analyze the following target task and determine which of the other tasks in the same project should be its prerequisites (dependencies that must be completed before the target task can start).

Target Task:
- ID: ${targetTask.id}
- Title: "${targetTask.title}"
- Description: "${targetTask.description || 'N/A'}"

Other tasks in the same project:
${taskListStr}

Return a JSON array of suggested dependencies. Each element should have:
- taskId: number (the ID of the prerequisite task)
- taskTitle: string (the title of the prerequisite task)
- reason: string (brief explanation in Chinese why this should be a prerequisite)
- confidence: number (0-100, how confident you are)

Only suggest tasks that logically should be completed before the target task. If no dependencies are needed, return an empty array.
Return ONLY the JSON array, no other text.`;

      const completion = await claudeComplete({
        model: 'claude-haiku-4-5-20251001',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 2000,
      });

      const raw = completion.content || '[]';
      let suggestions: Array<{ taskId: number; taskTitle: string; reason: string; confidence: number }> = [];
      try {
        const jsonMatch = raw.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          suggestions = JSON.parse(jsonMatch[0]);
        }
      } catch {
        suggestions = [];
      }

      const validTaskIds = new Set(otherTasks.map(t => t.id));
      suggestions = suggestions.filter(s => validTaskIds.has(s.taskId));

      return res.json({ data: suggestions });
    } catch (e: any) {
      console.error('AI suggest-dependencies error:', e);
      return res.status(500).json({ error: e.message });
    }
  });

  // ===================== AI Review Submission =====================
  app.post("/api/ai/review-submission", authMiddleware, async (req: any, res) => {
    try {
      const { taskId, submissionId } = req.body;
      const orgId = parseInt(req.headers['x-org-id'] as string) || req.orgId || 1;

      if (!taskId || !submissionId) {
        return res.status(400).json({ error: 'taskId and submissionId are required' });
      }

      const task = await storage.getTaskById(taskId);
      if (!task) return res.status(404).json({ error: 'Task not found' });

      const submission = await storage.getSubmissionById(submissionId);
      if (!submission) return res.status(404).json({ error: 'Submission not found' });
      if (submission.taskId !== taskId) return res.status(400).json({ error: 'Submission does not belong to this task' });

      const deliverableIds = (submission.deliverableIds as number[]) || [];
      const allDeliverables = await storage.getDeliverablesByTaskId(taskId);
      const deliverables = allDeliverables.filter(d => deliverableIds.includes(d.id));

      const deliverableDescriptions: string[] = [];
      for (const d of deliverables) {
        let contentStr = '';
        if (d.type === 'text' && d.content) {
          contentStr = d.content;
        } else if (d.type === 'file' && d.fileUrl) {
          try {
            const fs = await import('fs');
            const path = await import('path');
            const uploadsDir = path.resolve(process.cwd(), 'uploads');
            const filePath = path.resolve(process.cwd(), d.fileUrl);
            if (!filePath.startsWith(uploadsDir)) {
              contentStr = `[File: ${d.fileName || d.fileUrl}]`;
            } else if (fs.existsSync(filePath)) {
              const buf = fs.readFileSync(filePath, 'utf-8');
              contentStr = buf.slice(0, 3000);
            } else {
              contentStr = `[File: ${d.fileName || d.fileUrl}]`;
            }
          } catch {
            contentStr = `[File: ${d.fileName || d.fileUrl}]`;
          }
        } else if (d.type === 'link' && d.linkUrl) {
          contentStr = `[Link: ${d.linkUrl}]`;
        }
        deliverableDescriptions.push(
          `Deliverable #${d.id} (${d.type}): Title="${d.title}"${d.description ? `, Description="${d.description}"` : ''}\nContent: ${contentStr || '(empty)'}`
        );
      }

      const prompt = `You are a task submission reviewer. Evaluate the following submission for a task.

Task:
- Title: "${task.title}"
- Description: "${task.description || 'N/A'}"

Submission Note: "${submission.note || 'N/A'}"

Deliverables:
${deliverableDescriptions.join('\n\n')}

Please evaluate and return a JSON object with:
- "summary": string - A brief content summary of all deliverables combined (in Chinese)
- "relevanceScore": number (1-5) - How well the deliverables match the task description
- "qualityAssessment": string - A brief quality assessment (in Chinese)
- "suggestions": string[] - Array of improvement suggestions (in Chinese)

Return ONLY the JSON object, no other text.`;

      const { claudeComplete } = await import('./services/ai/index');

      const completion = await claudeComplete({
        model: 'claude-haiku-4-5-20251001',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 2000,
      });

      const raw = completion.content || '{}';
      let result: { summary: string; relevanceScore: number; qualityAssessment: string; suggestions: string[] };
      try {
        const jsonMatch = raw.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          result = JSON.parse(jsonMatch[0]);
        } else {
          result = { summary: raw, relevanceScore: 3, qualityAssessment: raw, suggestions: [] };
        }
      } catch {
        result = { summary: raw, relevanceScore: 3, qualityAssessment: raw, suggestions: [] };
      }

      return res.json({ data: result });
    } catch (e: any) {
      console.error('AI review-submission error:', e);
      return res.status(500).json({ error: e.message });
    }
  });

  // ===================== AI Guided Options =====================
  app.get("/api/ai/available-models", authMiddleware, async (_req: any, res) => {
    const DEFAULT_CHAT_MODELS = [
      { id: 'claude-sonnet-4-6', label: 'Sonnet 4.6', desc: '日常任务首选' },
      { id: 'claude-opus-4-6', label: 'Opus 4.6', desc: '深度分析模式' },
      { id: 'claude-haiku-4-5', label: 'Haiku 4.5', desc: '快速响应' },
      { id: 'gpt-5.4', label: 'GPT-5.4', desc: 'OpenAI 最新旗舰' },
      { id: 'deepseek-chat', label: 'DeepSeek V3.2', desc: '高性价比' },
    ];
    try {
      const val = await storage.getSystemConfig('chat_visible_models');
      if (val) {
        try {
          const parsed = JSON.parse(val);
          if (Array.isArray(parsed) && parsed.length > 0 && parsed.every((m: any) => m.id && m.label)) {
            return res.json({ data: parsed });
          }
        } catch {}
      }
      res.json({ data: DEFAULT_CHAT_MODELS });
    } catch (e: any) {
      res.json({ data: DEFAULT_CHAT_MODELS });
    }
  });

  app.get("/api/ai/guided-options", authMiddleware, async (req: any, res) => {
    try {
      const { type, projectId } = req.query;

      if (type === 'parentTasks' && projectId) {
        const tasks = await storage.getTasks({ projectId: Number(projectId) });
        const topLevelTasks = tasks.filter(t => !t.parentTaskId && t.status !== 'cancelled');
        const options = topLevelTasks.map(t => ({
          label: t.title,
          value: t.id,
          description: `${t.status} | 优先级: ${t.priority}`,
        }));
        return res.json({ data: options });
      }

      if (type === 'departments') {
        const departments = await storage.getDepartments();
        const options = departments.map(d => ({
          label: d.name,
          value: d.id,
        }));
        return res.json({ data: options });
      }

      if (type === 'users') {
        const users = await storage.getUsers();
        const jobRoles = await storage.getJobRoles();
        const roleMap = new Map(jobRoles.map(r => [r.id, r]));
        const options = users.filter(u => u.isActive).map(u => {
          const role = u.jobRoleId ? roleMap.get(u.jobRoleId) : null;
          return {
            label: u.displayName,
            value: u.id,
            description: role?.title || '',
          };
        });
        return res.json({ data: options });
      }

      if (type === 'projects') {
        const projects = await storage.getProjects();
        const options = projects.filter(p => p.status !== 'cancelled').map(p => ({
          label: p.name,
          value: p.id,
          description: p.status,
        }));
        return res.json({ data: options });
      }

      return res.status(400).json({ error: 'Invalid type parameter' });
    } catch (e: any) {
      console.error('Guided options error:', e);
      return res.status(500).json({ error: e.message });
    }
  });

  // ===================== AI Decompose Project =====================
  app.post("/api/ai/decompose-project", authMiddleware, async (req: any, res) => {
    try {
      const { projectId, projectName, projectDescription } = req.body;

      const orgId = req.orgId || parseInt(req.headers['x-org-id'] as string) || 1;

      let name = projectName || '';
      let description = projectDescription || '';
      let existingTaskTitles: string[] = [];

      if (projectId) {
        const project = await storage.getProjectById(projectId);
        if (!project) {
          return res.status(404).json({ error: 'Project not found' });
        }
        name = project.name;
        description = project.description || '';

        const existingTasks = await storage.getTasks({ projectId });
        existingTaskTitles = existingTasks.map(t => t.title);
      }

      if (!name) {
        return res.status(400).json({ error: 'projectName or projectId is required' });
      }

      const orgUsers = await storage.getUsers();
      const filteredUsers = orgUsers.filter(u => u.orgId === orgId && u.isActive);
      const jobRoles = await storage.getJobRoles();
      const jobRoleMap = new Map(jobRoles.map(r => [r.id, r]));

      const teamInfo = filteredUsers.map(u => {
        const role = u.jobRoleId ? jobRoleMap.get(u.jobRoleId) : null;
        return {
          id: u.id,
          name: u.displayName,
          jobTitle: role?.title || '',
          responsibilities: role?.responsibilities || '',
          requiredSkills: role?.requiredSkills || '',
        };
      });

      const teamBlock = teamInfo.length > 0
        ? teamInfo.map(m => `- ID:${m.id} ${m.name} | ${m.jobTitle} | ${m.responsibilities} | ${m.requiredSkills}`).join('\n')
        : '(no team members)';

      const existingBlock = existingTaskTitles.length > 0
        ? existingTaskTitles.map(t => `- ${t}`).join('\n')
        : '(none)';

      const OpenAI = (await import('openai')).default;
      const claudeClient = new OpenAI({
        baseURL: 'https://vip.aipro.love/v1',
        apiKey: process.env.CLAUDE_SIMPLE_API_KEY,
        timeout: 90000,
      });
      const genModel = 'claude-sonnet-4-6';

      const response = await claudeClient.chat.completions.create({
        model: genModel,
        max_tokens: 4096,
        messages: [
          {
            role: 'system',
            content: `You are a project management expert. Given a project and team info, generate a Work Breakdown Structure (WBS).

Output pure JSON (no markdown wrapping):
{
  "tasks": [
    {
      "title": "task title (Chinese preferred)",
      "description": "brief description",
      "priority": "medium",
      "estimatedDays": 3,
      "suggestedAssigneeId": null,
      "suggestedAssigneeName": ""
    }
  ],
  "dependencies": [
    { "fromIndex": 0, "toIndex": 1, "reason": "brief reason" }
  ]
}

Rules:
- Generate 4-10 tasks covering major work areas
- Order tasks logically
- priority: critical/high/medium/low
- estimatedDays: realistic estimate (1-30)
- suggestedAssigneeId: pick from team members by matching skills/responsibilities, or null if unclear
- suggestedAssigneeName: the name of the suggested assignee
- dependencies: fromIndex task must finish before toIndex task starts. Use 0-based indices into the tasks array.
- Do NOT duplicate any existing tasks
- Task titles and descriptions should be in Chinese`
          },
          {
            role: 'user',
            content: `Project: ${name}
Description: ${description || 'No description'}

Team members:
${teamBlock}

Existing tasks (do not duplicate):
${existingBlock}`
          }
        ],
      });

      const usage = response.usage;
      const tokenInfo = usage ? {
        model: genModel,
        promptTokens: usage.prompt_tokens ?? 0,
        completionTokens: usage.completion_tokens ?? 0,
        totalTokens: usage.total_tokens ?? 0,
      } : undefined;

      if (tokenInfo) {
        const { calculateCost } = await import('./services/ai/tokenCost');
        const cost = calculateCost(tokenInfo.model, tokenInfo.promptTokens, tokenInfo.completionTokens);
        try {
          await storage.createTokenUsage({
            orgId,
            userId: req.currentUserId,
            conversationId: null,
            model: tokenInfo.model,
            promptTokens: tokenInfo.promptTokens,
            completionTokens: tokenInfo.completionTokens,
            totalTokens: tokenInfo.totalTokens,
            costUsd: cost,
            purpose: 'chat',
          });
        } catch (tokenErr) {
          console.error('Failed to record token usage:', tokenErr);
        }
      }

      let aiText = response.choices[0]?.message?.content || '';
      const codeBlockMatch = aiText.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (codeBlockMatch) {
        aiText = codeBlockMatch[1].trim();
      }

      try {
        const parsed = JSON.parse(aiText);
        return res.json({
          data: {
            tasks: parsed.tasks || [],
            dependencies: parsed.dependencies || [],
          }
        });
      } catch {
        return res.json({ data: { tasks: [], dependencies: [] } });
      }
    } catch (e: any) {
      console.error('Project decompose error:', e);
      return res.status(500).json({ error: e.message });
    }
  });

  // ===================== User Memories =====================
  app.get("/api/user-memories", authMiddleware, async (req, res) => {
    try {
      const userId = req.currentUserId;
      const orgId = req.orgId || 1;
      const memories = await storage.getUserMemories(userId, orgId);
      return res.json({ data: memories });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/user-memories", authMiddleware, async (req, res) => {
    try {
      const userId = req.currentUserId;
      const orgId = req.orgId || 1;
      const parsed = insertUserMemorySchema.safeParse({ ...req.body, userId, orgId });
      if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
      const memory = await storage.createUserMemory(parsed.data);
      return res.status(201).json({ data: memory });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.delete("/api/user-memories/:id", authMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteUserMemory(id);
      return res.json({ data: { success: true } });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  // ===================== AI Chat Stream =====================
  app.post("/api/ai/chat/stream", authMiddleware, async (req: any, res) => {
    try {
      const { message, conversationHistory, conversationId, currentUserId, systemPrompt, model, extendedThinking, replyStyle, webSearchEnabled, codeContextEnabled, knowledgeBaseEnabled, attachments } = req.body;
      if ((!message || typeof message !== 'string') && (!attachments || attachments.length === 0)) {
        return res.status(400).json({ error: 'message is required' });
      }

      const orgId = req.orgId || 1;
      const userId = currentUserId || req.currentUserId || 1;
      const user = await storage.getUserById(userId);
      const userName = user?.displayName || 'Unknown';
      const msgText = message || '';

      let activeConvId = conversationId || null;
      let isNewConversation = false;

      if (!activeConvId) {
        isNewConversation = true;
        const tempTitle = (msgText || '附件消息').slice(0, 30) + ((msgText || '附件消息').length > 30 ? '...' : '');
        const newConv = await storage.createConversation({
          title: tempTitle,
          orgId,
          userId,
        });
        activeConvId = newConv.id;
      }

      let history = conversationHistory || [];
      if (activeConvId && history.length === 0) {
        const conv = await storage.getConversationById(activeConvId);
        if (conv && conv.orgId !== orgId) {
          return res.status(403).json({ error: 'Access denied to this conversation' });
        }
        const dbMessages = await storage.getChatMessages(activeConvId);
        history = dbMessages
          .filter(m => m.role === 'user' || m.role === 'assistant')
          .map(m => ({ role: m.role, content: m.content }));
      }

      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      });

      res.write(`data: ${JSON.stringify({ type: 'start', conversationId: activeConvId })}\n\n`);

      let fullText = '';
      let aborted = false;
      req.on('close', () => { aborted = true; });

      if (attachments && attachments.length > 0) {
        try {
          const attachmentHashes = attachments.map((att: any) => ({
            name: att.name || 'unknown',
            hash: crypto.createHash('md5').update(Buffer.from(att.base64 || '', 'base64')).digest('hex'),
          }));

          const recentWithHashes = await storage.findRecentAttachmentMessages(orgId, 7);

          for (const attHash of attachmentHashes) {
            for (const row of recentWithHashes) {
              try {
                const meta = typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata;
                if (meta?.attachmentHashes?.some((ah: any) => ah.hash === attHash.hash)) {
                  const uploadTime = new Date(row.createdAt).toLocaleString('zh-CN');
                  res.write(`data: ${JSON.stringify({
                    type: 'token',
                    content: `> **注意**: 文件「${attHash.name}」在 ${uploadTime} 已被上传过（对话 #${row.conversationId}）。如果这不是重复文件，我将继续处理。\n\n`
                  })}\n\n`);
                  fullText += `> **注意**: 文件「${attHash.name}」在 ${uploadTime} 已被上传过（对话 #${row.conversationId}）。如果这不是重复文件，我将继续处理。\n\n`;
                  break;
                }
              } catch {}
            }
          }

          setImmediate(async () => {
            try {
              await storage.createChatMessage({
                conversationId: activeConvId,
                role: 'system',
                content: '[attachment_hashes]',
                type: 'metadata',
                metadata: JSON.stringify({ attachmentHashes }),
              });
            } catch {}
          });
        } catch (hashErr) {
          console.error('Attachment hash check failed:', hashErr);
        }
      }

      let effectiveSystemPrompt = systemPrompt || '';
      if (replyStyle && replyStyle !== 'normal') {
        const styleMap: Record<string, string> = {
          concise: '请用简短直接的方式回答，避免冗长的解释。',
          detailed: '请提供深入全面的解释，包含更多细节和背景信息。',
          professional: '请用正式的商务语气回复，保持专业和严谨。',
          casual: '请用轻松友好的语气对话，像朋友之间聊天一样。',
        };
        effectiveSystemPrompt = (effectiveSystemPrompt ? effectiveSystemPrompt + '\n' : '') + (styleMap[replyStyle] || '');
      }

      if (webSearchEnabled) {
        try {
          const searchResults = await searchWeb(msgText);
          if (searchResults.results.length > 0 || searchResults.answer) {
            let searchContext = `\n\n## 网页搜索结果\n用户开启了网页搜索，以下是与用户问题相关的网页搜索结果，请参考这些信息回答：\n`;
            if (searchResults.answer) {
              searchContext += `\n搜索摘要: ${searchResults.answer}\n`;
            }
            if (searchResults.results.length > 0) {
              searchContext += `\n来源:\n`;
              searchResults.results.forEach((r, i) => {
                searchContext += `${i + 1}. ${r.title} - ${r.url}\n   ${r.content}\n`;
              });
            }
            searchContext += `\n请在回答中适当引用这些来源，并注明信息来自网络搜索。`;
            effectiveSystemPrompt = (effectiveSystemPrompt || '') + searchContext;

            if (searchResults.results.length > 0) {
              res.write(`data: ${JSON.stringify({ type: 'search_results', results: searchResults.results })}\n\n`);
            }
          }
        } catch (searchErr) {
          console.error('Web search failed:', searchErr);
        }
      }

      if (codeContextEnabled) {
        try {
          const { buildCodeContextBlock } = await import('./services/ai/codeContext');
          const { contextBlock, loadedFiles, failedFiles } = buildCodeContextBlock(msgText, true);
          effectiveSystemPrompt = (effectiveSystemPrompt || '') + '\n\n' + contextBlock;
          if (loadedFiles.length > 0 || failedFiles.length > 0) {
            res.write(`data: ${JSON.stringify({ type: 'code_files', files: loadedFiles, failedFiles })}\n\n`);
          }
        } catch (codeErr) {
          console.error('Code context failed:', codeErr);
        }
      }

      const useCodeTools = codeContextEnabled === true;
      const generator = useCodeTools
        ? codeToolChatStream(msgText, history, effectiveSystemPrompt || '', model || undefined)
        : aiChatStream(
            msgText,
            history,
            { currentUserId: userId, currentUserName: userName, customSystemPrompt: effectiveSystemPrompt || undefined, model: model || undefined, extendedThinking: extendedThinking || false, orgId, knowledgeBaseEnabled: knowledgeBaseEnabled || false, userRole: user?.role || 'member', userDeptId: user?.deptId || null },
            attachments
          );

      for await (const chunk of generator) {
        if (aborted || req.socket?.destroyed) break;

        if (chunk.type === 'tool_use' && (chunk as any).toolName) {
          const toolChunk = chunk as any;
          const toolLabel = toolChunk.toolName === 'read_file' ? `Reading ${toolChunk.toolInput?.file_path}...`
            : toolChunk.toolName === 'list_directory' ? `Browsing ${toolChunk.toolInput?.directory || 'project root'}...`
            : toolChunk.toolName === 'search_code' ? `Searching "${toolChunk.toolInput?.query}"...`
            : toolChunk.toolName === 'web_search' ? `Searching the web...`
            : `Using ${toolChunk.toolName}...`;
          const toolType = toolChunk.toolName === 'web_search' ? 'search'
            : (toolChunk.toolName === 'read_file' || toolChunk.toolName === 'list_directory') ? 'file'
            : toolChunk.toolName === 'search_code' ? 'search'
            : 'code';
          res.write(`data: ${JSON.stringify({ type: 'tool_use', toolName: toolChunk.toolName, toolInput: toolChunk.toolInput, label: toolLabel, toolType })}\n\n`);
        } else if ((chunk as any).type === 'tool_result_event') {
          const trChunk = chunk as any;
          const completedLabel = trChunk.toolName === 'read_file' ? `Read file: ${trChunk.result?.slice(0, 60) || 'done'}`
            : trChunk.toolName === 'list_directory' ? `Listed directory`
            : trChunk.toolName === 'search_code' ? `Search complete`
            : trChunk.toolName === 'web_search' ? `Searched the web`
            : `${trChunk.toolName} complete`;
          res.write(`data: ${JSON.stringify({ type: 'tool_result', toolName: trChunk.toolName, completedLabel, detail: trChunk.result || '' })}\n\n`);
        } else if (chunk.type === 'thinking' && chunk.content) {
          res.write(`data: ${JSON.stringify({ type: 'thinking', content: chunk.content })}\n\n`);
        } else if (chunk.type === 'token' && chunk.content) {
          fullText += chunk.content;
          res.write(`data: ${JSON.stringify({ type: 'token', content: chunk.content })}\n\n`);
        } else if (chunk.type === 'done') {
          if (chunk.tokenUsage) {
            const { calculateCost } = await import('./services/ai/tokenCost');
            const cost = calculateCost(
              chunk.tokenUsage.model,
              chunk.tokenUsage.promptTokens,
              chunk.tokenUsage.completionTokens
            );
            try {
              await storage.createTokenUsage({
                orgId,
                userId,
                conversationId: activeConvId || null,
                model: chunk.tokenUsage.model,
                promptTokens: chunk.tokenUsage.promptTokens,
                completionTokens: chunk.tokenUsage.completionTokens,
                totalTokens: chunk.tokenUsage.totalTokens,
                costUsd: cost,
                purpose: knowledgeBaseEnabled ? 'knowledge_qa' : 'chat',
              });
            } catch (tokenErr) {
              console.error('Failed to record token usage:', tokenErr);
            }
          }
          let displayText = fullText;
          const actionMatch = fullText.match(/<<<ACTIONS>>>\s*([\s\S]*?)\s*<<<END_ACTIONS>>>\s*$/);
          if (actionMatch) {
            displayText = fullText.slice(0, fullText.indexOf('<<<ACTIONS>>>')).trim();
            try {
              const actionData = JSON.parse(actionMatch[1].trim());
              if (actionData && actionData.type === 'interactive_input' && actionData.questions) {
                res.write(`data: ${JSON.stringify({ type: 'interactive_input', questions: actionData.questions })}\n\n`);
              } else if (actionData && (actionData.action || actionData.actions)) {
                res.write(`data: ${JSON.stringify({ type: 'action', ...actionData })}\n\n`);
              }
            } catch (parseErr) {
              console.error('Failed to parse action block:', parseErr);
            }
          }

          const docMatch = displayText.match(/<<<DOCUMENT>>>\s*([\s\S]*?)\s*<<<END_DOCUMENT>>>/);
          if (docMatch) {
            displayText = displayText.replace(/<<<DOCUMENT>>>\s*[\s\S]*?\s*<<<END_DOCUMENT>>>/g, '').trim();
            try {
              const docData = JSON.parse(docMatch[1]);
              let orgName = '';
              try { const org = await storage.getOrganizationById(orgId); if (org) orgName = org.name; } catch {}
              const { fileName } = await generateDocx({
                title: docData.title,
                content: docData.content,
                orgName,
                author: userName,
              });
              res.write(`data: ${JSON.stringify({
                type: 'document',
                title: docData.title,
                fileName,
                downloadUrl: `/api/documents/${fileName}`,
              })}\n\n`);
            } catch (docErr) {
              console.error('[Document] Generation failed:', docErr);
            }
          }

          const donePayload: any = { type: 'done', fullText: displayText };
          if (chunk.tokenUsage) {
            donePayload.tokenUsage = {
              promptTokens: chunk.tokenUsage.promptTokens,
              completionTokens: chunk.tokenUsage.completionTokens,
              totalTokens: chunk.tokenUsage.totalTokens,
            };
          }
          res.write(`data: ${JSON.stringify(donePayload)}\n\n`);
        } else if (chunk.type === 'error') {
          const errContent = chunk.content || '';
          let errorCode = 'unknown';
          if (errContent.includes('rate') || errContent.includes('429') || errContent.includes('quota') || errContent.includes('Too Many')) {
            errorCode = 'rate_limit';
          } else if (errContent.includes('context') || errContent.includes('token') || errContent.includes('too long') || errContent.includes('max_tokens') || errContent.includes('context_length')) {
            errorCode = 'context_too_long';
          } else if (errContent.includes('overloaded') || errContent.includes('503') || errContent.includes('unavailable') || errContent.includes('capacity')) {
            errorCode = 'service_unavailable';
          } else if (errContent.includes('network') || errContent.includes('ECONNREFUSED') || errContent.includes('ETIMEDOUT') || errContent.includes('ENOTFOUND')) {
            errorCode = 'network';
          }
          res.write(`data: ${JSON.stringify({ type: 'error', content: errContent, errorCode })}\n\n`);
        }
      }

      if (isNewConversation && activeConvId && fullText && !aborted) {
        try {
          const title = await Promise.race([
            generateConversationTitle(msgText, fullText),
            new Promise<string>((_, reject) => setTimeout(() => reject(new Error('timeout')), 8000))
          ]);
          await storage.updateConversation(activeConvId!, { title });
          res.write(`data: ${JSON.stringify({ type: 'title', title })}\n\n`);
        } catch (err) {
          console.error('Title generation error:', err);
        }
      }

      res.end();

      extractMemories(
        [...history, { role: 'user', content: msgText }, { role: 'assistant', content: fullText }],
        userId,
        orgId
      ).catch(err => console.error('Memory extraction error:', err));
    } catch (e: any) {
      console.error('AI Chat Stream error:', e);
      if (!res.headersSent) {
        return res.status(500).json({ error: e.message });
      }
      try {
        const errContent = e.message || '';
        let errorCode = 'unknown';
        if (errContent.includes('rate') || errContent.includes('429') || errContent.includes('quota') || errContent.includes('Too Many')) {
          errorCode = 'rate_limit';
        } else if (errContent.includes('context') || errContent.includes('token') || errContent.includes('too long') || errContent.includes('max_tokens') || errContent.includes('context_length')) {
          errorCode = 'context_too_long';
        } else if (errContent.includes('overloaded') || errContent.includes('503') || errContent.includes('unavailable') || errContent.includes('capacity')) {
          errorCode = 'service_unavailable';
        } else if (errContent.includes('network') || errContent.includes('ECONNREFUSED') || errContent.includes('ETIMEDOUT') || errContent.includes('ENOTFOUND')) {
          errorCode = 'network';
        }
        res.write(`data: ${JSON.stringify({ type: 'error', content: errContent, errorCode })}\n\n`);
        res.end();
      } catch {}
    }
  });

  // ===================== AI Chat =====================
  app.post("/api/ai/chat", authMiddleware, async (req: any, res) => {
    try {
      const { message, conversationHistory, conversationId, currentUserId, systemPrompt, model, extendedThinking } = req.body;
      if (!message || typeof message !== 'string') {
        return res.status(400).json({ error: 'message is required' });
      }

      const orgId = req.orgId || 1;
      const userId = currentUserId || req.currentUserId || 1;
      const user = await storage.getUserById(userId);
      const userName = user?.displayName || 'Unknown';

      let activeConvId = conversationId || null;
      let isNewConversation = false;

      if (!activeConvId) {
        isNewConversation = true;
        const tempTitle = message.slice(0, 30) + (message.length > 30 ? '...' : '');
        const newConv = await storage.createConversation({
          title: tempTitle,
          orgId,
          userId,
        });
        activeConvId = newConv.id;
      }

      let history = conversationHistory || [];
      if (activeConvId && history.length === 0) {
        const conv = await storage.getConversationById(activeConvId);
        if (conv && conv.orgId !== orgId) {
          return res.status(403).json({ error: 'Access denied to this conversation' });
        }
        const dbMessages = await storage.getChatMessages(activeConvId);
        history = dbMessages
          .filter(m => m.role === 'user' || m.role === 'assistant')
          .map(m => ({ role: m.role, content: m.content }));
      }

      const result = await aiChat(
        message,
        history,
        { currentUserId: userId, currentUserName: userName, customSystemPrompt: systemPrompt || undefined, model: model || undefined, extendedThinking: extendedThinking || false, orgId }
      );

      if (isNewConversation && activeConvId && result.message) {
        generateConversationTitle(message, result.message)
          .then(async (title) => {
            await storage.updateConversation(activeConvId!, { title });
          })
          .catch(err => console.error('Title generation error:', err));
      }

      if (result.tokenUsage) {
        const { calculateCost } = await import('./services/ai/tokenCost');
        const cost = calculateCost(
          result.tokenUsage.model,
          result.tokenUsage.promptTokens,
          result.tokenUsage.completionTokens
        );
        try {
          await storage.createTokenUsage({
            orgId,
            userId,
            conversationId: activeConvId || null,
            model: result.tokenUsage.model,
            promptTokens: result.tokenUsage.promptTokens,
            completionTokens: result.tokenUsage.completionTokens,
            totalTokens: result.tokenUsage.totalTokens,
            costUsd: cost,
            purpose: 'chat',
          });
        } catch (tokenErr) {
          console.error('Failed to record token usage:', tokenErr);
        }
      }

      return res.json({ data: { ...result, conversationId: activeConvId } });
    } catch (e: any) {
      console.error('AI Chat error:', e);
      return res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/ai/confirm", authMiddleware, async (req: any, res) => {
    try {
      const { actionType, data, currentUserId, conversationId, forceCreate } = req.body;
      if (!actionType || !data) {
        return res.status(400).json({ error: 'actionType and data are required' });
      }

      const userId = currentUserId || req.currentUserId;
      const orgId = req.orgId || 1;
      const result = await executeAction(actionType, data, userId, orgId, { forceCreate: !!forceCreate });

      if (result.error === 'duplicate_suspected') {
        return res.json({ data: result });
      }

      if (!result.success && result.entity?.conflict) {
        return res.status(409).json({ error: result.message, data: result });
      }

      if (result.success && result.entity) {
        try {
          if (actionType === 'create_task' || actionType === 'update_task') {
            const taskEntity = result.entity;
            const notifType = actionType === 'create_task' ? 'task_created' : 'task_updated';
            const notifMsg = actionType === 'create_task'
              ? `通过 AI 创建了任务「${taskEntity.title}」`
              : `通过 AI 更新了任务「${taskEntity.title}」`;
            await generateTeamNotifications(userId, 'task', taskEntity.id, taskEntity.title, orgId, notifType, notifMsg);
          }
        } catch (notifErr) {
          console.error('Failed to generate notifications:', notifErr);
        }
      }

      if (conversationId) {
        const conv = await storage.getConversationById(conversationId);
        if (conv && conv.orgId !== req.orgId) {
          return res.status(403).json({ error: 'Access denied to this conversation' });
        }
        try {
          const summaryParts = [];
          if (actionType === 'create_task') summaryParts.push(`创建任务「${data.title || ''}」`);
          else if (actionType === 'update_task') summaryParts.push(`更新任务 #${data.taskId || ''}`);
          else if (actionType === 'create_project') summaryParts.push(`创建项目「${data.name || ''}」`);
          else if (actionType === 'add_comment') summaryParts.push(`添加评论`);
          else if (actionType === 'create_user') summaryParts.push(`创建成员「${data.displayName || ''}」`);
          else if (actionType === 'update_user') summaryParts.push(`更新成员 #${data.userId || ''}`);
          else if (actionType === 'create_department') summaryParts.push(`创建部门「${data.name || ''}」`);
          else summaryParts.push(`执行操作: ${actionType}`);

          await storage.createChatMessage({
            conversationId,
            role: 'system',
            content: `[操作已执行] ${summaryParts.join('，')}`,
            type: 'action_result',
            metadata: JSON.stringify({ actionType, result }),
          });
        } catch (msgErr) {
          console.error('Failed to save system message:', msgErr);
        }
      }

      return res.json({ data: result });
    } catch (e: any) {
      console.error('AI Confirm error:', e);
      return res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/ai/confirm-batch", authMiddleware, async (req: any, res) => {
    try {
      const { actions, currentUserId, conversationId } = req.body;
      if (!Array.isArray(actions) || actions.length === 0) {
        return res.status(400).json({ error: 'actions array is required' });
      }

      const userId = currentUserId || req.currentUserId;
      const orgId = req.orgId || 1;
      const batchResult = await executeBatchActions(actions, userId, orgId);

      for (let i = 0; i < batchResult.results.length; i++) {
        const r = batchResult.results[i];
        if (r.success && r.entity) {
          try {
            const actionType = actions[i]?.actionType || 'create_task';
            if (actionType === 'create_task' || actionType === 'update_task') {
              const notifType = actionType === 'create_task' ? 'task_created' : 'task_updated';
              const notifMsg = actionType === 'create_task'
                ? `通过 AI 创建了任务「${r.entity.title}」`
                : `通过 AI 更新了任务「${r.entity.title}」`;
              await generateTeamNotifications(userId, 'task', r.entity.id, r.entity.title || '', orgId, notifType, notifMsg);
            }
          } catch (notifErr) {
            console.error('Failed to generate batch notification:', notifErr);
          }
        }
      }

      if (conversationId) {
        try {
          const summaryParts = batchResult.results
            .filter(r => r.success)
            .map(r => r.message);

          if (summaryParts.length > 0) {
            await storage.createChatMessage({
              conversationId,
              role: 'system',
              content: `[批量操作已执行] ${summaryParts.join('；')}`,
              type: 'action_result',
              metadata: JSON.stringify({ batch: true, results: batchResult.results }),
            });
          }
        } catch (msgErr) {
          console.error('Failed to save batch system message:', msgErr);
        }
      }

      return res.json({ data: batchResult });
    } catch (e: any) {
      console.error('AI Confirm Batch error:', e);
      return res.status(500).json({ error: e.message });
    }
  });

  // ===================== Token Budget Balance =====================
  app.get("/api/token-usage/balance", authMiddleware, async (req: any, res) => {
    try {
      const orgId = req.orgId;
      const org = await storage.getOrganizationById(orgId);
      if (!org) return res.status(404).json({ error: 'Organization not found' });

      const budget = org.tokenBudgetUsd ? parseFloat(org.tokenBudgetUsd) : null;
      const resetDay = org.budgetResetDay || 1;

      const now = new Date();
      let cycleStart: Date;
      if (now.getDate() >= resetDay) {
        cycleStart = new Date(now.getFullYear(), now.getMonth(), resetDay);
      } else {
        cycleStart = new Date(now.getFullYear(), now.getMonth() - 1, resetDay);
      }

      const stats = await storage.getTokenUsageStats(orgId, cycleStart);
      const used = parseFloat(stats.totalCostUsd);

      return res.json({
        data: {
          budgetUsd: budget,
          usedUsd: used,
          remainingUsd: budget !== null ? Math.max(0, budget - used) : null,
          percentUsed: budget !== null && budget > 0 ? Math.min(100, (used / budget) * 100) : null,
          cycleStart: cycleStart.toISOString(),
          resetDay,
        }
      });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.patch("/api/organization/budget", authMiddleware, async (req: any, res) => {
    try {
      const orgId = req.orgId;
      const currentUserId = req.currentUserId;
      const userOrg = await storage.getOrgMembershipByUserAndOrg(currentUserId, orgId);
      if (!userOrg || (userOrg.role !== 'owner' && userOrg.role !== 'admin')) {
        return res.status(403).json({ error: 'Only owner/admin can update budget' });
      }
      const { tokenBudgetUsd, budgetResetDay } = req.body;
      const updates: Record<string, any> = {};
      if (tokenBudgetUsd !== undefined) updates.tokenBudgetUsd = String(tokenBudgetUsd);
      if (budgetResetDay !== undefined) updates.budgetResetDay = budgetResetDay;
      if (Object.keys(updates).length === 0) return res.status(400).json({ error: 'No fields to update' });
      await storage.updateOrganization(orgId, updates);
      return res.json({ data: { success: true } });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  // ===================== Token Usage Stats =====================
  app.get("/api/token-usage/stats", authMiddleware, async (req: any, res) => {
    try {
      const orgId = req.orgId;
      const period = (req.query.period as string) || '30d';

      let since: Date | undefined;
      const now = new Date();
      if (period === '7d') since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      else if (period === '30d') since = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      else if (period === '90d') since = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

      const stats = await storage.getTokenUsageStats(orgId, since);
      return res.json({ data: stats });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  // ===================== Smart Setup =====================

  app.post("/api/setup/analyze-kb", authMiddleware, async (req: any, res) => {
    try {
      if (!['owner', 'admin'].includes(req.userRole)) {
        return res.status(403).json({ error: "仅管理员可使用智能初始化" });
      }

      const { documentIds } = req.body;
      if (!Array.isArray(documentIds) || documentIds.length === 0) {
        return res.status(400).json({ error: "请选择至少一个知识库文档" });
      }

      const { analyzeKbDocuments } = await import('./services/setup/setupService');
      const result = await analyzeKbDocuments({
        orgId: req.orgId,
        documentIds: documentIds.map(Number),
      });

      return res.json({ data: result });
    } catch (e: any) {
      console.error('[Setup] Analyze KB error:', e);
      return res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/setup/confirm", authMiddleware, async (req: any, res) => {
    try {
      if (!['owner', 'admin'].includes(req.userRole)) {
        return res.status(403).json({ error: "仅管理员可使用智能初始化" });
      }

      const { confirmAndSetup } = await import('./services/setup/setupService');
      const { profile, extractedFiles } = req.body;

      if (!profile) {
        return res.status(400).json({ error: "缺少组织信息" });
      }

      const result = await confirmAndSetup({
        orgId: req.orgId,
        userId: req.currentUserId,
        profile,
        extractedFiles: extractedFiles || [],
      });

      return res.json({ data: result });
    } catch (e: any) {
      console.error('[Setup] Confirm error:', e);
      return res.status(500).json({ error: e.message });
    }
  });

  // ===================== Member Profiles =====================

  app.get("/api/member-profiles", authMiddleware, async (req: any, res) => {
    try {
      const profiles = await storage.getMemberProfilesByOrg(req.orgId);
      res.json({ data: profiles });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/member-profiles", authMiddleware, async (req: any, res) => {
    try {
      if (!['owner', 'admin'].includes(req.userRole)) {
        return res.status(403).json({ error: "仅管理员可创建成员档案" });
      }
      const { fullName, aliases, deptId, jobRoleId, employeeId, phone, email, title, hireDate, contractInfo } = req.body;
      if (!fullName) return res.status(400).json({ error: "姓名不能为空" });

      const profile = await storage.createMemberProfile({
        orgId: req.orgId,
        fullName,
        aliases: aliases ? (typeof aliases === 'string' ? aliases : JSON.stringify(aliases)) : null,
        deptId: deptId || null,
        jobRoleId: jobRoleId || null,
        employeeId: employeeId || null,
        phone: phone || null,
        email: email || null,
        title: title || null,
        hireDate: hireDate || null,
        contractInfo: contractInfo || null,
        status: 'manual',
        sourceDocument: null,
      });
      res.json({ data: profile });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.patch("/api/member-profiles/:id", authMiddleware, async (req: any, res) => {
    try {
      if (!['owner', 'admin'].includes(req.userRole)) {
        return res.status(403).json({ error: "仅管理员可修改成员档案" });
      }
      const profileId = Number(req.params.id);
      const existing = await storage.getMemberProfileById(profileId);
      if (!existing || existing.orgId !== req.orgId) {
        return res.status(404).json({ error: "档案不存在" });
      }
      const updateData: any = {};
      const allowedFields = ['fullName', 'aliases', 'deptId', 'jobRoleId', 'employeeId', 'phone', 'email', 'title', 'hireDate', 'contractInfo'];
      for (const field of allowedFields) {
        if (req.body[field] !== undefined) {
          if (field === 'aliases' && Array.isArray(req.body[field])) {
            updateData[field] = JSON.stringify(req.body[field]);
          } else {
            updateData[field] = req.body[field];
          }
        }
      }
      const updated = await storage.updateMemberProfile(profileId, updateData);
      res.json({ data: updated });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.delete("/api/member-profiles/:id", authMiddleware, async (req: any, res) => {
    try {
      if (!['owner', 'admin'].includes(req.userRole)) {
        return res.status(403).json({ error: "仅管理员可删除成员档案" });
      }
      const profileId = Number(req.params.id);
      const existing = await storage.getMemberProfileById(profileId);
      if (!existing || existing.orgId !== req.orgId) {
        return res.status(404).json({ error: "档案不存在" });
      }
      await storage.deleteMemberProfile(profileId);
      res.json({ data: { success: true } });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/member-profiles/match", authMiddleware, async (req: any, res) => {
    try {
      const profiles = await storage.getPendingProfilesByOrg(req.orgId);
      const user = await storage.getUserById(req.currentUserId);
      if (!user) return res.json({ data: null });

      let matched = null;
      for (const profile of profiles) {
        if (profile.email && user.email && profile.email.toLowerCase() === user.email.toLowerCase()) {
          matched = profile;
          break;
        }
        if (profile.fullName === user.displayName) {
          matched = profile;
          break;
        }
        let aliases: string[] = [];
        try { aliases = profile.aliases ? JSON.parse(profile.aliases) : []; } catch {}
        if (aliases.some((alias: string) => alias.toLowerCase() === user.displayName.toLowerCase())) {
          matched = profile;
          break;
        }
      }

      if (matched) {
        const taskCount = await storage.getTaskCountByMemberProfile(matched.id);
        res.json({ data: { ...matched, pendingTaskCount: taskCount } });
      } else {
        res.json({ data: null });
      }
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/member-profiles/:id/claim", authMiddleware, async (req: any, res) => {
    try {
      const profileId = Number(req.params.id);
      const profile = await storage.getMemberProfileById(profileId);
      if (!profile || profile.orgId !== req.orgId) {
        return res.status(404).json({ error: "档案不存在" });
      }
      if (profile.status === 'claimed') {
        return res.status(400).json({ error: "该档案已被认领" });
      }

      const userId = req.currentUserId;

      const existingClaim = await storage.getMemberProfilesByOrg(req.orgId);
      const alreadyBound = existingClaim.find(p => p.userId === userId && p.status === 'claimed');
      if (alreadyBound) {
        return res.status(400).json({ error: "你已经认领了另一个档案" });
      }

      const user = await storage.getUserById(userId);
      if (!user) return res.status(404).json({ error: "用户不存在" });

      let isMatch = false;
      if (profile.email && user.email && profile.email.toLowerCase() === user.email.toLowerCase()) isMatch = true;
      if (profile.fullName === user.displayName) isMatch = true;
      let aliases: string[] = [];
      try { aliases = profile.aliases ? JSON.parse(profile.aliases) : []; } catch {}
      if (aliases.some((a: string) => a.toLowerCase() === user.displayName.toLowerCase())) isMatch = true;
      if (!isMatch) {
        return res.status(403).json({ error: "该档案与你的信息不匹配，请联系管理员绑定" });
      }

      await storage.updateUser(userId, {
        deptId: profile.deptId,
        jobRoleId: profile.jobRoleId,
      } as any);

      await storage.updateOrgMembership(req.orgId, userId, {
        deptId: profile.deptId,
        jobRoleId: profile.jobRoleId,
      });

      const migratedCount = await storage.migrateTasksFromProfile(profileId, userId);

      await storage.updateMemberProfile(profileId, {
        status: 'claimed',
        userId,
        claimedAt: new Date(),
      } as any);

      await storage.createActivityLog({
        orgId: req.orgId,
        userId,
        entityType: 'member_profile',
        entityId: profileId,
        action: 'claim',
        changes: JSON.stringify({ profileName: profile.fullName, userId, migratedTasks: migratedCount }),
        source: 'user',
      });

      res.json({ data: { success: true, migratedTasks: migratedCount, profile } });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/member-profiles/:id/bind/:userId", authMiddleware, async (req: any, res) => {
    try {
      if (!['owner', 'admin'].includes(req.userRole)) {
        return res.status(403).json({ error: "仅管理员可手动绑定" });
      }
      const profileId = Number(req.params.id);
      const targetUserId = Number(req.params.userId);

      const profile = await storage.getMemberProfileById(profileId);
      if (!profile || profile.orgId !== req.orgId) {
        return res.status(404).json({ error: "档案不存在" });
      }
      if (profile.status === 'claimed') {
        return res.status(400).json({ error: "该档案已被认领" });
      }

      const targetUser = await storage.getUserById(targetUserId);
      if (!targetUser) {
        return res.status(404).json({ error: "目标用户不存在" });
      }

      const allProfiles = await storage.getMemberProfilesByOrg(req.orgId);
      const alreadyBound = allProfiles.find(p => p.userId === targetUserId && p.status === 'claimed');
      if (alreadyBound) {
        return res.status(400).json({ error: "该用户已绑定了另一个档案" });
      }

      await storage.updateUser(targetUserId, {
        deptId: profile.deptId,
        jobRoleId: profile.jobRoleId,
      } as any);

      await storage.updateOrgMembership(req.orgId, targetUserId, {
        deptId: profile.deptId,
        jobRoleId: profile.jobRoleId,
      });

      const migratedCount = await storage.migrateTasksFromProfile(profileId, targetUserId);

      await storage.updateMemberProfile(profileId, {
        status: 'claimed',
        userId: targetUserId,
        claimedAt: new Date(),
      } as any);

      await storage.createActivityLog({
        orgId: req.orgId,
        userId: req.currentUserId,
        entityType: 'member_profile',
        entityId: profileId,
        action: 'bind',
        changes: JSON.stringify({ profileName: profile.fullName, targetUserId, migratedTasks: migratedCount }),
        source: 'user',
      });

      res.json({ data: { success: true, migratedTasks: migratedCount, profile } });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ===================== Knowledge Base =====================

  const fsKb = await import('fs');
  if (!fsKb.existsSync('uploads/kb')) {
    fsKb.mkdirSync('uploads/kb', { recursive: true });
  }

  const kbUploadStorage = multer.diskStorage({
    destination: (_req: any, _file: any, cb: any) => cb(null, 'uploads/kb/'),
    filename: (_req: any, file: any, cb: any) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      const ext = pathModule.extname(file.originalname);
      cb(null, uniqueSuffix + ext);
    },
  });
  const kbUpload = multer({
    storage: kbUploadStorage,
    limits: { fileSize: 50 * 1024 * 1024 },
    fileFilter: (_req: any, file: any, cb: any) => {
      const allowedTypes = ['.pdf', '.docx', '.doc', '.txt', '.md', '.xlsx', '.xls', '.csv', '.pptx', '.html', '.htm', '.rtf', '.json'];
      const ext = pathModule.extname(file.originalname).toLowerCase();
      if (allowedTypes.includes(ext)) {
        cb(null, true);
      } else {
        cb(new Error(`不支持的文件类型: ${ext}。支持格式: PDF/Word/Excel/PPT/TXT/CSV/HTML/MD/RTF/JSON`));
      }
    },
  });

  app.post("/api/kb/documents/upload", authMiddleware, kbUpload.single('file'), async (req: any, res) => {
    try {
      const userRole = req.userRole || 'member';
      if (!['owner', 'admin'].includes(userRole)) {
        return res.status(403).json({ error: '仅管理员可上传知识库文档' });
      }

      if (!req.file) {
        return res.status(400).json({ error: '请选择要上传的文件' });
      }

      const orgId = req.orgId;
      const userId = req.currentUserId;
      const file = req.file;
      const ext = pathModule.extname(file.originalname).toLowerCase().replace('.', '');

      const fileBuffer = fsKb.readFileSync(file.path);
      const contentHash = crypto.createHash('md5').update(fileBuffer).digest('hex');

      const forceUpload = req.body.forceUpload === 'true' || req.body.forceUpload === true;
      const replaceDocId = req.body.replaceDocId ? parseInt(req.body.replaceDocId) : null;

      if (replaceDocId) {
        const oldDoc = await storage.getKbDocumentById(replaceDocId);
        if (oldDoc && oldDoc.orgId === orgId) {
          try {
            const oldFilePath = oldDoc.fileUrl.startsWith('/') ? oldDoc.fileUrl.slice(1) : oldDoc.fileUrl;
            if (fsKb.existsSync(oldFilePath)) fsKb.unlinkSync(oldFilePath);
          } catch {}
          await storage.deleteKbChunksByDocument(replaceDocId);
          await storage.deleteKbDocument(replaceDocId);
        }
      }

      if (!forceUpload) {
        const existingByName = await storage.findKbDocByFileName(orgId, file.originalname);
        if (existingByName) {
          try { fsKb.unlinkSync(file.path); } catch {}
          if (existingByName.fileSize === file.size) {
            return res.status(409).json({
              error: 'duplicate_detected',
              duplicateType: 'same_name_same_size',
              existingDoc: { id: existingByName.id, title: existingByName.title, fileName: existingByName.fileName, createdAt: existingByName.createdAt },
              message: `知识库中已有同名同大小的文件「${existingByName.title}」`,
            });
          } else {
            return res.status(409).json({
              error: 'duplicate_detected',
              duplicateType: 'same_name_diff_size',
              existingDoc: { id: existingByName.id, title: existingByName.title, fileName: existingByName.fileName, fileSize: existingByName.fileSize, createdAt: existingByName.createdAt },
              message: `知识库中有同名文件「${existingByName.title}」（大小不同，可能是新版本）`,
            });
          }
        }

        const existingByHash = await storage.findKbDocByHash(orgId, contentHash);
        if (existingByHash) {
          try { fsKb.unlinkSync(file.path); } catch {}
          return res.status(409).json({
            error: 'duplicate_detected',
            duplicateType: 'same_content',
            existingDoc: { id: existingByHash.id, title: existingByHash.title, fileName: existingByHash.fileName, createdAt: existingByHash.createdAt },
            message: `知识库中已有内容完全相同的文件「${existingByHash.title}」`,
          });
        }
      }

      const docData = {
        orgId,
        uploadedBy: userId,
        title: req.body.title || file.originalname.replace(/\.[^/.]+$/, ''),
        fileName: file.originalname,
        fileType: ext,
        fileSize: file.size,
        fileUrl: `/uploads/kb/${file.filename}`,
        category: req.body.category || 'general',
        visibility: req.body.visibility || 'org',
        visibleDeptIds: req.body.visibleDeptIds || null,
        status: 'pending',
        chunkCount: 0,
        contentHash,
      };

      const doc = await storage.createKbDocument(docData);

      await storage.createActivityLog({
        orgId,
        userId,
        entityType: 'kb_document',
        entityId: doc.id,
        action: 'upload',
        changes: JSON.stringify({ title: doc.title, fileName: doc.fileName, fileType: doc.fileType }),
        source: 'manual',
      });

      setImmediate(() => {
        processDocument(doc.id).catch(err => {
          console.error(`[KB] Async processing failed for document ${doc.id}:`, err);
        });
      });

      return res.status(201).json({ data: doc });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/kb/documents", authMiddleware, async (req: any, res) => {
    try {
      const orgId = req.orgId;
      const docs = await storage.getKbDocumentsByOrg(orgId);

      const userRole = req.userRole || 'member';
      const filteredDocs = ['owner', 'admin'].includes(userRole)
        ? docs
        : docs.filter((d: any) => d.visibility === 'org');

      return res.json({ data: filteredDocs });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/kb/documents/:id", authMiddleware, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const doc = await storage.getKbDocumentById(id);
      if (!doc) return res.status(404).json({ error: '文档不存在' });
      if (doc.orgId !== req.orgId) return res.status(403).json({ error: '无权访问' });
      const userRole = req.userRole || 'member';
      if (!['owner', 'admin'].includes(userRole) && doc.visibility !== 'org') {
        return res.status(403).json({ error: '无权访问' });
      }
      return res.json({ data: doc });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/kb/documents/:id/chunks", authMiddleware, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const doc = await storage.getKbDocumentById(id);
      if (!doc) return res.status(404).json({ error: '文档不存在' });
      if (doc.orgId !== req.orgId) return res.status(403).json({ error: '无权访问' });
      const userRole = req.userRole || 'member';
      if (!['owner', 'admin'].includes(userRole) && doc.visibility !== 'org') {
        return res.status(403).json({ error: '无权访问' });
      }

      const chunks = await storage.getKbChunksByDocument(id);
      return res.json({ data: chunks });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/kb/documents/:id/status", authMiddleware, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const doc = await storage.getKbDocumentById(id);
      if (!doc) return res.status(404).json({ error: '文档不存在' });

      return res.json({
        data: {
          status: doc.status,
          chunkCount: doc.chunkCount,
          errorMessage: doc.errorMessage,
        }
      });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.delete("/api/kb/documents/:id", authMiddleware, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const userRole = req.userRole || 'member';
      if (!['owner', 'admin'].includes(userRole)) {
        return res.status(403).json({ error: '仅管理员可删除知识库文档' });
      }

      const doc = await storage.getKbDocumentById(id);
      if (!doc) return res.status(404).json({ error: '文档不存在' });
      if (doc.orgId !== req.orgId) return res.status(403).json({ error: '无权访问' });

      const fs = await import('fs');
      const filePath = doc.fileUrl.startsWith('/') ? doc.fileUrl.slice(1) : doc.fileUrl;
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }

      await storage.deleteKbDocument(id);

      await storage.createActivityLog({
        orgId: req.orgId,
        userId: req.currentUserId,
        entityType: 'kb_document',
        entityId: id,
        action: 'delete',
        changes: JSON.stringify({ title: doc.title, fileName: doc.fileName }),
        source: 'manual',
      });

      return res.json({ data: { success: true } });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/kb/documents/:id/reprocess", authMiddleware, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const userRole = req.userRole || 'member';
      if (!['owner', 'admin'].includes(userRole)) {
        return res.status(403).json({ error: '仅管理员可操作' });
      }

      const doc = await storage.getKbDocumentById(id);
      if (!doc) return res.status(404).json({ error: '文档不存在' });
      if (doc.orgId !== req.orgId) return res.status(403).json({ error: '无权访问' });

      await storage.updateKbDocument(id, { status: 'pending', errorMessage: null, chunkCount: 0 });

      setImmediate(() => {
        processDocument(id).catch(err => {
          console.error(`[KB] Reprocess failed for document ${id}:`, err);
        });
      });

      return res.json({ data: { success: true, message: '已开始重新处理' } });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/kb/search", authMiddleware, async (req: any, res) => {
    try {
      const q = String(req.query.q || '').trim();
      if (!q) return res.json({ data: [] });

      const topK = Math.min(parseInt(req.query.topK as string) || 5, 10);

      const results = await searchKnowledge({
        orgId: req.orgId,
        query: q,
        topK,
        userRole: req.userRole || 'member',
        userDeptId: req.userDeptId || null,
      });

      return res.json({ data: results });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  // ===================== Daily Briefing =====================

  app.get("/api/briefing/today", authMiddleware, async (req: any, res) => {
    try {
      const { getTodayBriefing } = await import('./services/briefing/briefingGenerator');
      const result = await getTodayBriefing(req.orgId, req.currentUserId);
      return res.json({ data: result });
    } catch (e: any) {
      console.error('[Briefing] Error:', e);
      return res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/briefing/refresh", authMiddleware, async (req: any, res) => {
    try {
      const today = new Date().toISOString().slice(0, 10);
      await storage.deleteBriefing(req.orgId, req.currentUserId, today);
      const { getTodayBriefing } = await import('./services/briefing/briefingGenerator');
      const result = await getTodayBriefing(req.orgId, req.currentUserId);
      return res.json({ data: result });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });
}
