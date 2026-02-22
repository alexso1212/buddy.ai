import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Bell, CheckSquare, FolderKanban, CheckCheck, Trash2, ArrowRightLeft } from "lucide-react";
import type { User } from "@shared/schema";

interface NotificationItem {
  id: number;
  orgId: number;
  userId: number;
  type: string;
  entityType: string;
  entityId: number;
  entityTitle: string;
  message: string;
  triggeredBy: number;
  isRead: boolean;
  createdAt: string;
  triggeredByUser: User | null;
}

function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "刚刚";
  if (diffMins < 60) return `${diffMins}分钟前`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}小时前`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays}天前`;
  return date.toLocaleDateString();
}

function getTypeIcon(type: string) {
  switch (type) {
    case 'completed': return <CheckCheck className="h-4 w-4 text-green-600" />;
    case 'deleted': return <Trash2 className="h-4 w-4 text-red-500" />;
    case 'status_change': return <ArrowRightLeft className="h-4 w-4 text-blue-500" />;
    default: return <Bell className="h-4 w-4 text-muted-foreground" />;
  }
}

function getEntityIcon(entityType: string) {
  switch (entityType) {
    case 'task': return <CheckSquare className="h-3.5 w-3.5" />;
    case 'project': return <FolderKanban className="h-3.5 w-3.5" />;
    default: return null;
  }
}

export default function Notifications() {
  const [, navigate] = useLocation();

  const { data: notificationsRes, isLoading } = useQuery<{ data: NotificationItem[] }>({
    queryKey: ["/api/notifications"],
    queryFn: async () => {
      const res = await fetch("/api/notifications?userId=1&limit=100");
      return res.json();
    },
    refetchInterval: 30000,
  });

  const markReadMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("PATCH", `/api/notifications/${id}/read`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/notifications/mark-all-read", { userId: 1 });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
    },
  });

  const notifications = notificationsRes?.data ?? [];
  const unreadCount = notifications.filter(n => !n.isRead).length;

  const handleNotificationClick = (notification: NotificationItem) => {
    if (!notification.isRead) {
      markReadMutation.mutate(notification.id);
    }
    if (notification.type !== 'deleted') {
      if (notification.entityType === 'task') {
        navigate(`/tasks/${notification.entityId}`);
      } else if (notification.entityType === 'project') {
        navigate(`/projects/${notification.entityId}`);
      }
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto" data-testid="notifications-page">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-6">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-xl md:text-3xl font-bold" data-testid="notifications-title">通知中心</h1>
          {unreadCount > 0 && (
            <Badge className="bg-blue-500 text-white" data-testid="unread-badge">
              {unreadCount} 未读
            </Badge>
          )}
        </div>
        {unreadCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => markAllReadMutation.mutate()}
            disabled={markAllReadMutation.isPending}
            data-testid="btn-mark-all-read"
          >
            <CheckCheck className="h-4 w-4 mr-1" />
            全部已读
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">加载中...</div>
      ) : notifications.length === 0 ? (
        <div className="text-center py-12" data-testid="notifications-empty">
          <Bell className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
          <p className="text-muted-foreground">暂无通知</p>
        </div>
      ) : (
        <div className="space-y-2" data-testid="notifications-list">
          {notifications.map((notification) => (
            <Card
              key={notification.id}
              className={`p-4 cursor-pointer hover-elevate ${
                !notification.isRead ? 'bg-blue-50/50 dark:bg-blue-950/20' : ''
              }`}
              onClick={() => handleNotificationClick(notification)}
              data-testid={`notification-item-${notification.id}`}
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex-shrink-0">
                  {getTypeIcon(notification.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm ${!notification.isRead ? 'font-medium' : 'text-muted-foreground'}`}
                     data-testid={`notification-message-${notification.id}`}>
                    {notification.message}
                  </p>
                  <div className="flex items-center gap-2 mt-1.5 text-xs text-muted-foreground flex-wrap">
                    <span className="flex items-center gap-1">
                      {getEntityIcon(notification.entityType)}
                      {notification.entityType === 'task' ? '任务' : '项目'}
                    </span>
                    <span>·</span>
                    <span>{timeAgo(notification.createdAt)}</span>
                    {notification.triggeredByUser && (
                      <>
                        <span>·</span>
                        <span>{notification.triggeredByUser.displayName}</span>
                      </>
                    )}
                  </div>
                </div>
                {!notification.isRead && (
                  <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0 mt-2" data-testid={`notification-unread-dot-${notification.id}`} />
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
