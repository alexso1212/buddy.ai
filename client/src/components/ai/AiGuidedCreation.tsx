import { useState, useEffect, useRef, useCallback } from "react";
import { ChevronLeft, ChevronRight, X, Check, AlertCircle } from "lucide-react";
import AiStepQuestion from "./AiStepQuestion";
import ThinkingAnimation from "@/components/ThinkingAnimation";
import { apiRequest } from "@/lib/queryClient";

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
  onStepAnswer?: (stepLabel: string, answerLabel: string) => void;
}

function stripEmoji(text: string): string {
  return text.replace(/^[^\u0000-\u007F]+\s*/g, '').replace(/^[\u2600-\u27BF\uD83C-\uDBFF\uDC00-\uDFFF\uFE0F\u200D\u20E3]+\s*/g, '').trim() || text.trim();
}

export default function AiGuidedCreation({
  followUp,
  onComplete,
  completed,
  onStepAnswer,
}: AiGuidedCreationProps) {
  const [dismissed, setDismissed] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [answers, setAnswers] = useState<StepAnswer[]>([]);
  const [dynamicSteps, setDynamicSteps] = useState<StepQuestion[]>([...(followUp.steps || [])]);
  const [finishing, setFinishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newProjectMode, setNewProjectMode] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [creatingProject, setCreatingProject] = useState(false);
  const [slideDirection, setSlideDirection] = useState<'forward' | 'backward'>('forward');
  const [animationKey, setAnimationKey] = useState(0);
  const completedRef = useRef(false);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const totalSteps = dynamicSteps.length;
  const allDone = currentStepIndex >= totalSteps;

  useEffect(() => {
    if (!allDone || completed || completedRef.current) return;
    completedRef.current = true;

    const currentAnswers = [...answers];
    const merged: Record<string, any> = { ...followUp.partialData };
    for (const ans of currentAnswers) {
      if (ans.value === null || ans.value === undefined) continue;
      merged[ans.field] = ans.value;
    }

    if (followUp.creationType === 'task' && !merged.title) {
      setError("缺少任务标题，无法创建");
      completedRef.current = false;
      return;
    }

    setFinishing(true);
    setError(null);
    console.log('[GuidedCreation] 组装数据:', JSON.stringify(merged, null, 2));
    console.log('[GuidedCreation] 创建类型:', followUp.creationType);

    requestAnimationFrame(() => {
      setTimeout(() => {
        try {
          onCompleteRef.current(merged, followUp.creationType);
        } catch (err: any) {
          console.error('[GuidedCreation] onComplete error:', err);
          setError(err.message || "提交失败");
          setFinishing(false);
          completedRef.current = false;
        }
      }, 500);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allDone]);

  const handleCreateProject = useCallback(async () => {
    if (!newProjectName.trim()) return;
    setCreatingProject(true);
    setError(null);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newProjectName.trim(),
          orgId: 1,
          ownerId: 1,
          status: "active",
        }),
      });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || `HTTP ${res.status}`);
      }
      const json = await res.json();
      const project = json.data;
      if (!project?.id) {
        throw new Error("创建项目失败，未返回项目 ID");
      }

      console.log('[GuidedCreation] 新建项目成功:', project.id, project.name);

      const newAnswer: StepAnswer = {
        field: 'projectId',
        value: project.id,
        displayLabel: `${project.name}（新建）`,
      };
      setAnswers(prev => [...prev, newAnswer]);

      if (onStepAnswer) {
        onStepAnswer(stripEmoji(dynamicSteps[currentStepIndex]?.label || '项目'), `${project.name}（新建）`);
      }

      const nextStep = dynamicSteps[currentStepIndex + 1];
      if (nextStep && nextStep.field === 'parentTaskId') {
        const updated = [...dynamicSteps];
        updated[currentStepIndex + 1] = {
          ...nextStep,
          options: [{ label: "独立任务 — 直接挂在项目下", value: null }],
        };
        setDynamicSteps(updated);
      }

      setNewProjectMode(false);
      setNewProjectName("");
      setSlideDirection('forward');
      setAnimationKey(prev => prev + 1);
      setCurrentStepIndex(prev => prev + 1);
    } catch (err: any) {
      console.error('[GuidedCreation] 创建项目失败:', err?.message || err);
      setError(typeof err?.message === 'string' && err.message.length > 0 ? err.message : "创建项目失败，请重试");
    } finally {
      setCreatingProject(false);
    }
  }, [newProjectName, dynamicSteps, currentStepIndex]);

  const handleSelect = async (value: any, displayLabel: string) => {
    const step = dynamicSteps[currentStepIndex];
    if (!step) return;
    setError(null);

    if (step.field === 'projectId' && value === 'new_project') {
      setNewProjectMode(true);
      return;
    }

    const newAnswer: StepAnswer = {
      field: step.field,
      value,
      displayLabel,
    };

    const updatedAnswers = [...answers, newAnswer];
    setAnswers(updatedAnswers);

    if (onStepAnswer) {
      onStepAnswer(stripEmoji(step.label), displayLabel);
    }

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

    setSlideDirection('forward');
    setAnimationKey(prev => prev + 1);
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
    setSlideDirection('forward');
    setAnimationKey(prev => prev + 1);
    setCurrentStepIndex((prev) => prev + 1);
  };

  const handlePrevStep = () => {
    if (currentStepIndex <= 0) return;
    setAnswers(prev => prev.slice(0, -1));
    setSlideDirection('backward');
    setAnimationKey(prev => prev + 1);
    setCurrentStepIndex(prev => prev - 1);
  };

  const handleNextStep = () => {
    if (currentStepIndex >= totalSteps - 1) return;
    if (currentStepIndex >= answers.length) return;
    setSlideDirection('forward');
    setAnimationKey(prev => prev + 1);
    setCurrentStepIndex(prev => prev + 1);
  };

  const handleClose = () => {
    setDismissed(true);
  };

  const currentStep = dynamicSteps[currentStepIndex];
  const canGoBack = currentStepIndex > 0;
  const canGoForward = currentStepIndex < totalSteps - 1 && currentStepIndex < answers.length;

  const slideAnimationStyle = slideDirection === 'forward'
    ? 'wizardSlideForward'
    : 'wizardSlideBackward';

  if (dismissed) return null;

  return (
    <div
      style={{
        background: '#323230',
        borderRadius: 16,
        border: '1px solid rgba(255,255,255,0.08)',
        boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
        margin: '12px 16px',
        overflow: 'hidden',
        animation: 'wizardAppear 250ms ease-out',
      }}
      data-testid="guided-creation"
    >
      <style>{`
        @keyframes wizardAppear {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes wizardSlideForward {
          from { opacity: 0; transform: translateX(15px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes wizardSlideBackward {
          from { opacity: 0; transform: translateX(-15px); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>

      {!allDone && !completed && (
        <div
          style={{
            height: 48,
            padding: '0 16px',
            display: 'flex',
            alignItems: 'center',
          }}
          data-testid="wizard-nav-bar"
        >
          <button
            onClick={handlePrevStep}
            disabled={!canGoBack}
            style={{
              background: 'none',
              border: 'none',
              padding: 4,
              cursor: canGoBack ? 'pointer' : 'default',
              opacity: canGoBack ? 1 : 0.3,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            data-testid="wizard-prev-btn"
          >
            <ChevronLeft style={{ width: 20, height: 20, color: '#9A9893' }} />
          </button>
          <span
            style={{
              fontSize: 14,
              color: '#9A9893',
              margin: '0 4px',
              userSelect: 'none',
            }}
            data-testid="wizard-step-indicator"
          >
            {currentStepIndex + 1} of {totalSteps}
          </span>
          <button
            onClick={handleNextStep}
            disabled={!canGoForward}
            style={{
              background: 'none',
              border: 'none',
              padding: 4,
              cursor: canGoForward ? 'pointer' : 'default',
              opacity: canGoForward ? 1 : 0.3,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            data-testid="wizard-next-btn"
          >
            <ChevronRight style={{ width: 20, height: 20, color: '#9A9893' }} />
          </button>
          <button
            onClick={handleClose}
            style={{
              background: 'none',
              border: 'none',
              padding: 4,
              cursor: 'pointer',
              marginLeft: 'auto',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            data-testid="wizard-close-btn"
          >
            <X style={{ width: 20, height: 20, color: '#9A9893' }} />
          </button>
        </div>
      )}

      {!allDone && !completed && !newProjectMode && currentStep && (
        <div
          key={animationKey}
          style={{ animation: `${slideAnimationStyle} 200ms ease-out` }}
        >
          <div
            style={{
              padding: '4px 20px 16px 20px',
              fontSize: 18,
              fontWeight: 500,
              color: '#ECECEC',
              lineHeight: 1.4,
            }}
            data-testid="wizard-step-title"
          >
            {stripEmoji(currentStep.label)}
          </div>

          {answers.length > 0 && !allDone && !completed && (
            <div style={{ padding: '0 20px 8px 20px' }}>
              {answers.map((ans, idx) => (
                <div key={idx} style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  marginBottom: 4,
                }}>
                  <div style={{
                    background: 'rgba(174,86,48,0.15)',
                    borderRadius: 12,
                    padding: '6px 12px',
                    fontSize: 13,
                    color: '#ECECEC',
                    maxWidth: '80%',
                  }}>
                    <span style={{ color: '#9A9893', fontSize: 12, marginRight: 6 }}>
                      {stripEmoji(dynamicSteps[idx]?.label || '')}:
                    </span>
                    {ans.displayLabel}
                  </div>
                </div>
              ))}
            </div>
          )}

          <AiStepQuestion
            step={currentStep}
            stepNumber={currentStepIndex + 1}
            totalSteps={totalSteps}
            onSelect={handleSelect}
            onSkip={handleSkip}
          />
        </div>
      )}

      {newProjectMode && !completed && (
        <div style={{ padding: '16px 20px' }} data-testid="new-project-input">
          <div style={{ fontSize: 14, color: '#9A9893', marginBottom: 12 }}>输入新项目名称</div>
          <div className="flex items-center gap-1.5">
            <input
              type="text"
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleCreateProject();
                }
              }}
              disabled={creatingProject}
              placeholder="输入项目名称..."
              style={{
                flex: 1,
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 10,
                padding: '12px 14px',
                fontSize: 16,
                color: '#ECECEC',
                outline: 'none',
              }}
              autoFocus
              data-testid="input-new-project-name"
            />
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button
              onClick={() => {
                setNewProjectMode(false);
                setNewProjectName("");
              }}
              disabled={creatingProject}
              style={{
                flex: 1,
                height: 44,
                borderRadius: 10,
                background: 'rgba(255,255,255,0.06)',
                border: 'none',
                fontSize: 15,
                color: '#9A9893',
                cursor: 'pointer',
              }}
              data-testid="btn-cancel-new-project"
            >
              返回
            </button>
            <button
              onClick={handleCreateProject}
              disabled={creatingProject || !newProjectName.trim()}
              style={{
                flex: 1,
                height: 44,
                borderRadius: 10,
                background: '#AE5630',
                border: 'none',
                fontSize: 15,
                fontWeight: 600,
                color: '#FFFFFF',
                cursor: newProjectName.trim() && !creatingProject ? 'pointer' : 'not-allowed',
                opacity: newProjectName.trim() && !creatingProject ? 1 : 0.4,
              }}
              data-testid="btn-create-project"
            >
              {creatingProject ? "创建中..." : "创建项目"}
            </button>
          </div>
        </div>
      )}

      {allDone && !completed && finishing && !error && (
        <div style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <ThinkingAnimation size={24} label="组装中..." />
        </div>
      )}

      {error && (
        <div
          style={{
            padding: '12px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            color: '#E5534B',
            fontSize: 14,
          }}
          data-testid="guided-error"
        >
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {completed && (
        <div
          style={{
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            color: '#AE5630',
            fontSize: 14,
          }}
          data-testid="guided-complete"
        >
          <Check className="w-4 h-4" />
          已提交
        </div>
      )}
    </div>
  );
}
