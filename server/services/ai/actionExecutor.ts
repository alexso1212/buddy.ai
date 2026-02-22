import { storage } from "../../storage";
import { judgeTaskAssignment } from "./verdictService";

export async function executeAction(
  actionType: string,
  data: Record<string, any>,
  userId: number
): Promise<{ success: boolean; message: string; entity?: any }> {
  switch (actionType) {
    case 'create_task': {
      const newTask = await storage.createTask({
        orgId: 1,
        projectId: data.projectId,
        title: data.title,
        description: data.description || null,
        type: data.type || 'task',
        status: data.status || 'todo',
        priority: data.priority || 'medium',
        creatorId: userId,
        assigneeId: data.assigneeId || userId,
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        weight: data.weight || 3,
        progress: 0,
        parentTaskId: data.parentTaskId || null,
        tags: data.tags || null,
      });

      await storage.createActivityLog({
        orgId: 1,
        userId: userId,
        entityType: 'task',
        entityId: newTask.id,
        action: 'create',
        changes: JSON.stringify(data),
        source: 'ai_chat',
      });

      return {
        success: true,
        message: `任务「${data.title}」已成功创建`,
        entity: newTask,
      };
    }

    case 'update_task': {
      const { taskId, ...updateFields } = data;

      const oldTask = await storage.getTaskById(taskId);
      if (!oldTask) {
        return { success: false, message: '未找到该任务' };
      }

      const updateData: Record<string, any> = {};
      if (updateFields.title) updateData.title = updateFields.title;
      if (updateFields.status) updateData.status = updateFields.status;
      if (updateFields.priority) updateData.priority = updateFields.priority;
      if (updateFields.assigneeId) updateData.assigneeId = updateFields.assigneeId;
      if (updateFields.dueDate) updateData.dueDate = new Date(updateFields.dueDate);
      if (updateFields.weight) updateData.weight = updateFields.weight;
      if (updateFields.progress !== undefined) updateData.progress = updateFields.progress;
      if (updateFields.description) updateData.description = updateFields.description;

      if (updateFields.status === 'done') {
        updateData.completedAt = new Date();
      }

      const updated = await storage.updateTask(taskId, updateData);
      if (!updated) {
        return { success: false, message: '更新失败' };
      }

      await storage.createActivityLog({
        orgId: 1,
        userId: userId,
        entityType: 'task',
        entityId: taskId,
        action: 'update',
        changes: JSON.stringify({
          before: oldTask,
          after: updateFields,
        }),
        source: 'ai_chat',
      });

      return {
        success: true,
        message: `任务「${updated.title}」已更新`,
        entity: updated,
      };
    }

    case 'create_project': {
      const newProject = await storage.createProject({
        orgId: 1,
        name: data.name,
        description: data.description || null,
        deptId: data.deptId || null,
        ownerId: userId,
        status: 'active',
        startDate: data.startDate ? new Date(data.startDate) : null,
        targetDate: data.targetDate ? new Date(data.targetDate) : null,
      });

      await storage.createActivityLog({
        orgId: 1,
        userId: userId,
        entityType: 'project',
        entityId: newProject.id,
        action: 'create',
        changes: JSON.stringify(data),
        source: 'ai_chat',
      });

      return {
        success: true,
        message: `项目「${data.name}」已成功创建`,
        entity: newProject,
      };
    }

    case 'add_comment': {
      const newComment = await storage.createTaskComment({
        taskId: data.taskId,
        userId: userId,
        content: data.content,
      });

      await storage.createActivityLog({
        orgId: 1,
        userId: userId,
        entityType: 'task',
        entityId: data.taskId,
        action: 'comment',
        changes: JSON.stringify({ content: data.content }),
        source: 'ai_chat',
      });

      return {
        success: true,
        message: '评论已添加',
        entity: newComment,
      };
    }

    case 'judge_assignment': {
      const { taskId, userId: targetUserId } = data;
      try {
        const verdictResult = await judgeTaskAssignment(taskId, targetUserId);
        
        const verdict = await storage.createVerdict({
          orgId: 1,
          taskId,
          userId: targetUserId,
          verdict: verdictResult.verdict,
          confidence: verdictResult.confidence,
          reasoning: verdictResult.reasoning,
          matchedResponsibilities: JSON.stringify(verdictResult.matchedResponsibilities),
          suggestedAssignee: verdictResult.suggestedAssigneeId,
          suggestedReason: verdictResult.suggestedReason,
          requestedBy: userId,
          status: 'completed',
        });

        const VERDICT_LABELS: Record<string, string> = {
          in_scope: '份内职责', stretch: '延伸职责',
          out_of_scope: '分外工作', shared: '跨部门协作',
        };

        const targetUser = await storage.getUserById(targetUserId);
        const task = await storage.getTaskById(taskId);
        
        let message = `⚖️ 权责判定结果\n任务「${task?.title}」→ ${targetUser?.displayName}\n`;
        message += `判定: ${VERDICT_LABELS[verdictResult.verdict] || verdictResult.verdict} (置信度${verdictResult.confidence}%)\n`;
        message += `理由: ${verdictResult.reasoning}\n`;
        if (verdictResult.matchedResponsibilities.length > 0) {
          message += `匹配职责: ${verdictResult.matchedResponsibilities.map(r => '✓ ' + r).join('、')}\n`;
        }
        if (verdictResult.suggestedAssigneeId) {
          const suggested = await storage.getUserById(verdictResult.suggestedAssigneeId);
          message += `建议: → ${suggested?.displayName} — ${verdictResult.suggestedReason}`;
        }

        return { success: true, message, entity: verdict };
      } catch (err: any) {
        return { success: false, message: `判定失败: ${err.message}` };
      }
    }

    default:
      return { success: false, message: `不支持的操作类型: ${actionType}` };
  }
}
