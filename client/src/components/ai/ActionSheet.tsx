import { useEffect, useRef, useCallback } from "react";
import { X } from "lucide-react";

interface ActionSheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  maxHeight?: string;
  showCloseButton?: boolean;
}

export default function ActionSheet({
  open,
  onClose,
  title,
  subtitle,
  children,
  maxHeight = "80vh",
  showCloseButton = true,
}: ActionSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const startY = useRef(0);
  const currentY = useRef(0);
  const isDragging = useRef(false);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest("[data-scroll-container]")) {
      const sc = target.closest("[data-scroll-container]") as HTMLElement;
      if (sc.scrollTop > 0) return;
    }
    startY.current = e.touches[0].clientY;
    isDragging.current = true;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging.current || !sheetRef.current) return;
    currentY.current = e.touches[0].clientY;
    const delta = currentY.current - startY.current;
    if (delta > 0) {
      sheetRef.current.style.transform = `translateY(${delta}px)`;
      sheetRef.current.style.transition = "none";
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (!isDragging.current || !sheetRef.current) return;
    isDragging.current = false;
    const delta = currentY.current - startY.current;
    sheetRef.current.style.transition =
      "transform 300ms cubic-bezier(0.165, 0.85, 0.45, 1)";
    if (delta > 100) {
      sheetRef.current.style.transform = "translateY(100%)";
      setTimeout(onClose, 300);
    } else {
      sheetRef.current.style.transform = "translateY(0)";
    }
  }, [onClose]);

  if (!open) return null;

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 100 }}
      data-testid="action-sheet-root"
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(0,0,0,0.5)",
          backdropFilter: "blur(4px)",
          WebkitBackdropFilter: "blur(4px)",
          animation: "actionSheetFadeIn 200ms ease-out",
        }}
        onClick={onClose}
        data-testid="action-sheet-overlay"
      />

      <div
        ref={sheetRef}
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          maxHeight,
          background: "#1E1D1B",
          borderRadius: "16px 16px 0 0",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 -8px 32px rgba(0,0,0,0.4)",
          animation:
            "slideUpSheet 300ms cubic-bezier(0.165, 0.85, 0.45, 1) forwards",
          transform: "translateY(0)",
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        data-testid="action-sheet-content"
      >
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            paddingTop: 10,
            paddingBottom: 4,
            cursor: "grab",
          }}
        >
          <div
            style={{
              width: 36,
              height: 4,
              borderRadius: 2,
              background: "rgba(255,255,255,0.2)",
            }}
          />
        </div>

        {(title || showCloseButton) && (
          <div
            style={{
              padding: "8px 20px 12px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexShrink: 0,
            }}
          >
            <div>
              {title && (
                <div
                  style={{
                    fontSize: 17,
                    fontWeight: 600,
                    color: "#ECECEC",
                  }}
                >
                  {title}
                </div>
              )}
              {subtitle && (
                <div
                  style={{
                    fontSize: 13,
                    color: "#9A9893",
                    marginTop: 2,
                  }}
                >
                  {subtitle}
                </div>
              )}
            </div>
            {showCloseButton && (
              <button
                onClick={onClose}
                style={{
                  background: "rgba(255,255,255,0.08)",
                  border: "none",
                  borderRadius: "50%",
                  width: 32,
                  height: 32,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  flexShrink: 0,
                }}
                data-testid="action-sheet-close"
              >
                <X size={16} color="#9A9893" />
              </button>
            )}
          </div>
        )}

        <div
          data-scroll-container
          style={{
            flex: 1,
            overflowY: "auto",
            overflowX: "hidden",
            overscrollBehavior: "contain",
            WebkitOverflowScrolling: "touch",
            paddingBottom: "calc(16px + env(safe-area-inset-bottom, 0px))",
          }}
        >
          {children}
        </div>
      </div>

      <style>{`
        @keyframes actionSheetFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
