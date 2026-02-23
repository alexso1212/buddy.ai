import { useState } from "react";
import { cn } from "@/lib/utils";
import { Check, CalendarIcon, SkipForward } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";

interface StepOption {
  label: string;
  value: any;
  description?: string;
  icon?: string;
}

interface StepQuestion {
  step: number;
  field: string;
  icon: string;
  label: string;
  options: StepOption[];
  allowCustomInput: boolean;
  customInputPlaceholder?: string;
  allowSkip: boolean;
  skipValue?: any;
  inputType?: 'text' | 'date' | 'textarea';
}

interface AiStepQuestionProps {
  step: StepQuestion;
  stepNumber: number;
  totalSteps: number;
  onSelect: (value: any, displayLabel: string) => void;
  onSkip: () => void;
  disabled?: boolean;
}

export default function AiStepQuestion({
  step,
  stepNumber,
  totalSteps,
  onSelect,
  onSkip,
  disabled,
}: AiStepQuestionProps) {
  const [selectedValue, setSelectedValue] = useState<any>(undefined);
  const [customValue, setCustomValue] = useState("");
  const [showCustom, setShowCustom] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();

  const handleOptionClick = (opt: StepOption) => {
    if (disabled) return;
    setSelectedValue(opt.value);
    setShowCustom(false);
    onSelect(opt.value, opt.label);
  };

  const handleCustomConfirm = () => {
    if (disabled || !customValue.trim()) return;
    onSelect(customValue.trim(), customValue.trim());
  };

  const handleDateSelect = (date: Date | undefined) => {
    if (!date || disabled) return;
    setSelectedDate(date);
    setCalendarOpen(false);
    const formatted = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    onSelect(formatted, formatted);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleCustomConfirm();
    }
  };

  return (
    <div
      className="rounded-card bg-card border border-[var(--border-subtle)]"
      style={{ animation: 'messageAppear 200ms ease-out' }}
      data-testid={`step-question-${step.field}`}
    >
      <div className="px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-muted-foreground">
            {step.icon} {step.label}
          </span>
          <span className="text-xs text-muted-foreground">
            {stepNumber}/{totalSteps}
          </span>
        </div>

        <div className="flex flex-wrap gap-1.5 mb-2">
          {step.options.map((opt, idx) => {
            const isSelected = selectedValue === opt.value;
            return (
              <button
                key={idx}
                onClick={() => handleOptionClick(opt)}
                disabled={disabled}
                className={cn(
                  "rounded-full text-sm px-3 py-1.5 transition-colors duration-150 text-left",
                  isSelected
                    ? "bg-brand/10 text-brand"
                    : "bg-muted text-foreground",
                  !disabled && !isSelected && "hover:bg-brand/5",
                  disabled && "opacity-70 cursor-not-allowed"
                )}
                data-testid={`step-option-${step.field}-${idx}`}
              >
                <span className="flex items-center gap-1">
                  {opt.icon && <span>{opt.icon}</span>}
                  {isSelected && <Check className="w-3 h-3 inline" />}
                  {opt.label}
                </span>
                {opt.description && (
                  <span className="block text-xs text-muted-foreground mt-0.5">
                    {opt.description}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {step.allowCustomInput && (
          <div className="mt-2">
            {step.inputType === 'date' ? (
              <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                <PopoverTrigger asChild>
                  <button
                    disabled={disabled}
                    className={cn(
                      "flex items-center gap-2 rounded-full text-sm px-3 py-1.5 transition-colors duration-150",
                      selectedDate
                        ? "bg-brand/10 text-brand"
                        : "bg-muted text-foreground",
                      !disabled && "hover:bg-brand/5",
                      disabled && "opacity-70 cursor-not-allowed"
                    )}
                    data-testid={`step-custom-input-${step.field}`}
                  >
                    <CalendarIcon className="w-3.5 h-3.5" />
                    {selectedDate
                      ? `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`
                      : (step.customInputPlaceholder || "选择日期")}
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={handleDateSelect}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            ) : step.inputType === 'textarea' ? (
              <div className="flex flex-col gap-1.5">
                <textarea
                  value={customValue}
                  onChange={(e) => setCustomValue(e.target.value)}
                  disabled={disabled}
                  placeholder={step.customInputPlaceholder || "输入自定义值..."}
                  className="border border-[var(--border-subtle)] bg-transparent text-sm px-3 py-2 rounded-md outline-none text-foreground placeholder:text-muted-foreground resize-none"
                  rows={3}
                  data-testid={`step-custom-input-${step.field}`}
                />
                <button
                  onClick={handleCustomConfirm}
                  disabled={disabled || !customValue.trim()}
                  className={cn(
                    "self-end rounded-full text-xs px-3 py-1 transition-colors duration-150",
                    customValue.trim()
                      ? "bg-brand text-white"
                      : "bg-muted text-muted-foreground cursor-not-allowed"
                  )}
                  data-testid={`step-custom-confirm-${step.field}`}
                >
                  确认
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={customValue}
                  onChange={(e) => setCustomValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={disabled}
                  placeholder={step.customInputPlaceholder || "输入自定义值..."}
                  className="border border-[var(--border-subtle)] bg-transparent text-sm px-3 py-1.5 rounded-full outline-none text-foreground placeholder:text-muted-foreground flex-1"
                  data-testid={`step-custom-input-${step.field}`}
                />
                <button
                  onClick={handleCustomConfirm}
                  disabled={disabled || !customValue.trim()}
                  className={cn(
                    "rounded-full text-xs px-3 py-1.5 transition-colors duration-150 shrink-0",
                    customValue.trim()
                      ? "bg-brand text-white"
                      : "bg-muted text-muted-foreground cursor-not-allowed"
                  )}
                  data-testid={`step-custom-confirm-${step.field}`}
                >
                  确认
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {step.allowSkip && (
        <div className="px-4 pb-3">
          <button
            onClick={onSkip}
            disabled={disabled}
            className={cn(
              "flex items-center gap-1 text-xs text-muted-foreground transition-colors duration-150",
              !disabled && "hover:text-foreground",
              disabled && "opacity-70 cursor-not-allowed"
            )}
            data-testid={`step-skip-${step.field}`}
          >
            <SkipForward className="w-3 h-3" />
            跳过
          </button>
        </div>
      )}
    </div>
  );
}
