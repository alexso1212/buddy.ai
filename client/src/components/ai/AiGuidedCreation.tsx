import { useState, useEffect, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";
import AgentLogo from "@/components/AgentLogo";
import AIMessageContent from "./AIMessageContent";
import AiStepQuestion from "./AiStepQuestion";
import ThinkingAnimation from "@/components/ThinkingAnimation";
import { Check, AlertCircle } from "lucide-react";
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
  const [error, setError] = useState<string | null>(null);
  const [newProjectMode, setNewProjectMode] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [creatingProject, setCreatingProject] = useState(false);
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
      const res = await apiRequest("POST", "/api/projects", {
        name: newProjectName.trim(),
        orgId: 1,
        ownerId: 1,
        status: "active",
      });
      const json = await res.json();
      const project = json.data;
      if (!project?.id) {
        throw new Error("创建项目失败，未返回项目 ID");
      }

      console.log('[GuidedCreation] 新建项目成功:', project.id, project.name);

      const newAnswer: StepAnswer = {
        field: 'projectId',
        value: project.id,
        displayLabel: `📁 ${project.name}（新建）`,
      };
      setAnswers(prev => [...prev, newAnswer]);

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
      setCurrentStepIndex(prev => prev + 1);
    } catch (err: any) {
      console.error('[GuidedCreation] 创建项目失败:', err);
      setError(err.message || "创建项目失败");
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

      {newProjectMode && !completed && (
        <div
          className="rounded-card bg-card border border-[var(--border-subtle)] px-4 py-3"
          style={{ animation: 'messageAppear 200ms ease-out' }}
          data-testid="new-project-input"
        >
          <div className="text-xs text-muted-foreground mb-2">🏗️ 输入新项目名称</div>
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
              className="border border-[var(--border-subtle)] bg-transparent text-sm px-3 py-1.5 rounded-full outline-none text-foreground placeholder:text-muted-foreground flex-1"
              autoFocus
              data-testid="input-new-project-name"
            />
            <button
              onClick={handleCreateProject}
              disabled={creatingProject || !newProjectName.trim()}
              className={cn(
                "rounded-full text-xs px-3 py-1.5 transition-colors duration-150 shrink-0",
                newProjectName.trim() && !creatingProject
                  ? "bg-brand text-white"
                  : "bg-muted text-muted-foreground cursor-not-allowed"
              )}
              data-testid="btn-create-project"
            >
              {creatingProject ? "创建中..." : "创建项目"}
            </button>
          </div>
          <button
            onClick={() => {
              setNewProjectMode(false);
              setNewProjectName("");
            }}
            disabled={creatingProject}
            className="mt-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
            data-testid="btn-cancel-new-project"
          >
            ← 返回选择已有项目
          </button>
        </div>
      )}

      {!allDone && !completed && !newProjectMode && dynamicSteps[currentStepIndex] && (
        <AiStepQuestion
          step={dynamicSteps[currentStepIndex]}
          stepNumber={currentStepIndex + 1}
          totalSteps={totalSteps}
          onSelect={handleSelect}
          onSkip={handleSkip}
        />
      )}

      {allDone && !completed && finishing && !error && (
        <div className="flex items-center gap-2 px-2 py-3">
          <ThinkingAnimation size={24} label="组装中..." />
        </div>
      )}

      {error && (
        <div
          className="flex items-center gap-1.5 text-red-500 dark:text-red-400 text-sm px-2 py-2 bg-red-50 dark:bg-red-900/20 rounded-card"
          data-testid="guided-error"
        >
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
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
