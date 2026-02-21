import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getStatusColor(status: string) {
  switch (status) {
    case 'pending': return 'bg-gray-500/10 text-gray-500';
    case 'active': return 'bg-blue-500/10 text-blue-600';
    case 'review': return 'bg-amber-500/10 text-amber-600';
    case 'done': return 'bg-emerald-500/10 text-emerald-600';
    default: return 'bg-gray-500/10 text-gray-500';
  }
}

export function getStatusLabel(status: string) {
  switch (status) {
    case 'pending': return '待处理';
    case 'active': return '进行中';
    case 'review': return '待审核';
    case 'done': return '已完成';
    default: return status;
  }
}

export function getPriorityLabel(priority: number) {
  switch (priority) {
    case 2: return { label: '紧急', color: 'bg-red-500/10 text-red-600' };
    case 1: return { label: '重要', color: 'bg-amber-500/10 text-amber-600' };
    default: return null;
  }
}

export function getDeadlineInfo(deadline: string, graceDeadline?: string | null) {
  const now = new Date();
  const dl = new Date(deadline + 'T23:59:59');
  const diffMs = dl.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays > 3) return { text: `${diffDays}天后`, color: 'text-muted-foreground' };
  if (diffDays > 0) return { text: `还剩${diffDays}天`, color: 'text-orange-500' };
  if (diffDays === 0) return { text: '今天截止', color: 'text-orange-600 font-medium' };
  
  if (graceDeadline) {
    const gl = new Date(graceDeadline + 'T23:59:59');
    const graceDiffMs = gl.getTime() - now.getTime();
    const graceDiffDays = Math.ceil(graceDiffMs / (1000 * 60 * 60 * 24));
    if (graceDiffDays >= 0) return { text: `宽限期(${graceDiffDays}天)`, color: 'text-orange-500' };
  }
  
  return { text: `逾期${Math.abs(diffDays)}天`, color: 'text-red-500 font-medium' };
}
