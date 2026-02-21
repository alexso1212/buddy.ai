import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { User } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, ArrowRight, Check, X } from "lucide-react";

const TOTAL_STEPS = 6;

const stepsMeta = [
  { title: "\u7ED9\u4F60\u7684\u9879\u76EE\u8D77\u4E2A\u540D\u5B57", required: true },
  { title: "\u8FD9\u4E2A\u9879\u76EE\u8981\u8FBE\u6210\u4EC0\u4E48\u76EE\u6807\uFF1F", required: false },
  { title: "\u600E\u6837\u7B97\u201C\u505A\u5B8C\u4E86\u201D\uFF1F", required: false },
  { title: "\u4EC0\u4E48\u65F6\u5019\u9700\u8981\u5B8C\u6210\uFF1F", required: false },
  { title: "\u8C01\u6765\u8D1F\u8D23\u63A8\u8FDB\uFF1F", required: true },
  { title: "\u786E\u8BA4\u9879\u76EE\u4FE1\u606F", required: false },
];

export default function ProjectWizard() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [step, setStep] = useState(0);
  const [title, setTitle] = useState("");
  const [objective, setObjective] = useState("");
  const [criteria, setCriteria] = useState("");
  const [deadline, setDeadline] = useState("");
  const [ownerId, setOwnerId] = useState(user?.id ?? "");
  const [animDir, setAnimDir] = useState<"next" | "prev">("next");
  const [animating, setAnimating] = useState(false);

  const { data: usersData } = useQuery<User[]>({ queryKey: ["/api/users"] });
  const users = usersData ?? [];

  const canAdvance = () => {
    if (step === 0) return title.trim().length > 0;
    if (step === 4) return ownerId.length > 0;
    return true;
  };

  const goTo = (target: number, dir: "next" | "prev") => {
    if (animating) return;
    setAnimDir(dir);
    setAnimating(true);
    setTimeout(() => {
      setStep(target);
      setAnimating(false);
    }, 150);
  };

  const next = () => { if (canAdvance() && step < 5) goTo(step + 1, "next"); };
  const prev = () => { if (step > 0) goTo(step - 1, "prev"); };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey && step < 5 && canAdvance()) {
        if (document.activeElement?.tagName === "TEXTAREA") return;
        next();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [step, title, ownerId, animating]);

  const createMut = useMutation({
    mutationFn: async () => {
      const body: Record<string, string> = {
        title: title.trim(),
        owner_id: ownerId,
      };
      if (objective.trim()) body.objective = objective.trim();
      if (criteria.trim()) body.acceptance_criteria = criteria.trim();
      if (deadline) body.deadline = deadline;
      const res = await apiRequest("POST", "/api/projects", body);
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      toast({ title: "\u9879\u76EE\u5DF2\u521B\u5EFA" });
      setLocation(`/project/${data.id}`);
    },
    onError: (err: Error) => toast({ title: "\u521B\u5EFA\u5931\u8D25", description: err.message, variant: "destructive" }),
  });

  if (!user) { setLocation("/"); return null; }
  if (user.role !== "ceo" && user.role !== "admin") { setLocation("/projects"); return null; }

  const ownerUser = users.find((u) => u.id === ownerId);
  const progress = ((step + 1) / TOTAL_STEPS) * 100;

  const inputClass =
    "w-full text-lg py-3 bg-transparent border-0 border-b-2 border-muted rounded-none shadow-none focus-visible:ring-0 focus-visible:border-primary transition-colors placeholder:text-muted-foreground/50";

  const animClass = animating
    ? animDir === "next"
      ? "opacity-0 translate-y-4"
      : "opacity-0 -translate-y-4"
    : "opacity-100 translate-y-0";

  const renderStep = () => {
    switch (step) {
      case 0:
        return (
          <Input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="\u9879\u76EE\u540D\u79F0"
            className={inputClass}
            data-testid="input-project-title"
          />
        );
      case 1:
        return (
          <Textarea
            autoFocus
            value={objective}
            onChange={(e) => setObjective(e.target.value)}
            placeholder="\u7528\u4E00\u53E5\u8BDD\u63CF\u8FF0\u9879\u76EE\u76EE\u6807"
            className={`${inputClass} resize-none min-h-[100px]`}
            rows={3}
            data-testid="input-project-objective"
          />
        );
      case 2:
        return (
          <Textarea
            autoFocus
            value={criteria}
            onChange={(e) => setCriteria(e.target.value)}
            placeholder="\u63CF\u8FF0\u9A8C\u6536\u6807\u51C6"
            className={`${inputClass} resize-none min-h-[100px]`}
            rows={3}
            data-testid="input-project-criteria"
          />
        );
      case 3:
        return (
          <Input
            autoFocus
            type="date"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            className={inputClass}
            data-testid="input-project-deadline"
          />
        );
      case 4:
        return (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 w-full">
            {users
              .filter((u) => u.is_active !== false)
              .map((u) => (
                <div
                  key={u.id}
                  className={`flex items-center gap-2 p-3 rounded-md border cursor-pointer transition-all ${
                    ownerId === u.id
                      ? "ring-2 ring-primary border-primary"
                      : "border-border hover-elevate"
                  }`}
                  onClick={() => setOwnerId(u.id)}
                  data-testid={`select-owner-${u.id}`}
                >
                  <span
                    className="w-6 h-6 rounded-full shrink-0 flex items-center justify-center text-xs text-white font-medium"
                    style={{ backgroundColor: u.color ?? "#888" }}
                  >
                    {(u.name ?? "?")[0]}
                  </span>
                  <span className="text-sm truncate">{u.name}</span>
                </div>
              ))}
          </div>
        );
      case 5:
        return (
          <div className="w-full space-y-4">
            <div className="pl-4 border-l-2 border-primary space-y-3">
              <div>
                <span className="text-xs text-muted-foreground">\u9879\u76EE\u540D\u79F0</span>
                <p className="text-sm font-medium">{title}</p>
              </div>
              {objective.trim() && (
                <div>
                  <span className="text-xs text-muted-foreground">\u76EE\u6807</span>
                  <p className="text-sm">{objective}</p>
                </div>
              )}
              {criteria.trim() && (
                <div>
                  <span className="text-xs text-muted-foreground">\u9A8C\u6536\u6807\u51C6</span>
                  <p className="text-sm">{criteria}</p>
                </div>
              )}
              {deadline && (
                <div>
                  <span className="text-xs text-muted-foreground">\u622A\u6B62\u65E5\u671F</span>
                  <p className="text-sm">{new Date(deadline).toLocaleDateString("zh-CN")}</p>
                </div>
              )}
              <div>
                <span className="text-xs text-muted-foreground">\u8D1F\u8D23\u4EBA</span>
                <div className="flex items-center gap-2 mt-0.5">
                  {ownerUser && (
                    <span
                      className="w-5 h-5 rounded-full shrink-0 flex items-center justify-center text-[10px] text-white"
                      style={{ backgroundColor: ownerUser.color ?? "#888" }}
                    >
                      {(ownerUser.name ?? "?")[0]}
                    </span>
                  )}
                  <span className="text-sm font-medium">{ownerUser?.name ?? "\u672A\u6307\u5B9A"}</span>
                </div>
              </div>
            </div>
            <Button
              className="w-full"
              size="lg"
              disabled={createMut.isPending}
              onClick={() => createMut.mutate()}
              data-testid="button-create-project"
            >
              {createMut.isPending ? "\u521B\u5EFA\u4E2D..." : "\u521B\u5EFA\u9879\u76EE"}
              {!createMut.isPending && <Check className="w-4 h-4 ml-2" />}
            </Button>
          </div>
        );
      default:
        return null;
    }
  };

  const showSkip = step === 2 || step === 3;
  const showPrev = step > 0;
  const showNext = step < 5 && !showSkip;

  return (
    <div className="min-h-screen bg-background relative flex flex-col">
      <div
        className="fixed top-0 left-0 h-[2px] bg-primary transition-all duration-300 z-50"
        style={{ width: `${progress}%` }}
        data-testid="wizard-progress"
      />

      <div className="absolute top-3 right-3 z-40">
        <Link href="/projects">
          <Button variant="ghost" size="icon" data-testid="wizard-close">
            <X className="w-5 h-5" />
          </Button>
        </Link>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-4 py-16">
        <div
          className={`w-full max-w-lg flex flex-col items-start transition-all duration-150 ${animClass}`}
        >
          <span className="text-xs text-muted-foreground mb-2">
            {step + 1}/{TOTAL_STEPS}
          </span>
          <h2
            className="text-2xl md:text-3xl font-medium mb-8"
            data-testid="wizard-step-title"
          >
            {stepsMeta[step].title}
          </h2>
          {renderStep()}
        </div>
      </div>

      <div className="sticky bottom-0 bg-background border-t px-4 py-3">
        <div className="max-w-lg mx-auto flex items-center justify-between gap-2">
          <div>
            {showPrev && (
              <Button
                variant="ghost"
                onClick={prev}
                data-testid="button-wizard-prev"
              >
                <ArrowLeft className="w-4 h-4 mr-1" />
                {step === 5 ? "\u4FEE\u6539" : "\u4E0A\u4E00\u6B65"}
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            {showSkip && (
              <Button
                variant="ghost"
                onClick={next}
                data-testid="button-wizard-skip"
              >
                \u53EF\u4EE5\u8DF3\u8FC7
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            )}
            {showNext && step < 5 && (
              <Button
                disabled={!canAdvance()}
                onClick={next}
                data-testid="button-wizard-next"
              >
                {step === 0 ? "\u6309 Enter \u7EE7\u7EED" : "\u7EE7\u7EED"}
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            )}
            {showSkip && (
              <Button
                disabled={!canAdvance()}
                onClick={next}
                data-testid="button-wizard-next"
              >
                \u7EE7\u7EED
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
