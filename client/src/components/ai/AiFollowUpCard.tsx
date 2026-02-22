import { useState } from "react";
import { cn } from "@/lib/utils";
import { Check, PenLine } from "lucide-react";

interface FollowUpQuestion {
  field: string;
  label: string;
  emoji: string;
  options: { label: string; value: any }[];
  allowCustom?: boolean;
}

interface FollowUpData {
  message: string;
  partialData: Record<string, any>;
  questions: FollowUpQuestion[];
}

interface AiFollowUpCardProps {
  followUp: FollowUpData;
  onSubmit: (mergedData: Record<string, any>) => void;
  submitted?: boolean;
}

export default function AiFollowUpCard({
  followUp,
  onSubmit,
  submitted,
}: AiFollowUpCardProps) {
  const [selections, setSelections] = useState<Record<string, any>>({});
  const [customInputs, setCustomInputs] = useState<Record<string, string>>({});
  const [usingCustom, setUsingCustom] = useState<Record<string, boolean>>({});

  const allAnswered = followUp.questions.every((q) => {
    if (usingCustom[q.field]) return customInputs[q.field]?.trim().length > 0;
    return selections[q.field] !== undefined;
  });

  const handleSelect = (field: string, value: any) => {
    if (submitted) return;
    setUsingCustom((prev) => ({ ...prev, [field]: false }));
    setSelections((prev) => ({ ...prev, [field]: value }));
  };

  const handleCustomToggle = (field: string) => {
    if (submitted) return;
    setUsingCustom((prev) => ({ ...prev, [field]: true }));
    setSelections((prev) => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const handleSubmit = () => {
    if (!allAnswered || submitted) return;
    const merged: Record<string, any> = { ...followUp.partialData };
    for (const q of followUp.questions) {
      if (usingCustom[q.field]) {
        merged[q.field] = customInputs[q.field]?.trim();
      } else {
        merged[q.field] = selections[q.field];
      }
    }
    onSubmit(merged);
  };

  return (
    <div
      className="rounded-card bg-card border border-[var(--border-subtle)] overflow-hidden"
      data-testid="followup-card"
    >
      <div className="px-4 py-3 text-sm text-foreground font-medium">
        {followUp.message}
      </div>

      <div className="px-4 pb-3 space-y-3">
        {followUp.questions.map((q) => (
          <div key={q.field} className="space-y-1.5">
            <div className="text-xs text-muted-foreground font-medium">
              {q.emoji} {q.label}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {q.options.map((opt, idx) => {
                const isSelected =
                  !usingCustom[q.field] && selections[q.field] === opt.value;
                return (
                  <button
                    key={idx}
                    onClick={() => handleSelect(q.field, opt.value)}
                    disabled={submitted}
                    className={cn(
                      "rounded-full text-sm px-3 py-1.5 transition-colors duration-150",
                      isSelected
                        ? "bg-brand/10 text-brand"
                        : "bg-muted text-foreground",
                      !submitted && !isSelected && "hover:bg-brand/5",
                      submitted && "opacity-70 cursor-not-allowed"
                    )}
                    data-testid={`followup-option-${q.field}-${idx}`}
                  >
                    {isSelected && <Check className="w-3 h-3 inline mr-1" />}
                    {opt.label}
                  </button>
                );
              })}
              {q.allowCustom && (
                <>
                  <button
                    onClick={() => handleCustomToggle(q.field)}
                    disabled={submitted}
                    className={cn(
                      "rounded-full text-sm px-3 py-1.5 transition-colors duration-150 flex items-center gap-1",
                      usingCustom[q.field]
                        ? "bg-brand/10 text-brand"
                        : "bg-muted text-foreground",
                      !submitted && !usingCustom[q.field] && "hover:bg-brand/5",
                      submitted && "opacity-70 cursor-not-allowed"
                    )}
                  >
                    <PenLine className="w-3 h-3" />
                    自定义
                  </button>
                  {usingCustom[q.field] && (
                    <input
                      type="text"
                      value={customInputs[q.field] || ""}
                      onChange={(e) =>
                        setCustomInputs((prev) => ({
                          ...prev,
                          [q.field]: e.target.value,
                        }))
                      }
                      disabled={submitted}
                      placeholder="输入自定义值..."
                      className="border-b border-border bg-transparent text-sm px-1 py-1 outline-none text-foreground placeholder:text-muted-foreground w-32"
                      data-testid={`followup-custom-input-${q.field}`}
                    />
                  )}
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="px-4 py-3 border-t border-[var(--border-subtle)]">
        {!submitted ? (
          <button
            onClick={handleSubmit}
            disabled={!allAnswered}
            className={cn(
              "flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-150 w-full",
              allAnswered
                ? "bg-brand text-white"
                : "bg-muted text-muted-foreground cursor-not-allowed"
            )}
            data-testid="followup-confirm"
          >
            <Check className="w-3.5 h-3.5" />
            确认
          </button>
        ) : (
          <div className="flex items-center gap-1.5 text-brand text-sm justify-center">
            <Check className="w-4 h-4" />
            已提交
          </div>
        )}
      </div>
    </div>
  );
}
