import { useState, useEffect, useRef } from "react";
import AgentLogo from "@/components/AgentLogo";
import AIMessageContent from "./AIMessageContent";
import AiStepQuestion from "./AiStepQuestion";
import ThinkingAnimation from "@/components/ThinkingAnimation";
import { Check } from "lucide-react";

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

interface StepAnswer {
  field: string;
  value: any;
  displayLabel: string;
}

interface GuidedFollowUpData {
  message: string;
  creationType: 'task' | 'project';
  partialData: Record<string, any>;
  steps: StepQuestion[];
  currentStep: number;
}

interface AiGuidedCreationProps {
  followUp: GuidedFollowUpData;
  onComplete: (mergedData: Record<string, any>, creationType: string) => void;
  completed?: boolean;
}

export default function AiGuidedCreation({
  followUp,
  onComplete,
  completed,
}: AiGuidedCreationProps) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [answers, setAnswers] = useState<StepAnswer[]>([]);
  const [dynamicSteps, setDynamicSteps] = useState<StepQuestion[]>([...(followUp.steps || [])]);
  const [finishing, setFinishing] = useState(false);
  const completedRef = useRef(false);

  const totalSteps = dynamicSteps.length;
  const allDone = currentStepIndex >= totalSteps;

  useEffect(() => {
    if (allDone && !completed && !completedRef.current && !finishing) {
      completedRef.current = true;
      setFinishing(true);
      const merged: Record<string, any> = { ...followUp.partialData };
      for (const ans of answers) {
        merged[ans.field] = ans.value;
      }
      const timer = setTimeout(() => {
        onComplete(merged, followUp.creationType);
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [allDone, completed, finishing, answers, followUp, onComplete]);

  const handleSelect = async (value: any, displayLabel: string) => {
    const step = dynamicSteps[currentStepIndex];
    if (!step) return;

    const newAnswer: StepAnswer = {
      field: step.field,
      value,
      displayLabel,
    };

    const updatedAnswers = [...answers, newAnswer];
    setAnswers(updatedAnswers);

    if (step.field === 'projectId' && typeof value === 'number') {
      const nextStep = dynamicSteps[currentStepIndex + 1];
      if (nextStep && nextStep.field === 'parentTaskId') {
        try {
          const res = await fetch(`/api/ai/guided-options?type=parentTasks&projectId=${value}`);
          const json = await res.json();
          const fetchedOptions = Array.isArray(json.data) ? json.data : json.data?.options;
          if (fetchedOptions && fetchedOptions.length > 0) {
            const updated = [...dynamicSteps];
            updated[currentStepIndex + 1] = {
              ...nextStep,
              options: [
                { label: "独立任务 — 直接挂在项目下", value: null },
                ...fetchedOptions,
              ],
            };
            setDynamicSteps(updated);
          }
        } catch {}
      }
    }

    setCurrentStepIndex((prev) => prev + 1);
  };

  const handleSkip = () => {
    const step = dynamicSteps[currentStepIndex];
    if (!step) return;

    const newAnswer: StepAnswer = {
      field: step.field,
      value: step.skipValue ?? null,
      displayLabel: "跳过",
    };

    setAnswers((prev) => [...prev, newAnswer]);
    setCurrentStepIndex((prev) => prev + 1);
  };

  return (
    <div className="flex flex-col gap-3" data-testid="guided-creation">
      <div className="flex flex-col justify-start">
        <div className="mb-2">
          <AgentLogo size={28} animate={false} glow={false} />
        </div>
        <AIMessageContent content={followUp.message} />
      </div>

      {answers.map((ans, idx) => (
        <div
          key={idx}
          className="flex justify-end"
          data-testid={`guided-answer-${ans.field}`}
        >
          <div
            style={{
              maxWidth: '82%',
              background: 'var(--bg-bubble)',
              borderRadius: 18,
              padding: '10px 14px',
              fontFamily: 'var(--font-sans)',
              fontSize: 16,
              lineHeight: 1.5,
              color: 'var(--text-primary)',
              wordBreak: 'break-word',
            }}
            className="whitespace-pre-wrap"
          >
            {dynamicSteps[idx]?.icon && <span className="mr-1">{dynamicSteps[idx].icon}</span>}
            {ans.displayLabel}
          </div>
        </div>
      ))}

      {!allDone && !completed && dynamicSteps[currentStepIndex] && (
        <AiStepQuestion
          step={dynamicSteps[currentStepIndex]}
          stepNumber={currentStepIndex + 1}
          totalSteps={totalSteps}
          onSelect={handleSelect}
          onSkip={handleSkip}
        />
      )}

      {allDone && !completed && finishing && (
        <div className="flex items-center gap-2 px-2 py-3">
          <ThinkingAnimation size={24} label="组装中..." />
        </div>
      )}

      {completed && (
        <div
          className="flex items-center gap-1.5 text-brand text-sm px-2 py-1"
          data-testid="guided-complete"
        >
          <Check className="w-4 h-4" />
          已提交
        </div>
      )}
    </div>
  );
}
