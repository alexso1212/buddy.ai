import { useState, useCallback, useEffect, useRef } from "react";
import { Reorder } from "framer-motion";
import { ChevronLeft, ChevronRight, X, Paperclip, GripVertical } from "lucide-react";

export interface InteractiveQuestion {
  id: string;
  question: string;
  type: "single_select" | "multi_select" | "rank_priorities";
  options: string[];
}

export interface InteractiveAnswers {
  [questionId: string]: string[];
}

interface Props {
  questions: InteractiveQuestion[];
  onSubmit: (answers: InteractiveAnswers) => void;
  onDismiss: () => void;
}

export function formatAnswersForDisplay(
  questions: InteractiveQuestion[],
  answers: InteractiveAnswers
): string {
  return questions
    .map((q) => {
      const ans = answers[q.id];
      if (!ans || ans.length === 0) return null;
      if (q.type === "rank_priorities") {
        return `${q.question}\n${ans.map((a, i) => `${i + 1}. ${a}`).join("\n")}`;
      }
      return `${q.question} ${ans.join("、")}`;
    })
    .filter(Boolean)
    .join("\n");
}

export function formatAnswersForAI(
  questions: InteractiveQuestion[],
  answers: InteractiveAnswers
): Record<string, any> {
  return {
    type: "interactive_response",
    answers: questions.map((q) => ({
      questionId: q.id,
      question: q.question,
      type: q.type,
      ...(q.type === "rank_priorities"
        ? { ranked: answers[q.id] || q.options }
        : { selected: answers[q.id] || [] }),
    })),
  };
}

export default function InteractiveInputWidget({
  questions,
  onSubmit,
  onDismiss,
}: Props) {
  const [currentPage, setCurrentPage] = useState(0);
  const [answers, setAnswers] = useState<InteractiveAnswers>(() => {
    const init: InteractiveAnswers = {};
    questions.forEach((q) => {
      if (q.type === "rank_priorities") {
        init[q.id] = [...q.options];
      }
    });
    return init;
  });
  const [customText, setCustomText] = useState("");
  const [isExiting, setIsExiting] = useState(false);
  const [mounted, setMounted] = useState(false);

  const panelRef = useRef<HTMLDivElement>(null);
  const [isPressed, setIsPressed] = useState(false);
  const [glowPos, setGlowPos] = useState({ x: 0.5, y: 0.5 });
  const [showGlow, setShowGlow] = useState(false);
  const glowFadeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const deformState = useRef({ pressed: false, moveHandler: null as ((e: PointerEvent) => void) | null });

  const totalPages = questions.length;
  const currentQ = questions[currentPage];

  useEffect(() => {
    requestAnimationFrame(() => setMounted(true));
    return () => {
      if (glowFadeTimer.current) clearTimeout(glowFadeTimer.current);
      if (deformState.current.moveHandler) {
        window.removeEventListener("pointermove", deformState.current.moveHandler);
      }
    };
  }, []);

  const computeDeform = useCallback((clientX: number, clientY: number) => {
    const el = panelRef.current;
    if (!el) return { transform: "" };
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const rawDx = clientX - cx;
    const rawDy = clientY - cy;
    const dist = Math.sqrt(rawDx * rawDx + rawDy * rawDy);
    const maxDist = Math.max(rect.width, rect.height) * 0.8;
    const norm = Math.min(dist / Math.max(maxDist, 1), 1.2);
    const angle = Math.atan2(rawDy, rawDx);
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);
    const stretch = 0.015;
    const stretchAlong = norm * stretch;
    const compressPerp = norm * stretch * 0.55;
    const scaleX = 1.0 + stretchAlong * Math.abs(cosA) - compressPerp * Math.abs(sinA);
    const scaleY = 1.0 + stretchAlong * Math.abs(sinA) - compressPerp * Math.abs(cosA);
    const tx = cosA * norm * 1.2;
    const ty = sinA * norm * 1.2;
    return {
      transform: `translate(${tx.toFixed(1)}px, ${ty.toFixed(1)}px) scaleX(${scaleX.toFixed(4)}) scaleY(${scaleY.toFixed(4)})`,
    };
  }, []);

  const updateGlowPos = useCallback((clientX: number, clientY: number) => {
    const el = panelRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setGlowPos({
      x: Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (clientY - rect.top) / rect.height)),
    });
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("button, input, textarea, [data-no-deform]")) return;
    setIsPressed(true);
    setShowGlow(true);
    if (glowFadeTimer.current) clearTimeout(glowFadeTimer.current);
    updateGlowPos(e.clientX, e.clientY);
    if (navigator.vibrate) navigator.vibrate(10);
    const el = panelRef.current;
    if (!el) return;
    deformState.current.pressed = true;
    el.style.willChange = "transform";
    const { transform } = computeDeform(e.clientX, e.clientY);
    el.style.transition = "transform 180ms cubic-bezier(0.25,0.46,0.45,0.94)";
    el.style.transform = transform;
    const onMove = (ev: PointerEvent) => {
      if (!deformState.current.pressed || !panelRef.current) return;
      const result = computeDeform(ev.clientX, ev.clientY);
      panelRef.current.style.transition = "transform 50ms ease-out";
      panelRef.current.style.transform = result.transform;
      updateGlowPos(ev.clientX, ev.clientY);
    };
    deformState.current.moveHandler = onMove;
    window.addEventListener("pointermove", onMove);
  }, [computeDeform, updateGlowPos]);

  const handlePointerUp = useCallback(() => {
    setIsPressed(false);
    deformState.current.pressed = false;
    const el = panelRef.current;
    if (el) {
      el.style.transition = "transform 360ms cubic-bezier(0.34,1.56,0.64,1)";
      el.style.transform = "translate(0px, 0px) scaleX(1) scaleY(1)";
      el.style.willChange = "";
    }
    if (deformState.current.moveHandler) {
      window.removeEventListener("pointermove", deformState.current.moveHandler);
      deformState.current.moveHandler = null;
    }
    glowFadeTimer.current = setTimeout(() => setShowGlow(false), 600);
  }, []);

  const handleSelect = useCallback(
    (questionId: string, option: string, type: string) => {
      setAnswers((prev) => {
        const current = prev[questionId] || [];
        if (type === "single_select") {
          const newVal = current[0] === option ? [] : [option];
          return { ...prev, [questionId]: newVal };
        } else {
          return {
            ...prev,
            [questionId]: current.includes(option)
              ? current.filter((o) => o !== option)
              : [...current, option],
          };
        }
      });
    },
    []
  );

  const handleReorder = useCallback((questionId: string, newOrder: string[]) => {
    setAnswers((prev) => ({ ...prev, [questionId]: newOrder }));
  }, []);

  const handleCustomSubmit = useCallback(() => {
    if (!customText.trim()) return;
    const q = questions[currentPage];
    if (!q) return;
    const trimmed = customText.trim();
    if (q.type === "single_select") {
      setAnswers((prev) => ({ ...prev, [q.id]: [trimmed] }));
    } else if (q.type === "multi_select") {
      setAnswers((prev) => {
        const current = prev[q.id] || [];
        if (current.includes(trimmed)) return prev;
        return { ...prev, [q.id]: [...current, trimmed] };
      });
    }
    setCustomText("");
  }, [customText, currentPage, questions]);

  const handleOptionClick = useCallback(
    (option: string) => {
      const q = questions[currentPage];
      if (!q) return;
      if (q.type === "single_select") {
        const current = answers[q.id] || [];
        const newVal = current[0] === option ? [] : [option];
        setAnswers((prev) => ({ ...prev, [q.id]: newVal }));
        if (newVal.length > 0 && currentPage < totalPages - 1) {
          setTimeout(() => setCurrentPage((p) => p + 1), 200);
        }
      } else {
        handleSelect(q.id, option, q.type);
      }
    },
    [currentPage, totalPages, questions, answers, handleSelect]
  );

  const canSubmitCurrent = (() => {
    const q = questions[currentPage];
    if (!q) return false;
    if (q.type === "rank_priorities") return true;
    const ans = answers[q.id];
    return ans && ans.length > 0;
  })();

  const handleConfirmCurrent = useCallback(() => {
    if (currentPage < totalPages - 1) {
      setCurrentPage((p) => p + 1);
    } else {
      setIsExiting(true);
      setTimeout(() => onSubmit(answers), 280);
    }
  }, [currentPage, totalPages, answers, onSubmit]);

  const handleDismissWithAnimation = useCallback(() => {
    setIsExiting(true);
    setTimeout(() => onDismiss(), 280);
  }, [onDismiss]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleDismissWithAnimation();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleDismissWithAnimation]);

  const isSelected = (option: string) => (answers[currentQ?.id] || []).includes(option);

  if (!currentQ) return null;

  return (
    <div
      ref={panelRef}
      style={{
        borderRadius: 16,
        position: "relative",
        padding: 1,
        background: showGlow
          ? `radial-gradient(ellipse 150px 100px at ${glowPos.x * 100}% ${glowPos.y * 100}%, rgba(255,255,255,${isPressed ? 0.55 : 0.3}) 0%, rgba(255,255,255,${isPressed ? 0.2 : 0.12}) 50%, rgba(255,255,255,0.06) 100%)`
          : "linear-gradient(to bottom, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0.07) 40%, rgba(255,255,255,0.04) 100%)",
        boxShadow: showGlow
          ? `0 0 ${isPressed ? 20 : 12}px rgba(255,255,255,${isPressed ? 0.12 : 0.06})`
          : "none",
        opacity: isExiting ? 0 : mounted ? 1 : 0,
        transform: isExiting ? "translateY(16px)" : mounted ? "translateY(0)" : "translateY(16px)",
        transition: showGlow && !isPressed
          ? "background 0.5s ease, box-shadow 0.5s ease, opacity 280ms ease, transform 280ms ease"
          : "background 0.05s ease, box-shadow 0.05s ease, opacity 280ms ease, transform 280ms ease",
      }}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      onPointerCancel={handlePointerUp}
      data-testid="interactive-input-widget"
    >
      <div
        style={{
          background: "#1A1918",
          borderRadius: 15,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 16px 8px",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {totalPages > 1 && (
              <>
                <button
                  onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
                  disabled={currentPage === 0}
                  style={{
                    background: "none",
                    border: "none",
                    color: currentPage === 0 ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.5)",
                    cursor: currentPage === 0 ? "default" : "pointer",
                    padding: 2,
                    display: "flex",
                  }}
                  data-testid="btn-prev-question"
                >
                  <ChevronLeft size={16} />
                </button>
                <span style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", userSelect: "none" }}>
                  {currentPage + 1} of {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={currentPage === totalPages - 1}
                  style={{
                    background: "none",
                    border: "none",
                    color: currentPage === totalPages - 1 ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.5)",
                    cursor: currentPage === totalPages - 1 ? "default" : "pointer",
                    padding: 2,
                    display: "flex",
                  }}
                  data-testid="btn-next-question"
                >
                  <ChevronRight size={16} />
                </button>
              </>
            )}
          </div>
          <button
            onClick={handleDismissWithAnimation}
            style={{
              background: "none",
              border: "none",
              color: "rgba(255,255,255,0.4)",
              cursor: "pointer",
              padding: 2,
              display: "flex",
              transition: "color 150ms",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.7)")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.4)")}
            data-testid="btn-dismiss-widget"
          >
            <X size={16} />
          </button>
        </div>

        <div style={{ padding: "14px 16px 6px" }}>
          <p
            style={{
              fontSize: 15,
              fontWeight: 500,
              color: "rgba(255,255,255,0.88)",
              margin: 0,
              lineHeight: 1.4,
            }}
          >
            {currentQ.question}
          </p>
        </div>

        <div
          style={{
            flex: 1,
            overflowY: "auto",
            overscrollBehavior: "contain",
            WebkitOverflowScrolling: "touch",
          }}
        >
          {currentQ.type === "rank_priorities" ? (
            <div style={{ padding: "4px 8px" }} data-no-deform>
              <Reorder.Group
                axis="y"
                values={answers[currentQ.id] || currentQ.options}
                onReorder={(newOrder) => handleReorder(currentQ.id, newOrder)}
                style={{ listStyle: "none", padding: 0, margin: 0 }}
              >
                {(answers[currentQ.id] || currentQ.options).map((option, index) => (
                  <Reorder.Item
                    key={option}
                    value={option}
                    whileDrag={{
                      scale: 1.02,
                      boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
                      cursor: "grabbing",
                    }}
                    transition={{ duration: 0.2 }}
                    style={{
                      cursor: "grab",
                      touchAction: "none",
                      display: "flex",
                      alignItems: "center",
                      gap: 14,
                      padding: "14px 16px",
                      borderBottom: "1px solid rgba(255,255,255,0.06)",
                      userSelect: "none",
                    }}
                    data-testid={`rank-item-${option}`}
                  >
                    <span
                      style={{
                        fontSize: 15,
                        fontWeight: 600,
                        color: "rgba(255,255,255,0.35)",
                        width: 20,
                        textAlign: "center",
                        flexShrink: 0,
                      }}
                    >
                      {index + 1}
                    </span>
                    <span
                      style={{
                        flex: 1,
                        fontSize: 15,
                        color: "rgba(255,255,255,0.85)",
                      }}
                    >
                      {option}
                    </span>
                    <GripVertical
                      size={16}
                      style={{ color: "rgba(255,255,255,0.2)", flexShrink: 0 }}
                    />
                  </Reorder.Item>
                ))}
              </Reorder.Group>
            </div>
          ) : (
            <div>
              {currentQ.options.map((option, index) => (
                <button
                  key={option}
                  onClick={() => handleOptionClick(option)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                    width: "100%",
                    padding: "14px 16px",
                    background: isSelected(option) ? "rgba(212,184,150,0.1)" : "transparent",
                    border: "none",
                    borderBottom: "1px solid rgba(255,255,255,0.06)",
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "background 120ms ease",
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected(option)) e.currentTarget.style.background = "rgba(255,255,255,0.04)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = isSelected(option) ? "rgba(212,184,150,0.1)" : "transparent";
                  }}
                  tabIndex={0}
                  data-testid={`option-chip-${currentQ.id}-${option}`}
                >
                  <span
                    style={{
                      fontSize: 15,
                      fontWeight: 600,
                      color: isSelected(option) ? "#D4B896" : "rgba(255,255,255,0.35)",
                      width: 20,
                      textAlign: "center",
                      flexShrink: 0,
                      transition: "color 120ms ease",
                    }}
                  >
                    {index + 1}
                  </span>
                  <span
                    style={{
                      flex: 1,
                      fontSize: 15,
                      color: isSelected(option) ? "#D4B896" : "rgba(255,255,255,0.85)",
                      transition: "color 120ms ease",
                    }}
                  >
                    {option}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {(currentQ.type !== "single_select" || currentPage === totalPages - 1) && (
          <div style={{ padding: "8px 16px 10px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
            <button
              onClick={handleConfirmCurrent}
              disabled={!canSubmitCurrent}
              style={{
                width: "100%",
                padding: "10px 0",
                borderRadius: 10,
                border: "none",
                fontSize: 14,
                fontWeight: 500,
                cursor: canSubmitCurrent ? "pointer" : "not-allowed",
                background: canSubmitCurrent ? "rgba(212,184,150,0.15)" : "rgba(255,255,255,0.04)",
                color: canSubmitCurrent ? "#D4B896" : "rgba(255,255,255,0.2)",
                transition: "all 150ms ease",
              }}
              data-testid="btn-confirm-selection"
            >
              {currentPage < totalPages - 1 ? "下一题" : "确认"}
            </button>
          </div>
        )}

        {currentQ.type !== "rank_priorities" && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "8px 12px 10px",
              borderTop: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            <Paperclip size={16} style={{ color: "rgba(255,255,255,0.25)", flexShrink: 0 }} />
            <input
              type="text"
              value={customText}
              onChange={(e) => setCustomText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && customText.trim()) {
                  e.preventDefault();
                  handleCustomSubmit();
                }
              }}
              placeholder="Type your answer..."
              style={{
                flex: 1,
                background: "transparent",
                border: "none",
                outline: "none",
                fontSize: 15,
                color: "rgba(255,255,255,0.85)",
                lineHeight: 1.4,
                padding: 0,
              }}
              data-testid="interactive-custom-input"
            />
          </div>
        )}
      </div>
    </div>
  );
}
