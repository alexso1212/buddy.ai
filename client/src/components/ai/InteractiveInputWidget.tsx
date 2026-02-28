import { useState, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence, Reorder } from "framer-motion";
import type { PanInfo } from "framer-motion";
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

const springTransition = {
  type: "spring" as const,
  damping: 30,
  stiffness: 350,
  mass: 0.8,
};

const cardVariants = {
  enter: (direction: number) => ({
    x: direction < 0 ? "100%" : "-100%",
    scale: 0.92,
    opacity: 0.6,
  }),
  center: {
    x: 0,
    scale: 1,
    opacity: 1,
    transition: { type: "spring", damping: 28, stiffness: 300 },
  },
  exit: (direction: number) => ({
    x: direction < 0 ? "-100%" : "100%",
    scale: 0.92,
    opacity: 0.6,
    transition: { type: "spring", damping: 28, stiffness: 300 },
  }),
};

export default function InteractiveInputWidget({
  questions,
  onSubmit,
  onDismiss,
}: Props) {
  const [currentPage, setCurrentPage] = useState(0);
  const [direction, setDirection] = useState(0);
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
  const autoAdvanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const totalPages = questions.length;
  const currentQ = questions[currentPage];

  const [spotPos, setSpotPos] = useState<{ x: number; y: number } | null>(null);
  const [spotVisible, setSpotVisible] = useState(false);
  const spotFadeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return () => {
      if (spotFadeTimer.current) clearTimeout(spotFadeTimer.current);
      if (autoAdvanceTimer.current) clearTimeout(autoAdvanceTimer.current);
    };
  }, []);

  const updateSpot = useCallback((clientX: number, clientY: number) => {
    const el = cardRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setSpotPos({
      x: clientX - rect.left,
      y: clientY - rect.top,
    });
  }, []);

  const handleCardPointerDown = useCallback((e: React.PointerEvent) => {
    setSpotVisible(true);
    if (spotFadeTimer.current) clearTimeout(spotFadeTimer.current);
    updateSpot(e.clientX, e.clientY);
    if (navigator.vibrate) navigator.vibrate(8);
  }, [updateSpot]);

  const handleCardPointerMove = useCallback((e: React.PointerEvent) => {
    if (spotVisible) updateSpot(e.clientX, e.clientY);
  }, [spotVisible, updateSpot]);

  const handleCardPointerUp = useCallback(() => {
    spotFadeTimer.current = setTimeout(() => setSpotVisible(false), 300);
  }, []);

  const goToPage = useCallback((newPage: number) => {
    if (newPage < 0 || newPage >= totalPages || newPage === currentPage) return;
    setDirection(newPage > currentPage ? -1 : 1);
    setCurrentPage(newPage);
    setCustomText("");
  }, [currentPage, totalPages]);

  const handleDragEnd = useCallback((_e: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const swipeThreshold = 80;
    if (info.offset.x < -swipeThreshold && currentPage < totalPages - 1) {
      goToPage(currentPage + 1);
    } else if (info.offset.x > swipeThreshold && currentPage > 0) {
      goToPage(currentPage - 1);
    }
  }, [currentPage, totalPages, goToPage]);

  const handleSelect = useCallback(
    (questionId: string, option: string, type: string) => {
      setAnswers((prev) => {
        const current = prev[questionId] || [];
        if (type === "single_select") {
          return { ...prev, [questionId]: current[0] === option ? [] : [option] };
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
        if (newVal.length > 0) {
          if (autoAdvanceTimer.current) clearTimeout(autoAdvanceTimer.current);
          if (currentPage < totalPages - 1) {
            autoAdvanceTimer.current = setTimeout(() => {
              goToPage(currentPage + 1);
            }, 400);
          } else {
            autoAdvanceTimer.current = setTimeout(() => {
              const finalAnswers = { ...answers, [q.id]: newVal };
              onSubmit(finalAnswers);
            }, 400);
          }
        }
      } else {
        handleSelect(q.id, option, q.type);
      }
    },
    [currentPage, totalPages, questions, answers, handleSelect, goToPage, onSubmit]
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
      goToPage(currentPage + 1);
    } else {
      onSubmit(answers);
    }
  }, [currentPage, totalPages, answers, onSubmit, goToPage]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onDismiss();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onDismiss]);

  const isSelected = (option: string) => (answers[currentQ?.id] || []).includes(option);

  if (!currentQ) return null;

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.25 }}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0, 0, 0, 0.5)",
          zIndex: 99,
        }}
        onClick={onDismiss}
        data-testid="interactive-overlay"
      />

      <motion.div
        initial={{ y: "100%", opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: "100%", opacity: 0 }}
        transition={springTransition}
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 100,
          padding: "0 12px 16px",
          paddingBottom: "max(16px, env(safe-area-inset-bottom))",
        }}
        data-testid="interactive-input-widget"
      >
        <div
          ref={cardRef}
          style={{
            background: "#1c1c1e",
            borderRadius: 16,
            overflow: "hidden",
            position: "relative",
            maxWidth: 560,
            margin: "0 auto",
          }}
          onPointerDown={handleCardPointerDown}
          onPointerMove={handleCardPointerMove}
          onPointerUp={handleCardPointerUp}
          onPointerLeave={handleCardPointerUp}
          onPointerCancel={handleCardPointerUp}
        >
          {spotPos && (
            <div
              style={{
                position: "absolute",
                width: 600,
                height: 600,
                borderRadius: "50%",
                background: "radial-gradient(circle at center, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.03) 30%, rgba(255,255,255,0.01) 60%, rgba(255,255,255,0) 100%)",
                pointerEvents: "none",
                transform: "translate(-50%, -50%)",
                left: spotPos.x,
                top: spotPos.y,
                opacity: spotVisible ? 1 : 0,
                transition: "opacity 300ms ease-out",
                zIndex: 1,
              }}
            />
          )}

          <div
            style={{
              position: "relative",
              zIndex: 2,
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "14px 16px 10px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {totalPages > 1 && (
                  <>
                    <button
                      onClick={() => goToPage(currentPage - 1)}
                      disabled={currentPage === 0}
                      style={{
                        background: "none",
                        border: "none",
                        color: currentPage === 0 ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.5)",
                        cursor: currentPage === 0 ? "default" : "pointer",
                        padding: "4px 8px",
                        display: "flex",
                        fontSize: 18,
                      }}
                      data-testid="btn-prev-question"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <span style={{ fontSize: 14, color: "rgba(255,255,255,0.5)", userSelect: "none" }}>
                      {currentPage + 1} of {totalPages}
                    </span>
                    <button
                      onClick={() => goToPage(currentPage + 1)}
                      disabled={currentPage === totalPages - 1}
                      style={{
                        background: "none",
                        border: "none",
                        color: currentPage === totalPages - 1 ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.5)",
                        cursor: currentPage === totalPages - 1 ? "default" : "pointer",
                        padding: "4px 8px",
                        display: "flex",
                        fontSize: 18,
                      }}
                      data-testid="btn-next-question"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </>
                )}
              </div>
              <button
                onClick={onDismiss}
                style={{
                  background: "none",
                  border: "none",
                  color: "rgba(255,255,255,0.5)",
                  cursor: "pointer",
                  padding: "4px 8px",
                  display: "flex",
                  fontSize: 20,
                }}
                data-testid="btn-dismiss-widget"
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ overflow: "hidden", position: "relative", minHeight: 120 }}>
              <AnimatePresence initial={false} custom={direction} mode="popLayout">
                <motion.div
                  key={currentPage}
                  custom={direction}
                  variants={cardVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  drag={totalPages > 1 ? "x" : false}
                  dragConstraints={{ left: 0, right: 0 }}
                  dragElastic={0.8}
                  onDragEnd={handleDragEnd}
                  style={{ touchAction: totalPages > 1 ? "pan-y" : "auto" }}
                >
                  <div style={{ padding: "4px 20px 14px" }}>
                    <h3
                      style={{
                        fontSize: 18,
                        fontWeight: 600,
                        color: "#ffffff",
                        margin: "0 0 16px 0",
                        lineHeight: 1.4,
                      }}
                    >
                      {currentQ.question}
                    </h3>

                    {currentQ.type === "rank_priorities" ? (
                      <div data-no-deform>
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
                                scale: 1.03,
                                boxShadow: "0 6px 20px rgba(0,0,0,0.5)",
                                cursor: "grabbing",
                              }}
                              transition={{ duration: 0.2 }}
                              style={{
                                cursor: "grab",
                                touchAction: "none",
                                display: "flex",
                                alignItems: "center",
                                gap: 16,
                                padding: "14px 0",
                                borderBottom: index < (answers[currentQ.id] || currentQ.options).length - 1 ? "1px solid rgba(255,255,255,0.08)" : "none",
                                userSelect: "none",
                              }}
                              data-testid={`rank-item-${option}`}
                            >
                              <span
                                style={{
                                  fontSize: 16,
                                  fontWeight: 500,
                                  color: "rgba(255,255,255,0.4)",
                                  width: 24,
                                  flexShrink: 0,
                                }}
                              >
                                {index + 1}
                              </span>
                              <span
                                style={{
                                  flex: 1,
                                  fontSize: 16,
                                  color: "rgba(255,255,255,0.9)",
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
                        {currentQ.options.map((option, index) => {
                          const selected = isSelected(option);
                          return (
                            <button
                              key={option}
                              onClick={() => handleOptionClick(option)}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 16,
                                width: "100%",
                                padding: "14px 0",
                                background: selected ? "rgba(255,255,255,0.08)" : "transparent",
                                border: "none",
                                borderBottom: index < currentQ.options.length - 1 ? "1px solid rgba(255,255,255,0.08)" : "none",
                                borderRadius: selected ? 8 : 0,
                                cursor: "pointer",
                                textAlign: "left",
                                transition: "background 120ms ease",
                                position: "relative",
                                overflow: "hidden",
                              }}
                              tabIndex={0}
                              data-testid={`option-chip-${currentQ.id}-${option}`}
                            >
                              <span
                                style={{
                                  fontSize: 16,
                                  color: "rgba(255,255,255,0.4)",
                                  width: 24,
                                  flexShrink: 0,
                                }}
                              >
                                {index + 1}
                              </span>
                              <span
                                style={{
                                  flex: 1,
                                  fontSize: 16,
                                  color: "rgba(255,255,255,0.9)",
                                }}
                              >
                                {option}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>

            {(currentQ.type === "multi_select" || currentQ.type === "rank_priorities") && (
              <div style={{ padding: "6px 20px 10px", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                <button
                  onClick={handleConfirmCurrent}
                  disabled={!canSubmitCurrent}
                  style={{
                    width: "100%",
                    padding: "11px 0",
                    borderRadius: 10,
                    border: "none",
                    fontSize: 15,
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
                  gap: 8,
                  padding: "10px 20px 14px",
                  borderTop: "1px solid rgba(255,255,255,0.08)",
                }}
              >
                <Paperclip size={16} style={{ color: "rgba(255,255,255,0.3)", flexShrink: 0 }} />
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
                    color: "rgba(255,255,255,0.4)",
                    lineHeight: 1.4,
                    padding: 0,
                  }}
                  data-testid="interactive-custom-input"
                />
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </>
  );
}
