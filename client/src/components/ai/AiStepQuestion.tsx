import { useState, useRef } from "react";
import { Pencil } from "lucide-react";

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
  onSelect,
  disabled,
}: AiStepQuestionProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [customValue, setCustomValue] = useState("");
  const [inputValue, setInputValue] = useState("");
  const [inputFocused, setInputFocused] = useState(false);
  const selectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hasOptions = step.options && step.options.length > 0;
  const isSelectType = hasOptions;
  const isInputType = !hasOptions;

  const handleOptionClick = (opt: StepOption, index: number) => {
    if (disabled || selectedIndex !== null) return;
    setSelectedIndex(index);
    if (selectTimeoutRef.current) clearTimeout(selectTimeoutRef.current);
    selectTimeoutRef.current = setTimeout(() => {
      onSelect(opt.value, opt.label);
    }, 200);
  };

  const handleCustomSubmit = () => {
    if (disabled || !customValue.trim()) return;
    onSelect(customValue.trim(), customValue.trim());
  };

  const handleCustomKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleCustomSubmit();
    }
  };

  const handleInputConfirm = () => {
    if (disabled || !inputValue.trim()) return;
    onSelect(inputValue.trim(), inputValue.trim());
  };

  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleInputConfirm();
    }
  };

  if (isInputType) {
    return (
      <div data-testid={`step-question-${step.field}`}>
        <style>{`
          .wizard-text-input::placeholder { color: #7A7874; }
        `}</style>
        <div style={{ margin: '0 20px' }}>
          {step.inputType === 'textarea' ? (
            <textarea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleInputKeyDown}
              onFocus={() => setInputFocused(true)}
              onBlur={() => setInputFocused(false)}
              disabled={disabled}
              placeholder={step.customInputPlaceholder || "输入内容..."}
              rows={3}
              style={{
                width: '100%',
                padding: '12px 14px',
                background: 'rgba(255,255,255,0.06)',
                borderRadius: 10,
                border: inputFocused
                  ? '1px solid rgba(174,86,48,0.5)'
                  : '1px solid rgba(255,255,255,0.08)',
                fontSize: 16,
                color: '#ECECEC',
                outline: 'none',
                boxSizing: 'border-box',
                transition: 'border-color 150ms',
                fontFamily: 'inherit',
                resize: 'none',
              }}
              autoFocus
              data-testid={`step-input-${step.field}`}
            />
          ) : (
            <input
              type={step.inputType === 'date' ? 'date' : 'text'}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleInputKeyDown}
              onFocus={() => setInputFocused(true)}
              onBlur={() => setInputFocused(false)}
              disabled={disabled}
              placeholder={step.customInputPlaceholder || "输入内容..."}
              className="wizard-text-input"
              style={{
                width: '100%',
                padding: '12px 14px',
                background: 'rgba(255,255,255,0.06)',
                borderRadius: 10,
                border: inputFocused
                  ? '1px solid rgba(174,86,48,0.5)'
                  : '1px solid rgba(255,255,255,0.08)',
                fontSize: 16,
                color: '#ECECEC',
                outline: 'none',
                boxSizing: 'border-box',
                transition: 'border-color 150ms',
              }}
              autoFocus
              data-testid={`step-input-${step.field}`}
            />
          )}
        </div>
        <div style={{ margin: '12px 20px 16px 20px' }}>
          <button
            onClick={handleInputConfirm}
            disabled={disabled || !inputValue.trim()}
            style={{
              width: '100%',
              height: 44,
              borderRadius: 10,
              background: '#AE5630',
              border: 'none',
              fontSize: 15,
              fontWeight: 600,
              color: '#FFFFFF',
              cursor: inputValue.trim() && !disabled ? 'pointer' : 'not-allowed',
              opacity: inputValue.trim() && !disabled ? 1 : 0.4,
              transition: 'opacity 150ms',
            }}
            data-testid={`step-confirm-${step.field}`}
          >
            确认
          </button>
        </div>
      </div>
    );
  }

  return (
    <div data-testid={`step-question-${step.field}`}>
      <style>{`
        .wizard-custom-input::placeholder { color: #7A7874; }
      `}</style>
      {step.options.map((opt, idx) => {
        const isHighlighted = selectedIndex === idx;
        return (
          <div
            key={idx}
            onClick={() => handleOptionClick(opt, idx)}
            style={{
              height: 56,
              padding: '0 20px',
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              borderTop: '1px solid rgba(255,255,255,0.06)',
              cursor: disabled ? 'not-allowed' : 'pointer',
              background: isHighlighted
                ? 'rgba(174,86,48,0.15)'
                : 'transparent',
              transition: 'background 150ms',
            }}
            onMouseEnter={(e) => {
              if (!isHighlighted && !disabled) {
                e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
              }
            }}
            onMouseLeave={(e) => {
              if (!isHighlighted) {
                e.currentTarget.style.background = 'transparent';
              }
            }}
            onMouseDown={(e) => {
              if (!isHighlighted && !disabled) {
                e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
              }
            }}
            onMouseUp={(e) => {
              if (!isHighlighted && !disabled) {
                e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
              }
            }}
            data-testid={`step-option-${step.field}-${idx}`}
          >
            <span style={{ fontSize: 15, color: '#7A7874', width: 24, flexShrink: 0, textAlign: 'center' }}>
              {idx + 1}
            </span>
            <span style={{ fontSize: 16, color: '#ECECEC' }}>
              {opt.label}
            </span>
          </div>
        );
      })}

      {step.allowCustomInput && (
        <div
          style={{
            height: 56,
            padding: '0 20px',
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            borderTop: '1px solid rgba(255,255,255,0.06)',
          }}
          data-testid={`step-custom-row-${step.field}`}
        >
          <span style={{ width: 24, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Pencil style={{ width: 16, height: 16, color: '#7A7874' }} />
          </span>
          <input
            type="text"
            value={customValue}
            onChange={(e) => setCustomValue(e.target.value)}
            onKeyDown={handleCustomKeyDown}
            disabled={disabled}
            placeholder="输入自定义内容..."
            className="wizard-custom-input"
            style={{
              flex: 1,
              fontSize: 16,
              color: '#ECECEC',
              background: 'transparent',
              border: 'none',
              outline: 'none',
              padding: 0,
            }}
            data-testid={`step-custom-input-${step.field}`}
          />
        </div>
      )}
    </div>
  );
}
