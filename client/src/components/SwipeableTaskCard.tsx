import { useRef, useState, useCallback, useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useMutation } from "@tanstack/react-query";
import { Star, CheckCircle, Trash2, ArrowUpDown } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface SwipeableTaskCardProps {
  taskId: number;
  taskTitle: string;
  taskStatus: string;
  taskPriority: string;
  taskStarred: boolean;
  children: ReactNode;
  onNavigate: () => void;
  onDeleted?: () => void;
}

const SWIPE_THRESHOLD = 50;
const ACTION_WIDTH = 240;
const BUTTON_W = 60;

const PRIORITY_LABELS: Record<string, string> = {
  low: "低",
  medium: "中",
  high: "高",
  urgent: "紧急",
};

export default function SwipeableTaskCard({
  taskId,
  taskTitle,
  taskStatus,
  taskPriority,
  taskStarred,
  children,
  onNavigate,
  onDeleted,
}: SwipeableTaskCardProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const actionsRef = useRef<HTMLDivElement>(null);
  const priorityBtnRef = useRef<HTMLButtonElement>(null);
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const currentXRef = useRef(0);
  const velocityRef = useRef(0);
  const lastMoveTimeRef = useRef(0);
  const lastMoveXRef = useRef(0);
  const didSwipeRef = useRef(false);
  const isTouchingRef = useRef(false);
  const directionLockedRef = useRef<"horizontal" | "vertical" | null>(null);
  const [translateX, setTranslateX] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [showPriorityPicker, setShowPriorityPicker] = useState(false);
  const [pickerPos, setPickerPos] = useState({ top: 0, left: 0 });

  const revealProgress = Math.min(1, Math.max(0, -translateX) / ACTION_WIDTH);

  const starMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("PATCH", `/api/tasks/${taskId}`, { starred: !taskStarred, userId: 1 });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
    },
  });

  const completeMutation = useMutation({
    mutationFn: async () => {
      const newStatus = taskStatus === "done" ? "todo" : "done";
      await apiRequest("PATCH", `/api/tasks/${taskId}`, { status: newStatus, userId: 1 });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats/overview"] });
      closeSwipe();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/tasks/${taskId}`, { userId: 1 });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats/overview"] });
      onDeleted?.();
    },
  });

  const priorityMutation = useMutation({
    mutationFn: async (newPriority: string) => {
      await apiRequest("PATCH", `/api/tasks/${taskId}`, { priority: newPriority, userId: 1 });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      setShowPriorityPicker(false);
      closeSwipe();
    },
  });

  const closeSwipe = useCallback(() => {
    setTranslateX(0);
    setIsOpen(false);
    setIsDragging(false);
    setShowPriorityPicker(false);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const handle = (e: TouchEvent | MouseEvent) => {
      const target = e.target as Node;
      if (actionsRef.current?.contains(target)) return;
      closeSwipe();
    };
    const timer = setTimeout(() => {
      document.addEventListener("touchstart", handle, { passive: true });
      document.addEventListener("mousedown", handle);
    }, 30);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("touchstart", handle);
      document.removeEventListener("mousedown", handle);
    };
  }, [isOpen, closeSwipe]);

  useEffect(() => {
    if (!showPriorityPicker) return;
    const handle = () => setShowPriorityPicker(false);
    const timer = setTimeout(() => {
      document.addEventListener("click", handle);
      document.addEventListener("touchstart", handle);
    }, 50);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("click", handle);
      document.removeEventListener("touchstart", handle);
    };
  }, [showPriorityPicker]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    startXRef.current = touch.clientX;
    startYRef.current = touch.clientY;
    currentXRef.current = translateX;
    didSwipeRef.current = false;
    isTouchingRef.current = true;
    directionLockedRef.current = null;
    velocityRef.current = 0;
    lastMoveTimeRef.current = Date.now();
    lastMoveXRef.current = touch.clientX;
  }, [translateX]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isTouchingRef.current) return;
    const touch = e.touches[0];
    const diffX = touch.clientX - startXRef.current;
    const diffY = touch.clientY - startYRef.current;

    if (!directionLockedRef.current) {
      if (Math.abs(diffX) > 8 || Math.abs(diffY) > 8) {
        directionLockedRef.current = Math.abs(diffX) > Math.abs(diffY) ? "horizontal" : "vertical";
      }
      return;
    }

    if (directionLockedRef.current === "vertical") return;

    e.preventDefault();
    didSwipeRef.current = true;
    setIsDragging(true);

    const now = Date.now();
    const dt = now - lastMoveTimeRef.current;
    if (dt > 0) {
      velocityRef.current = (touch.clientX - lastMoveXRef.current) / dt;
    }
    lastMoveTimeRef.current = now;
    lastMoveXRef.current = touch.clientX;

    let newX = currentXRef.current + diffX;
    if (newX > 0) {
      newX = newX * 0.15;
    } else if (newX < -ACTION_WIDTH) {
      const over = -ACTION_WIDTH - newX;
      newX = -ACTION_WIDTH - over * 0.2;
    }
    setTranslateX(newX);
  }, []);

  const handleTouchEnd = useCallback(() => {
    isTouchingRef.current = false;
    setIsDragging(false);

    if (directionLockedRef.current === "horizontal") {
      const vel = velocityRef.current;
      const shouldOpen = translateX < -SWIPE_THRESHOLD || vel < -0.5;
      const shouldClose = !shouldOpen || vel > 0.5;

      if (shouldOpen && !shouldClose) {
        setTranslateX(-ACTION_WIDTH);
        setIsOpen(true);
      } else {
        setTranslateX(0);
        setIsOpen(false);
      }
    }

    setTimeout(() => {
      didSwipeRef.current = false;
      directionLockedRef.current = null;
    }, 50);
  }, [translateX]);

  const handleCardClick = useCallback((e: React.MouseEvent) => {
    if (didSwipeRef.current) return;
    if (isOpen) {
      e.stopPropagation();
      closeSwipe();
      return;
    }
    onNavigate();
  }, [isOpen, closeSwipe, onNavigate]);

  const openPriorityPicker = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    if (priorityBtnRef.current) {
      const rect = priorityBtnRef.current.getBoundingClientRect();
      setPickerPos({
        top: rect.top - 4,
        left: Math.min(rect.left, window.innerWidth - 100),
      });
    }
    setShowPriorityPicker(!showPriorityPicker);
  }, [showPriorityPicker]);

  const anyPending = starMutation.isPending || completeMutation.isPending || deleteMutation.isPending || priorityMutation.isPending;

  const getSpringTransition = () => {
    if (isDragging) return "none";
    return "transform 0.5s cubic-bezier(0.32, 0.72, 0, 1)";
  };

  const btnScale = (index: number) => {
    if (isDragging) {
      const stagger = 0.15 * index;
      const p = Math.max(0, Math.min(1, (revealProgress - stagger) / (1 - stagger)));
      const s = 0.3 + 0.7 * p;
      return `scale(${s})`;
    }
    return revealProgress > 0.1 ? "scale(1)" : "scale(0.3)";
  };

  const btnOpacity = (index: number) => {
    if (isDragging) {
      const stagger = 0.12 * index;
      return Math.max(0, Math.min(1, (revealProgress - stagger) / (0.6)));
    }
    return revealProgress > 0.1 ? 1 : 0;
  };

  const actionBtnTransition = isDragging
    ? "opacity 0.05s ease-out, transform 0.05s ease-out"
    : "opacity 0.4s cubic-bezier(0.32, 0.72, 0, 1), transform 0.5s cubic-bezier(0.32, 0.72, 0, 1)";

  const actions = [
    {
      key: "star",
      bg: taskStarred ? "bg-amber-500" : "bg-amber-400",
      icon: <Star className={`h-[18px] w-[18px] text-white ${taskStarred ? "fill-white" : ""}`} />,
      label: taskStarred ? "取消" : "收藏",
      onClick: (e: React.MouseEvent) => { e.stopPropagation(); starMutation.mutate(); },
      testId: `swipe-star-${taskId}`,
    },
    {
      key: "priority",
      bg: "bg-indigo-500",
      icon: <ArrowUpDown className="h-[18px] w-[18px] text-white" />,
      label: "优先级",
      onClick: openPriorityPicker,
      testId: `swipe-priority-${taskId}`,
      ref: priorityBtnRef,
    },
    {
      key: "complete",
      bg: taskStatus === "done" ? "bg-gray-500" : "bg-green-500",
      icon: <CheckCircle className="h-[18px] w-[18px] text-white" />,
      label: taskStatus === "done" ? "撤回" : "完成",
      onClick: (e: React.MouseEvent) => { e.stopPropagation(); completeMutation.mutate(); },
      testId: `swipe-complete-${taskId}`,
    },
    {
      key: "delete",
      bg: "bg-red-500",
      icon: <Trash2 className="h-[18px] w-[18px] text-white" />,
      label: "删除",
      onClick: (e: React.MouseEvent) => {
        e.stopPropagation();
        if (window.confirm(`确定要删除任务「${taskTitle}」吗？`)) {
          deleteMutation.mutate();
        }
      },
      testId: `swipe-delete-${taskId}`,
    },
  ];

  return (
    <div
      ref={containerRef}
      className="relative overflow-hidden rounded-xl mb-2"
      data-testid={`swipeable-card-${taskId}`}
    >
      <div
        ref={actionsRef}
        className="absolute inset-y-0 right-0 flex items-stretch"
        style={{ width: ACTION_WIDTH }}
      >
        {actions.map((action, i) => (
          <button
            key={action.key}
            ref={action.key === "priority" ? priorityBtnRef : undefined}
            className={`flex flex-col items-center justify-center ${action.bg}`}
            style={{
              width: BUTTON_W,
              transform: btnScale(i),
              opacity: btnOpacity(i),
              transition: actionBtnTransition,
              willChange: "transform, opacity",
            }}
            onClick={action.onClick as any}
            disabled={anyPending}
            data-testid={action.testId}
          >
            {action.icon}
            <span className="text-[10px] mt-1 font-medium text-white/90">{action.label}</span>
          </button>
        ))}
      </div>

      <div
        className="relative bg-card rounded-xl"
        style={{
          transform: `translateX(${translateX}px)`,
          transition: getSpringTransition(),
          willChange: "transform",
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={handleCardClick}
      >
        {children}
      </div>

      {showPriorityPicker && createPortal(
        <div
          className="fixed z-[9999] bg-card border border-border rounded-xl shadow-2xl py-1.5 min-w-[100px] overflow-hidden"
          style={{
            top: pickerPos.top,
            left: pickerPos.left,
            transform: "translateY(-100%)",
            animation: "pickerIn 0.2s cubic-bezier(0.32, 0.72, 0, 1)",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {["urgent", "high", "medium", "low"].map((p) => (
            <button
              key={p}
              className={`w-full px-4 py-2.5 text-sm text-left transition-colors flex items-center gap-2.5 active:bg-muted/80 ${
                taskPriority === p ? "bg-muted font-semibold" : ""
              }`}
              onClick={(e) => { e.stopPropagation(); priorityMutation.mutate(p); }}
              disabled={priorityMutation.isPending}
              data-testid={`swipe-priority-option-${p}-${taskId}`}
            >
              <span className={`w-2.5 h-2.5 rounded-full ${
                p === "urgent" ? "bg-red-500" : p === "high" ? "bg-orange-500" : p === "medium" ? "bg-blue-500" : "bg-gray-400"
              }`} />
              {PRIORITY_LABELS[p]}
            </button>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
}
