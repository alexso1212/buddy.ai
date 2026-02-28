import { useState, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence, Reorder } from "framer-motion";
import { Check, GripVertical } from "lucide-react";

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

function RankPriorities({
  options,
  onReorder,
}: {
  options: string[];
  onReorder: (newOrder: string[]) => void;
}) {
  return (
    <Reorder.Group
      axis="y"
      values={options}
      onReorder={onReorder}
      style={{ listStyle: "none", padding: 0, margin: 0 }}
    >
      {options.map((option, index) => (
        <Reorder.Item
          key={option}
          value={option}
          whileDrag={{
            scale: 1.02,
            boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
            cursor: "grabbing",
          }}
          transition={{ duration: 0.2 }}
          style={{ cursor: "grab", touchAction: "none" }}
          className="flex items-center gap-3 px-4 py-2.5 mb-1.5 rounded-xl border border-[rgba(0,0,0,0.08)] dark:border-[rgba(255,255,255,0.1)] bg-white dark:bg-[rgba(255,255,255,0.06)] select-none"
          data-testid={`rank-item-${option}`}
        >
          <span className="w-6 h-6 rounded-full bg-gray-200 dark:bg-[rgba(255,255,255,0.1)] text-gray-700 dark:text-gray-300 text-xs font-semibold flex items-center justify-center flex-shrink-0">
            {index + 1}
          </span>
          <span className="flex-1 text-sm text-gray-700 dark:text-gray-200">
            {option}
          </span>
          <GripVertical className="w-4 h-4 text-gray-400 dark:text-gray-500 flex-shrink-0" />
        </Reorder.Item>
      ))}
    </Reorder.Group>
  );
}

export default function InteractiveInputWidget({
  questions,
  onSubmit,
  onDismiss,
}: Props) {
  const [answers, setAnswers] = useState<InteractiveAnswers>(() => {
    const init: InteractiveAnswers = {};
    questions.forEach((q) => {
      if (q.type === "rank_priorities") {
        init[q.id] = [...q.options];
      }
    });
    return init;
  });
  const [isExiting, setIsExiting] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleSelect = useCallback(
    (questionId: string, option: string, type: string) => {
      setAnswers((prev) => {
        const current = prev[questionId] || [];
        if (type === "single_select") {
          return {
            ...prev,
            [questionId]: current[0] === option ? [] : [option],
          };
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

  const canSubmit = questions.every((q) => {
    const answer = answers[q.id];
    if (q.type === "rank_priorities") return true;
    return answer && answer.length > 0;
  });

  const handleSubmit = useCallback(() => {
    if (!canSubmit) return;
    setIsExiting(true);
    setTimeout(() => {
      onSubmit(answers);
    }, 200);
  }, [canSubmit, answers, onSubmit]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onDismiss();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onDismiss]);

  return (
    <AnimatePresence>
      {!isExiting && (
        <motion.div
          ref={containerRef}
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 20, opacity: 0 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="rounded-t-2xl border-t border-[rgba(0,0,0,0.06)] dark:border-[rgba(255,255,255,0.08)]"
          style={{
            background: "rgba(255, 255, 255, 0.8)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            padding: "16px 20px",
          }}
          data-testid="interactive-input-widget"
        >
          <div className="dark:!bg-transparent" style={{
            position: "absolute",
            inset: 0,
            borderRadius: "16px 16px 0 0",
            background: "transparent",
            pointerEvents: "none",
          }}>
            <div className="hidden dark:block" style={{
              position: "absolute",
              inset: 0,
              borderRadius: "16px 16px 0 0",
              background: "rgba(30, 28, 26, 0.85)",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
            }} />
          </div>

          <div style={{ position: "relative", zIndex: 1 }}>
            {questions.map((q, index) => (
              <motion.div
                key={q.id}
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: index * 0.1, duration: 0.2 }}
                className={index < questions.length - 1 ? "mb-4" : ""}
                data-testid={`question-card-${q.id}`}
              >
                <p className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-3">
                  {q.question}
                </p>

                {q.type === "rank_priorities" ? (
                  <RankPriorities
                    options={answers[q.id] || q.options}
                    onReorder={(newOrder) => handleReorder(q.id, newOrder)}
                  />
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {q.options.map((option) => {
                      const isSelected = (answers[q.id] || []).includes(option);
                      return (
                        <button
                          key={option}
                          onClick={() => handleSelect(q.id, option, q.type)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              handleSelect(q.id, option, q.type);
                            }
                          }}
                          className={`
                            inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm select-none
                            transition-all duration-150 ease-out
                            active:scale-[0.97]
                            ${
                              isSelected
                                ? "bg-[#D4B896] text-[#1a1918] border border-[#D4B896] dark:bg-[#D4B896] dark:text-[#1a1918] dark:border-[#D4B896]"
                                : "bg-white/90 text-gray-700 border border-[rgba(0,0,0,0.1)] hover:bg-[rgba(0,0,0,0.04)] hover:border-[rgba(0,0,0,0.15)] dark:bg-[rgba(255,255,255,0.06)] dark:text-gray-200 dark:border-[rgba(255,255,255,0.12)] dark:hover:bg-[rgba(255,255,255,0.1)]"
                            }
                          `}
                          tabIndex={0}
                          data-testid={`option-chip-${q.id}-${option}`}
                        >
                          {isSelected && (
                            <motion.span
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              transition={{ type: "spring", stiffness: 500, damping: 30 }}
                            >
                              <Check className="w-3.5 h-3.5" />
                            </motion.span>
                          )}
                          {option}
                        </button>
                      );
                    })}
                  </div>
                )}
              </motion.div>
            ))}

            <div className="flex items-center justify-between mt-4">
              <button
                onClick={onDismiss}
                className="text-xs text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                data-testid="btn-dismiss-widget"
              >
                跳过
              </button>
              <button
                disabled={!canSubmit}
                onClick={handleSubmit}
                className={`
                  px-6 py-2 rounded-full text-sm font-medium transition-all duration-150
                  ${
                    canSubmit
                      ? "bg-[#D4B896] text-[#1a1918] hover:bg-[#c9a87e] cursor-pointer active:scale-[0.97]"
                      : "bg-gray-200 text-gray-400 dark:bg-[rgba(255,255,255,0.08)] dark:text-gray-600 cursor-not-allowed opacity-50"
                  }
                `}
                data-testid="btn-confirm-selection"
              >
                确认
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
