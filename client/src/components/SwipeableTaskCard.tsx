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

const SWIPE_THRESHOLD = 60;
const ACTION_WIDTH = 240;

const PRIORITY_LABELS: Record<string, string> = {
  low: "低",
  medium: "中",
  high: "高",
  urgent: "紧急",
};

const PRIORITY_COLORS: Record<string, string> = {
  low: "text-gray-500",
  medium: "text-blue-500",
  high: "text-orange-500",
  urgent: "text-red-500",
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
  const priorityBtnRef = useRef<HTMLButtonElement>(null);
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const currentXRef = useRef(0);
  const didSwipeRef = useRef(false);
  const directionLockedRef = useRef<"horizontal" | "vertical" | null>(null);
  const [translateX, setTranslateX] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [showPriorityPicker, setShowPriorityPicker] = useState(false);
  const [pickerPos, setPickerPos] = useState({ top: 0, left: 0 });

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
    setShowPriorityPicker(false);
  }, []);

  useEffect(() => {
    if (!showPriorityPicker) return;
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      setShowPriorityPicker(false);
    };
    const timer = setTimeout(() => {
      document.addEventListener("click", handleClickOutside);
      document.addEventListener("touchstart", handleClickOutside);
    }, 50);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("click", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [showPriorityPicker]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    startXRef.current = touch.clientX;
    startYRef.current = touch.clientY;
    currentXRef.current = translateX;
    didSwipeRef.current = false;
    directionLockedRef.current = null;
  }, [translateX]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
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

    let newX = currentXRef.current + diffX;
    newX = Math.max(-ACTION_WIDTH, Math.min(0, newX));
    setTranslateX(newX);
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (directionLockedRef.current === "horizontal") {
      if (translateX < -SWIPE_THRESHOLD) {
        setTranslateX(-ACTION_WIDTH);
        setIsOpen(true);
      } else {
        closeSwipe();
      }
    }
    setTimeout(() => {
      didSwipeRef.current = false;
      directionLockedRef.current = null;
    }, 50);
  }, [translateX, closeSwipe]);

  const handleCardClick = useCallback(() => {
    if (didSwipeRef.current) return;
    if (isOpen) {
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

  return (
    <div
      ref={containerRef}
      className="relative overflow-hidden rounded-xl mb-2"
      data-testid={`swipeable-card-${taskId}`}
    >
      <div
        className="absolute inset-y-0 right-0 flex items-stretch"
        style={{ width: ACTION_WIDTH }}
      >
        <button
          className={`flex flex-col items-center justify-center w-[60px] transition-colors ${
            taskStarred
              ? "bg-amber-400 dark:bg-amber-500 text-white"
              : "bg-amber-50 dark:bg-amber-900/40 text-amber-500"
          } ${anyPending ? "opacity-50" : ""}`}
          onClick={(e) => { e.stopPropagation(); starMutation.mutate(); }}
          disabled={anyPending}
          data-testid={`swipe-star-${taskId}`}
        >
          <Star className={`h-5 w-5 ${taskStarred ? "fill-current" : ""}`} />
          <span className="text-[10px] mt-1 font-medium">{taskStarred ? "取消" : "收藏"}</span>
        </button>

        <button
          ref={priorityBtnRef}
          className={`flex flex-col items-center justify-center w-[60px] bg-indigo-50 dark:bg-indigo-900/40 ${PRIORITY_COLORS[taskPriority]} ${anyPending ? "opacity-50" : ""}`}
          onClick={openPriorityPicker}
          disabled={anyPending}
          data-testid={`swipe-priority-${taskId}`}
        >
          <ArrowUpDown className="h-5 w-5" />
          <span className="text-[10px] mt-1 font-medium">优先级</span>
        </button>

        <button
          className={`flex flex-col items-center justify-center w-[60px] transition-colors ${
            taskStatus === "done"
              ? "bg-green-500 dark:bg-green-600 text-white"
              : "bg-green-50 dark:bg-green-900/40 text-green-600 dark:text-green-400"
          } ${anyPending ? "opacity-50" : ""}`}
          onClick={(e) => { e.stopPropagation(); completeMutation.mutate(); }}
          disabled={anyPending}
          data-testid={`swipe-complete-${taskId}`}
        >
          <CheckCircle className={`h-5 w-5 ${taskStatus === "done" ? "fill-current" : ""}`} />
          <span className="text-[10px] mt-1 font-medium">{taskStatus === "done" ? "撤回" : "完成"}</span>
        </button>

        <button
          className={`flex flex-col items-center justify-center w-[60px] bg-red-50 dark:bg-red-900/40 text-red-500 ${anyPending ? "opacity-50" : ""}`}
          onClick={(e) => {
            e.stopPropagation();
            if (window.confirm(`确定要删除任务「${taskTitle}」吗？`)) {
              deleteMutation.mutate();
            }
          }}
          disabled={anyPending}
          data-testid={`swipe-delete-${taskId}`}
        >
          <Trash2 className="h-5 w-5" />
          <span className="text-[10px] mt-1 font-medium">删除</span>
        </button>
      </div>

      <div
        className="relative bg-card rounded-xl"
        style={{
          transform: `translateX(${translateX}px)`,
          transition: didSwipeRef.current ? "none" : "transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)",
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
          className="fixed z-[9999] bg-card border border-border rounded-lg shadow-xl py-1 min-w-[90px]"
          style={{
            top: pickerPos.top,
            left: pickerPos.left,
            transform: "translateY(-100%)",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {["urgent", "high", "medium", "low"].map((p) => (
            <button
              key={p}
              className={`w-full px-3 py-2.5 text-sm text-left transition-colors flex items-center gap-2 active:bg-muted ${
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
