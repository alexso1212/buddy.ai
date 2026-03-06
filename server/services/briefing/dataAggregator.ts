import { storage } from '../../storage';

export interface BriefingData {
  userName: string;
  orgName: string;
  totalActiveTasks: number;
  tasksDueToday: { id: number; title: string; assigneeName: string; assigneeId?: number }[];
  tasksOverdue: { id: number; title: string; assigneeName: string; assigneeId?: number; daysOverdue: number }[];
  tasksCompletedYesterday: { id: number; title: string; completedBy: string }[];
  tasksCreatedYesterday: number;
  memberCount: number;
  busiestMember: { name: string; userId?: number; activeTaskCount: number } | null;
  kbDocCount: number;
  kbRecentUploads: { title: string; uploadedAt: string }[];
}

export async function aggregateBriefingData(orgId: number, userId: number): Promise<BriefingData> {
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);

  const user = await storage.getUserById(userId);
  const org = await storage.getOrganizationById(orgId);

  const allTasks = await storage.getTasks();
  const orgTasks = (allTasks || []).filter((t: any) => t.orgId === orgId);

  const activeTasks = orgTasks.filter((t: any) =>
    t.status && !['done', 'cancelled'].includes(t.status)
  );

  let members: any[] = [];
  try {
    members = await storage.getOrgMembers(orgId) || [];
  } catch {}

  const memberMap = new Map<number, string>();
  members.forEach((m: any) => memberMap.set(m.userId, m.displayName || 'unknown'));

  const getAssigneeName = (t: any) => {
    if (t.assigneeId && memberMap.has(t.assigneeId)) return memberMap.get(t.assigneeId)!;
    return '未分配';
  };

  const tasksDueToday = activeTasks
    .filter((t: any) => t.dueDate && new Date(t.dueDate).toISOString().slice(0, 10) === todayStr)
    .slice(0, 5)
    .map((t: any) => ({ id: t.id, title: t.title, assigneeName: getAssigneeName(t), assigneeId: t.assigneeId || undefined }));

  const tasksOverdue = activeTasks
    .filter((t: any) => t.dueDate && new Date(t.dueDate) < today && t.status !== 'done')
    .map((t: any) => ({
      id: t.id,
      title: t.title,
      assigneeName: getAssigneeName(t),
      assigneeId: t.assigneeId || undefined,
      daysOverdue: Math.floor((today.getTime() - new Date(t.dueDate).getTime()) / 86400000),
    }))
    .sort((a, b) => b.daysOverdue - a.daysOverdue)
    .slice(0, 5);

  const tasksCompletedYesterday = orgTasks
    .filter((t: any) => {
      if (t.status !== 'done' || !t.updatedAt) return false;
      const updated = new Date(t.updatedAt).toISOString().slice(0, 10);
      return updated === yesterdayStr;
    })
    .slice(0, 5)
    .map((t: any) => ({ id: t.id, title: t.title, completedBy: getAssigneeName(t) }));

  const tasksCreatedYesterday = orgTasks
    .filter((t: any) => t.createdAt && new Date(t.createdAt).toISOString().slice(0, 10) === yesterdayStr)
    .length;

  let busiestMember = null;
  if (members.length > 0) {
    const memberTaskCounts = members.map((m: any) => ({
      name: m.displayName || 'unknown',
      userId: m.userId,
      activeTaskCount: activeTasks.filter((t: any) => t.assigneeId === m.userId).length,
    })).sort((a, b) => b.activeTaskCount - a.activeTaskCount);
    if (memberTaskCounts[0]?.activeTaskCount > 0) {
      busiestMember = memberTaskCounts[0];
    }
  }

  let kbDocs: any[] = [];
  try {
    kbDocs = await storage.getKbDocumentsByOrg(orgId) || [];
  } catch {}

  const kbRecentUploads = kbDocs
    .filter((d: any) => d.status === 'ready')
    .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 3)
    .map((d: any) => ({ title: d.title, uploadedAt: new Date(d.createdAt).toISOString().slice(0, 10) }));

  return {
    userName: user?.displayName || '用户',
    orgName: org?.name || '组织',
    totalActiveTasks: activeTasks.length,
    tasksDueToday,
    tasksOverdue,
    tasksCompletedYesterday,
    tasksCreatedYesterday,
    memberCount: members.length,
    busiestMember,
    kbDocCount: kbDocs.filter((d: any) => d.status === 'ready').length,
    kbRecentUploads,
  };
}
