import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getStatusColor(status: string) {
  switch (status) {
    case 'pending': return 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400';
    case 'active': return 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300';
    case 'review': return 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300';
    case 'done': return 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300';
    default: return 'bg-gray-100 text-gray-600';
  }
}

export function getStatusLabel(status: string) {
  switch (status) {
    case 'pending': return '待开始';
    case 'active': return '进行中';
    case 'review': return '审核中';
    case 'done': return '已完成';
    default: return status;
  }
}

export function getPriorityLabel(priority: number) {
  switch (priority) {
    case 2: return { label: '紧急', color: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300' };
    case 1: return { label: '重要', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300' };
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
  
  return { text: `逾期${Math.abs(diffDays)}天`, color: 'text-red-600 font-bold' };
}
