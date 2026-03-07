import { storage } from "../../storage";
import type { Task } from "@shared/schema";

const WARNING_TYPE_MAP: Array<{ pattern: RegExp; type: string }> = [
  { pattern: /负责人|指派|分配|assignee|指定.*人/i, type: 'assignee_unclear' },
  { pattern: /截止|deadline|due.*date|到期|完成时间/i, type: 'deadline_missing' },
  { pattern: /范围|scope|需求.*不清|描述.*模糊|内容.*不明/i, type: 'scope_unclear' },
  { pattern: /优先级|priority|紧急程度/i, type: 'priority_unclear' },
  { pattern: /依赖|dependency|前置|阻塞/i, type: 'dependency_unclear' },
];

function classifyWarning(warningText: string): string {
  for (const { pattern, type } of WARNING_TYPE_MAP) {
    if (pattern.test(warningText)) return type;
  }
  return 'scope_unclear';
}

const DECISION_TYPE_LABELS: Record<string, string> = {
  assignee_unclear: '需要确认负责人',
  deadline_missing: '需要确认截止日期',
  scope_unclear: '需要明确任务范围',
  priority_unclear: '需要确认优先级',
  dependency_unclear: '需要确认依赖关系',
};

export async function createDecisionTasksForWarnings(
  originalTask: Task,
  warnings: string[],
  creatorId: number,
  orgId: number
): Promise<Task[]> {
  const decisionTasks: Task[] = [];
  const now = new Date();
  const deadline = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const escalation = new Date(now.getTime() + 48 * 60 * 60 * 1000);

  let decisionMakerId: number;
  const warningTypes = warnings.map(w => classifyWarning(w));
  const hasAssigneeIssue = warningTypes.includes('assignee_unclear');

  if (hasAssigneeIssue) {
    decisionMakerId = creatorId;
  } else if (originalTask.assigneeId) {
    decisionMakerId = originalTask.assigneeId;
  } else {
    decisionMakerId = creatorId;
  }

  for (let i = 0; i < warnings.length; i++) {
    const warningText = warnings[i];
    const decisionType = warningTypes[i];
    const label = DECISION_TYPE_LABELS[decisionType] || '需要确认';

    const decisionTask = await storage.createDecisionTask({
      orgId,
      projectId: originalTask.projectId,
      title: `[决策] ${originalTask.title} — ${label}`,
      description: `原始任务: #${originalTask.id} ${originalTask.title}\n\n待确认事项: ${warningText}\n\n请回复确认或提供所需信息。`,
      creatorId,
      assigneeId: decisionMakerId,
      decisionForTaskId: originalTask.id,
      decisionType,
      decisionDeadline: deadline,
      escalationDeadline: escalation,
    });

    decisionTasks.push(decisionTask);
  }

  return decisionTasks;
}

export async function pushDecisionRequests(
  decisionTasks: Task[],
  orgId: number,
  creatorId: number
): Promise<void> {
  if (decisionTasks.length === 0) return;

  const byAssignee = new Map<number, Task[]>();
  for (const dt of decisionTasks) {
    const assigneeId = dt.assigneeId || creatorId;
    if (!byAssignee.has(assigneeId)) {
      byAssignee.set(assigneeId, []);
    }
    byAssignee.get(assigneeId)!.push(dt);
  }

  for (const [userId, userDecisionTasks] of byAssignee) {
    const allConversations = await storage.getConversationsByUser(orgId, userId);
    let conversation = allConversations.find(c => !c.isArchived);

    if (!conversation) {
      conversation = await storage.createConversation({
        orgId,
        userId,
        title: '任务决策确认',
        visibility: 'private',
      });
    }

    const items = await Promise.all(userDecisionTasks.map(async (dt, index) => {
      const originalTask = dt.decisionForTaskId
        ? await storage.getTaskById(dt.decisionForTaskId)
        : null;
      const label = DECISION_TYPE_LABELS[dt.decisionType || ''] || '需要确认';
      return {
        index: index + 1,
        decisionTaskId: dt.id,
        originalTaskId: dt.decisionForTaskId,
        originalTaskTitle: originalTask?.title || '未知任务',
        decisionType: dt.decisionType,
        label,
        warning: dt.description?.split('待确认事项: ')[1]?.split('\n')[0] || '',
      };
    }));

    const messageContent = JSON.stringify({
      type: 'decision_request',
      items,
      createdAt: new Date().toISOString(),
    });

    await storage.createChatMessage({
      conversationId: conversation.id,
      role: 'assistant',
      content: messageContent,
      type: 'decision_request',
      metadata: JSON.stringify({ isSystemGenerated: true }),
    });

    await storage.updateConversation(conversation.id, {
      lastMessageAt: new Date(),
    });

    await storage.createNotification({
      userId,
      orgId,
      type: 'decision_required',
      entityType: 'task',
      entityId: userDecisionTasks[0].decisionForTaskId || userDecisionTasks[0].id,
      entityTitle: `${userDecisionTasks.length} 个任务需要你确认`,
      message: `你有 ${userDecisionTasks.length} 个AI创建的任务需要确认信息，请在AI对话中回复。`,
      triggeredBy: creatorId,
    });
  }
}
