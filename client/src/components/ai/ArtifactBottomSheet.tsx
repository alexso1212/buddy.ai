import { useState, useRef, useCallback, useEffect } from "react";
import { X } from "lucide-react";
import AIMessageContent from "./AIMessageContent";

interface ArtifactBottomSheetProps {
  open: boolean;
  title: string;
  content: string;
  onClose: () => void;
}

export default function ArtifactBottomSheet({ open, title, content, onClose }: ArtifactBottomSheetProps) {
  const [closing, setClosing] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<HTMLDivElement>(null);
  const dragState = useRef<{ startY: number; startTranslate: number; dragging: boolean }>({
    startY: 0,
    startTranslate: 0,
    dragging: false,
  });
  const [translateY, setTranslateY] = useState(0);

  const handleClose = useCallback(() => {
    setClosing(true);
    setTimeout(() => {
      setClosing(false);
      setTranslateY(0);
      onClose();
    }, 300);
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, handleClose]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    dragState.current = { startY: e.clientY, startTranslate: translateY, dragging: true };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [translateY]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragState.current.dragging) return;
    const dy = e.clientY - dragState.current.startY;
    const newY = Math.max(0, dragState.current.startTranslate + dy);
    setTranslateY(newY);
  }, []);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (!dragState.current.dragging) return;
    dragState.current.dragging = false;
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);

    const sheetEl = sheetRef.current;
    if (!sheetEl) return;
    const sheetHeight = sheetEl.offsetHeight;
    if (translateY > sheetHeight * 0.3) {
      handleClose();
    } else {
      setTranslateY(0);
    }
  }, [translateY, handleClose]);

  if (!open) return null;

  return (
    <>
      <div
        className={`artifact-bottom-sheet-overlay${closing ? " closing" : ""}`}
        onClick={handleClose}
        data-testid="artifact-sheet-overlay"
      />
      <div
        ref={sheetRef}
        className={`artifact-bottom-sheet${closing ? " closing" : ""}`}
        style={{
          transform: translateY > 0 ? `translateY(${translateY}px)` : undefined,
          transition: dragState.current.dragging ? "none" : "transform 300ms ease",
        }}
        data-testid="artifact-bottom-sheet"
      >
        <div
          ref={dragRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          style={{
            touchAction: "none",
            padding: "8px 0",
            cursor: "grab",
            display: "flex",
            justifyContent: "center",
          }}
          data-testid="artifact-sheet-drag-handle"
        >
          <div
            style={{
              width: 36,
              height: 4,
              background: "#3a3a3a",
              borderRadius: 2,
            }}
          />
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            height: 48,
            padding: "0 16px",
            borderBottom: "1px solid #3a3a3a",
            flexShrink: 0,
            gap: 8,
          }}
        >
          <span
            style={{
              color: "var(--text-bright)",
              fontSize: 15,
              fontWeight: 500,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              flex: 1,
            }}
            data-testid="artifact-sheet-title"
          >
            {title}
          </span>
          <button
            onClick={handleClose}
            style={{
              background: "none",
              border: "none",
              color: "var(--text-secondary)",
              cursor: "pointer",
              padding: 4,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 4,
              flexShrink: 0,
            }}
            data-testid="artifact-sheet-close"
          >
            <X size={18} />
          </button>
        </div>

        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: 16,
            WebkitOverflowScrolling: "touch",
          }}
          data-testid="artifact-sheet-body"
        >
          <AIMessageContent content={content} />
        </div>
      </div>
    </>
  );
}
