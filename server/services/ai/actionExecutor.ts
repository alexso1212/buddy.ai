import { storage } from "../../storage";
import { judgeTaskAssignment } from "./verdictService";
import { createDecisionTasksForWarnings, pushDecisionRequests } from "./decisionService";
import { detectTaskDuplicate } from "../tasks/deduplication";

export async function executeAction(
  actionType: string,
  data: Record<string, any>,
  userId: number,
  orgId: number = 1,
  options?: { forceCreate?: boolean }
): Promise<{ success: boolean; message: string; entity?: any; duplicateWarning?: string; error?: string; matches?: any[] }> {
  switch (actionType) {
    case 'create_task': {
      if (!options?.forceCreate) {
        const dupCheck = await detectTaskDuplicate({ orgId, title: data.title });
        if (dupCheck.hasDuplicate) {
          return {
            success: false,
            error: 'duplicate_suspected',
            message: `发现 ${dupCheck.matches.length} 个相似任务`,
            matches: dupCheck.matches,
          };
        }
      }

      const duplicate = await storage.checkDuplicateTask(orgId, data.title, data.assigneeId, data.memberProfileId);
      let duplicateWarning: string | undefined;
      if (duplicate) {
        duplicateWarning = `系统中已存在类似任务「${duplicate.title}」(#${duplicate.id})，创建于 ${new Date(duplicate.createdAt).toLocaleString('zh-CN')}`;
      }

      const hasWarnings = Array.isArray(data.warnings) && data.warnings.length > 0;
      let assigneeId = data.assigneeId || userId;
      let memberProfileId = null;
      if (data.memberProfileId) {
        const profile = await storage.getMemberProfileById(data.memberProfileId);
        if (!profile || profile.orgId !== orgId) {
          return { success: false, message: `成员档案 #${data.memberProfileId} 不存在或不属于当前组织` };
        }
        memberProfileId = data.memberProfileId;
        assigneeId = null;
      }

      const taskData = {
        orgId,
        projectId: data.projectId,
        title: data.title,
        description: data.description || null,
        type: data.type || 'task',
        status: data.status || 'todo',
        priority: data.priority || 'medium',
        creatorId: userId,
        assigneeId,
        memberProfileId,
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        weight: data.weight || 3,
        progress: 0,
        parentTaskId: data.parentTaskId || null,
        tags: data.tags || null,
        needsReview: hasWarnings,
        warnings: hasWarnings ? JSON.stringify(data.warnings) : null,
      };

      const dependsOnIds = Array.isArray(data.dependsOn) ? data.dependsOn : [];

      let newTask;
      if (dependsOnIds.length > 0) {
        newTask = await storage.createTaskWithDependencies(taskData, dependsOnIds, orgId, userId);
      } else {
        newTask = await storage.createTask(taskData);
        await storage.createActivityLog({
          orgId,
          userId,
          entityType: 'task',
          entityId: newTask.id,
          action: 'create',
          changes: JSON.stringify(data),
          source: 'ai_chat',
        });
      }

      if (hasWarnings && newTask) {
        try {
          const decisionTasks = await createDecisionTasksForWarnings(
            newTask, data.warnings, userId, orgId
          );
          if (decisionTasks.length > 0) {
            await pushDecisionRequests(decisionTasks, orgId, userId);
          }
        } catch (err) {
          console.error('[DecisionService] Failed to create decision tasks:', err);
        }
      }

      return {
        success: true,
        message: `任务「${data.title}」已成功创建`,
        entity: newTask,
        duplicateWarning,
      };
    }

    case 'update_task': {
      const { taskId, version, ...updateFields } = data;

      const oldTask = await storage.getTaskById(taskId);
      if (!oldTask) {
        return { success: false, message: '未找到该任务' };
      }

      const updateData: Record<string, any> = {};
      if (updateFields.title) updateData.title = updateFields.title;
      if (updateFields.status) updateData.status = updateFields.status;
      if (updateFields.priority) updateData.priority = updateFields.priority;
      if (updateFields.memberProfileId) {
        const mp = await storage.getMemberProfileById(updateFields.memberProfileId);
        if (!mp || mp.orgId !== orgId) {
          return { success: false, message: `成员档案 #${updateFields.memberProfileId} 不存在或不属于当前组织` };
        }
        updateData.memberProfileId = updateFields.memberProfileId;
        updateData.assigneeId = null;
      } else if (updateFields.assigneeId) {
        updateData.assigneeId = updateFields.assigneeId;
        updateData.memberProfileId = null;
      }
      if (updateFields.dueDate) updateData.dueDate = new Date(updateFields.dueDate);
      if (updateFields.weight) updateData.weight = updateFields.weight;
      if (updateFields.progress !== undefined) updateData.progress = updateFields.progress;
      if (updateFields.description) updateData.description = updateFields.description;

      if (updateFields.status === 'done') {
        updateData.completedAt = new Date();
      }

      let updated;
      if (version !== undefined) {
        updated = await storage.updateTaskWithVersion(taskId, version, updateData);
        if (!updated) {
          return {
            success: false,
            message: '该任务已被其他人修改，请刷新后重试',
            entity: { conflict: true, taskId },
          };
        }
      } else {
        updated = await storage.updateTask(taskId, updateData);
        if (!updated) {
          return { success: false, message: '更新失败' };
        }
      }

      await storage.createActivityLog({
        orgId,
        userId,
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
        orgId,
        name: data.name,
        description: data.description || null,
        deptId: data.deptId || null,
        ownerId: userId,
        status: 'active',
        startDate: data.startDate ? new Date(data.startDate) : null,
        targetDate: data.targetDate ? new Date(data.targetDate) : null,
      });

      await storage.createActivityLog({
        orgId,
        userId,
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
        orgId,
        userId,
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

    case 'create_user': {
      let newUser;
      try {
        newUser = await storage.createUser({
          orgId,
          displayName: data.displayName,
          email: data.email,
          role: data.role || 'member',
          deptId: data.deptId ?? null,
          jobRoleId: data.jobRoleId ?? null,
          isActive: true,
          authProvider: 'manual',
        });
      } catch (err: any) {
        if (err.message?.includes('unique') || err.code === '23505') {
          return { success: false, message: `邮箱「${data.email}」已被使用，请换一个邮箱` };
        }
        throw err;
      }

      await storage.createActivityLog({
        orgId,
        userId,
        entityType: 'user',
        entityId: newUser.id,
        action: 'create',
        changes: JSON.stringify(data),
        source: 'ai_chat',
      });

      return {
        success: true,
        message: `成员「${data.displayName}」已成功创建`,
        entity: newUser,
      };
    }

    case 'update_user': {
      const { userId: targetUserId, ...updateFields } = data;
      const oldUser = await storage.getUserById(targetUserId);
      if (!oldUser) {
        return { success: false, message: '未找到该用户' };
      }

      if (oldUser.orgId !== orgId) {
        return { success: false, message: '无法修改其他组织的成员' };
      }

      const requester = await storage.getUserById(userId);
      const requesterRole = requester?.role || 'member';
      const roleHierarchy: Record<string, number> = { member: 0, head: 1, admin: 2, owner: 3 };

      if (updateFields.role !== undefined) {
        if (roleHierarchy[requesterRole] < 2) {
          return { success: false, message: '只有管理员或负责人才能修改角色' };
        }
        if (roleHierarchy[updateFields.role] >= roleHierarchy[requesterRole]) {
          return { success: false, message: '不能将角色提升到与自己相同或更高的级别' };
        }
      }

      if (updateFields.isActive !== undefined && roleHierarchy[requesterRole] < 2) {
        return { success: false, message: '只有管理员或负责人才能停用/激活成员' };
      }

      const updateData: Record<string, any> = {};
      if (updateFields.displayName !== undefined) updateData.displayName = updateFields.displayName;
      if (updateFields.role !== undefined) updateData.role = updateFields.role;
      if (updateFields.deptId !== undefined) updateData.deptId = updateFields.deptId;
      if (updateFields.jobRoleId !== undefined) updateData.jobRoleId = updateFields.jobRoleId;
      if (updateFields.isActive !== undefined) updateData.isActive = updateFields.isActive;

      const updated = await storage.updateUser(targetUserId, updateData);
      if (!updated) {
        return { success: false, message: '更新失败' };
      }

      await storage.createActivityLog({
        orgId,
        userId,
        entityType: 'user',
        entityId: targetUserId,
        action: 'update',
        changes: JSON.stringify({ before: oldUser, after: updateFields }),
        source: 'ai_chat',
      });

      return {
        success: true,
        message: `成员「${updated.displayName}」已更新`,
        entity: updated,
      };
    }

    case 'create_department': {
      const newDept = await storage.createDepartment({
        orgId,
        name: data.name,
        description: data.description || null,
        color: data.color || null,
        parentDeptId: data.parentDeptId || null,
      });

      await storage.createActivityLog({
        orgId,
        userId,
        entityType: 'department',
        entityId: newDept.id,
        action: 'create',
        changes: JSON.stringify(data),
        source: 'ai_chat',
      });

      return {
        success: true,
        message: `部门「${data.name}」已成功创建`,
        entity: newDept,
      };
    }

    case 'judge_assignment': {
      const { taskId, userId: targetUserId } = data;
      try {
        const verdictResult = await judgeTaskAssignment(taskId, targetUserId);
        
        const verdict = await storage.createVerdict({
          orgId,
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

    case 'resolve_decision': {
      const { decisionTaskId, updates } = data;
      try {
        const decisionCheck = await storage.getTaskById(decisionTaskId);
        if (!decisionCheck) {
          return { success: false, message: `决策任务 #${decisionTaskId} 不存在` };
        }
        if (decisionCheck.orgId !== orgId) {
          return { success: false, message: '无权操作此决策任务' };
        }
        if (!decisionCheck.isDecisionTask) {
          return { success: false, message: `任务 #${decisionTaskId} 不是决策任务` };
        }
        if (decisionCheck.assigneeId !== userId && decisionCheck.creatorId !== userId) {
          return { success: false, message: '你不是此决策任务的负责人或创建者' };
        }

        const updateData: Record<string, any> = {};
        if (updates.assigneeId) updateData.assigneeId = updates.assigneeId;
        if (updates.dueDate) {
          const parsedDate = new Date(updates.dueDate);
          if (isNaN(parsedDate.getTime())) {
            return { success: false, message: '截止日期格式无效' };
          }
          updateData.dueDate = parsedDate;
        }
        if (updates.priority) updateData.priority = updates.priority;
        if (updates.description) updateData.description = updates.description;
        if (updates.weight) updateData.weight = updates.weight;

        const { decisionTask, originalTask } = await storage.resolveDecisionTask(decisionTaskId, updateData);
        const taskTitle = originalTask?.title || '未知任务';

        await storage.createActivityLog({
          orgId,
          userId,
          entityType: 'task',
          entityId: originalTask?.id || decisionTaskId,
          action: 'decision_resolved',
          changes: JSON.stringify({ decisionTaskId, updates }),
          source: 'ai_chat',
        });

        return {
          success: true,
          message: `决策已确认，任务「${taskTitle}」已更新`,
          entity: originalTask,
        };
      } catch (err: any) {
        return { success: false, message: err.message || '决策处理失败' };
      }
    }

    default:
      return { success: false, message: `不支持的操作类型: ${actionType}` };
  }
}

export async function executeBatchActions(
  actions: Array<{ actionType: string; data: Record<string, any> }>,
  userId: number,
  orgId: number
): Promise<{ success: boolean; results: Array<{ success: boolean; message: string; entity?: any; duplicateWarning?: string }> }> {
  const createTaskActions = actions.filter(a => a.actionType === 'create_task');
  const otherActions = actions.filter(a => a.actionType !== 'create_task');

  const results: Array<{ success: boolean; message: string; entity?: any; duplicateWarning?: string }> = [];

  if (createTaskActions.length > 0) {
    const duplicateWarnings = new Map<number, string>();
    const taskItems = [];

    for (let i = 0; i < createTaskActions.length; i++) {
      const data = createTaskActions[i].data;
      const duplicate = await storage.checkDuplicateTask(orgId, data.title, data.assigneeId, data.memberProfileId);
      if (duplicate) {
        duplicateWarnings.set(i, `系统中已存在类似任务「${duplicate.title}」(#${duplicate.id})`);
      }

      const hasWarnings = Array.isArray(data.warnings) && data.warnings.length > 0;
      let batchAssigneeId = data.assigneeId || userId;
      let batchMemberProfileId = null;
      if (data.memberProfileId) {
        const mp = await storage.getMemberProfileById(data.memberProfileId);
        if (mp && mp.orgId === orgId) {
          batchMemberProfileId = data.memberProfileId;
          batchAssigneeId = null;
        }
      }

      taskItems.push({
        data: {
          orgId,
          projectId: data.projectId,
          title: data.title,
          description: data.description || null,
          type: data.type || 'task',
          status: data.status || 'todo',
          priority: data.priority || 'medium',
          creatorId: userId,
          assigneeId: batchAssigneeId,
          memberProfileId: batchMemberProfileId,
          dueDate: data.dueDate ? new Date(data.dueDate) : null,
          weight: data.weight || 3,
          progress: 0,
          parentTaskId: data.parentTaskId || null,
          tags: data.tags || null,
          needsReview: hasWarnings,
          warnings: hasWarnings ? JSON.stringify(data.warnings) : null,
        },
        ref: data.ref,
        dependsOn: Array.isArray(data.dependsOn) ? data.dependsOn : undefined,
        dependsOnRef: Array.isArray(data.dependsOnRef) ? data.dependsOnRef : undefined,
      });
    }

    const createdTasks = await storage.batchCreateTasks(taskItems, orgId, userId);

    const allDecisionTasks: any[] = [];
    for (let i = 0; i < createdTasks.length; i++) {
      results.push({
        success: true,
        message: `任务「${createdTasks[i].title}」已成功创建`,
        entity: createdTasks[i],
        duplicateWarning: duplicateWarnings.get(i),
      });

      if (createdTasks[i].needsReview && createdTasks[i].warnings) {
        try {
          const warnings = JSON.parse(createdTasks[i].warnings!);
          if (Array.isArray(warnings) && warnings.length > 0) {
            const decisionTasks = await createDecisionTasksForWarnings(
              createdTasks[i], warnings, userId, orgId
            );
            allDecisionTasks.push(...decisionTasks);
          }
        } catch (err) {
          console.error('[DecisionService] Failed to create decision tasks for batch task:', err);
        }
      }
    }

    if (allDecisionTasks.length > 0) {
      try {
        await pushDecisionRequests(allDecisionTasks, orgId, userId);
      } catch (err) {
        console.error('[DecisionService] Failed to push decision requests:', err);
      }
    }
  }

  for (const action of otherActions) {
    const result = await executeAction(action.actionType, action.data, userId, orgId);
    results.push(result);
  }

  return {
    success: results.every(r => r.success),
    results,
  };
}
