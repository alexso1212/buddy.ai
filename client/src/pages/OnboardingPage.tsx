import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'wouter';
import { Loader2, ArrowLeft, Copy, Check, Building2, Link2, Clock, CheckCircle2, Users, Briefcase, UserCheck } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { tapMotionProps } from '@/hooks/use-tap-motion';
import AgentLogo from '@/components/AgentLogo';

type OnboardingStep = 'welcome' | 'create' | 'create-success' | 'join' | 'join-preview' | 'pending' | 'complete';

interface MatchedProfile {
  id: number;
  fullName: string;
  aliases: string | null;
  deptId: number | null;
  jobRoleId: number | null;
  title: string | null;
  email: string | null;
  pendingTaskCount: number;
}

interface OrgPreview {
  id: number;
  name: string;
  description: string | null;
  memberCount: number;
}

const inputClass = 'w-full h-12 px-4 text-[15px] bg-transparent border border-[rgba(255,255,255,0.15)] rounded-full outline-none focus:border-[rgba(255,255,255,0.4)] transition-colors text-white placeholder:text-[rgba(255,255,255,0.35)]';
const textareaClass = 'w-full px-4 py-3 text-[15px] bg-transparent border border-[rgba(255,255,255,0.15)] rounded-2xl outline-none focus:border-[rgba(255,255,255,0.4)] transition-colors text-white placeholder:text-[rgba(255,255,255,0.35)] resize-none';

function PrimaryButton({ children, onClick, disabled, type, testId }: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: 'button' | 'submit';
  testId?: string;
}) {
  return (
    <button
      type={type || 'button'}
      onClick={onClick}
      disabled={disabled}
      data-testid={testId}
      {...tapMotionProps}
      style={{
        width: '100%',
        height: 48,
        borderRadius: 9999,
        background: '#D4B896',
        color: '#1E1D1A',
        fontSize: '15px',
        fontWeight: 600,
        border: 'none',
        cursor: disabled ? 'not-allowed' : 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        opacity: disabled ? 0.5 : 1,
        transition: 'opacity 150ms',
      }}
    >
      {children}
    </button>
  );
}

function SecondaryButton({ children, onClick, testId }: {
  children: React.ReactNode;
  onClick?: () => void;
  testId?: string;
}) {
  return (
    <button
      onClick={onClick}
      data-testid={testId}
      {...tapMotionProps}
      style={{
        width: '100%',
        height: 48,
        borderRadius: 9999,
        background: '#1a1a1a',
        color: 'white',
        fontSize: '15px',
        fontWeight: 500,
        border: '1px solid rgba(255,255,255,0.15)',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
      }}
    >
      {children}
    </button>
  );
}

function BackButton({ onClick, testId }: { onClick: () => void; testId?: string }) {
  return (
    <button
      onClick={onClick}
      data-testid={testId || 'button-back'}
      {...tapMotionProps}
      style={{
        position: 'absolute',
        top: 'calc(16px + env(safe-area-inset-top, 0px))',
        left: 16,
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        background: 'none',
        border: 'none',
        color: 'rgba(255,255,255,0.6)',
        fontSize: '14px',
        cursor: 'pointer',
        zIndex: 10,
        padding: '8px 12px',
        borderRadius: 20,
      }}
    >
      <ArrowLeft size={16} />
      返回
    </button>
  );
}

export default function OnboardingPage() {
  const [, navigate] = useLocation();
  const { user, loginWithToken, refreshAuth } = useAuth();
  const { toast } = useToast();

  const [step, setStep] = useState<OnboardingStep>('welcome');
  const [isLoading, setIsLoading] = useState(false);

  const [orgName, setOrgName] = useState('');
  const [orgDesc, setOrgDesc] = useState('');
  const [createdInviteCode, setCreatedInviteCode] = useState('');
  const [copied, setCopied] = useState(false);

  const [joinCode, setJoinCode] = useState('');
  const [orgPreview, setOrgPreview] = useState<OrgPreview | null>(null);
  const [joinMessage, setJoinMessage] = useState('');

  const [matchedProfile, setMatchedProfile] = useState<MatchedProfile | null>(null);
  const [claimLoading, setClaimLoading] = useState(false);
  const [deptName, setDeptName] = useState<string | null>(null);
  const [roleName, setRoleName] = useState<string | null>(null);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  useEffect(() => {
    if (step === 'pending') {
      let failCount = 0;
      pollRef.current = setInterval(async () => {
        const refreshed = await refreshAuth();
        if (refreshed && refreshed.orgId) {
          if (pollRef.current) clearInterval(pollRef.current);
          setStep('complete');
        } else if (!refreshed) {
          failCount++;
          if (failCount >= 3) {
            if (pollRef.current) clearInterval(pollRef.current);
            toast({ title: '会话已过期，请重新登录', variant: 'destructive' });
            navigate('/login');
          }
        }
      }, 10000);
      return () => {
        if (pollRef.current) clearInterval(pollRef.current);
      };
    }
  }, [step, refreshAuth, toast, navigate]);

  useEffect(() => {
    if (step === 'complete') {
      let cancelled = false;
      let redirectTimer: ReturnType<typeof setTimeout> | null = null;

      const doMatchCheck = async () => {
        const token = localStorage.getItem('buddy_token');
        const headers: Record<string, string> = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;

        try {
          const res = await fetch('/api/member-profiles/match', { headers });
          if (cancelled) return;
          const data = res.ok ? await res.json() : null;
          if (cancelled) return;

          if (data?.data) {
            const profile = data.data as MatchedProfile;
            setMatchedProfile(profile);

            if (profile.deptId) {
              try {
                const dRes = await fetch('/api/departments', { headers });
                if (dRes.ok) {
                  const dData = await dRes.json();
                  const dept = (dData.data || []).find((d: any) => d.id === profile.deptId);
                  if (dept && !cancelled) setDeptName(dept.name);
                }
              } catch {}
            }
            if (profile.jobRoleId) {
              try {
                const rRes = await fetch('/api/job-roles', { headers });
                if (rRes.ok) {
                  const rData = await rRes.json();
                  const role = (rData.data || []).find((r: any) => r.id === profile.jobRoleId);
                  if (role && !cancelled) setRoleName(role.title);
                }
              } catch {}
            }
          } else {
            if (!cancelled) {
              redirectTimer = setTimeout(() => navigate('/'), 3000);
            }
          }
        } catch {
          if (!cancelled) {
            redirectTimer = setTimeout(() => navigate('/'), 3000);
          }
        }
      };

      doMatchCheck();

      return () => {
        cancelled = true;
        if (redirectTimer) clearTimeout(redirectTimer);
      };
    }
  }, [step, navigate]);

  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgName.trim()) {
      toast({ title: '请输入组织名称', variant: 'destructive' });
      return;
    }
    setIsLoading(true);
    try {
      const token = localStorage.getItem('buddy_token');
      const res = await fetch('/api/organizations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ name: orgName.trim(), description: orgDesc.trim() || null }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || '创建失败');
      }
      const data = await res.json();
      const result = data.data;
      setCreatedInviteCode(result.inviteCode);
      if (result.token) {
        localStorage.setItem('buddy_token', result.token);
      }
      await refreshAuth();
      setStep('create-success');
    } catch (err: any) {
      toast({ title: '创建失败', description: err.message, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearchOrg = async () => {
    const code = joinCode.trim().toUpperCase();
    if (!code) {
      toast({ title: '请输入邀请码', variant: 'destructive' });
      return;
    }
    setIsLoading(true);
    try {
      const token = localStorage.getItem('buddy_token');
      const res = await fetch(`/api/organizations/search?code=${encodeURIComponent(code)}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || '未找到该邀请码对应的组织');
      }
      const data = await res.json();
      setOrgPreview(data.data);
      setStep('join-preview');
    } catch (err: any) {
      toast({ title: '搜索失败', description: err.message, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmitJoinRequest = async () => {
    if (!orgPreview) return;
    setIsLoading(true);
    try {
      const token = localStorage.getItem('buddy_token');
      const res = await fetch(`/api/organizations/${orgPreview.id}/join-requests`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          inviteCode: joinCode.trim().toUpperCase(),
          message: joinMessage.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || '申请提交失败');
      }
      setStep('pending');
    } catch (err: any) {
      toast({ title: '申请失败', description: err.message, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(createdInviteCode).then(() => {
      setCopied(true);
      toast({ title: '已复制到剪贴板' });
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {
      toast({ title: '复制失败', variant: 'destructive' });
    });
  };

  const handleClaimProfile = async () => {
    if (!matchedProfile) return;
    setClaimLoading(true);
    try {
      const token = localStorage.getItem('buddy_token');
      const res = await fetch(`/api/member-profiles/${matchedProfile.id}/claim`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || '认领失败');
      }
      const data = await res.json();
      await refreshAuth();
      toast({ title: '档案认领成功', description: `已迁移 ${data.data?.migratedTasks || 0} 个待办任务` });
      setMatchedProfile(null);
      navigate('/');
    } catch (err: any) {
      toast({ title: '认领失败', description: err.message, variant: 'destructive' });
    } finally {
      setClaimLoading(false);
    }
  };

  const handleDismissClaim = () => {
    setMatchedProfile(null);
    navigate('/');
  };

  const handleEnterWorkspace = async () => {
    await refreshAuth();
    navigate('/');
  };

  const pageStyle: React.CSSProperties = {
    minHeight: '100%',
    background: 'var(--bg-sidebar)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    padding: '24px',
  };

  const containerStyle: React.CSSProperties = {
    width: '100%',
    maxWidth: 400,
  };

  if (step === 'welcome') {
    return (
      <div style={pageStyle} data-testid="onboarding-welcome">
        <div style={{ ...containerStyle, textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
            <AgentLogo size={64} animate={true} glow={true} />
          </div>
          <h1 style={{ color: 'white', fontSize: 24, fontWeight: 700, marginBottom: 8 }}>
            欢迎来到 Buddy
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 15, marginBottom: 40 }}>
            AI 驱动的团队协作空间
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }} className="max-[480px]:!grid-cols-1">
            <button
              onClick={() => setStep('create')}
              data-testid="card-create-org"
              {...tapMotionProps}
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 16,
                padding: '28px 16px',
                cursor: 'pointer',
                textAlign: 'center',
                transition: 'border-color 200ms, background 200ms',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = '#D4B896';
                e.currentTarget.style.background = 'rgba(212,184,150,0.06)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)';
                e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
              }}
            >
              <Building2 size={28} color="#D4B896" style={{ margin: '0 auto 12px' }} />
              <div style={{ color: 'white', fontSize: 15, fontWeight: 600, marginBottom: 6 }}>创建组织</div>
              <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13 }}>创建你的团队工作空间</div>
            </button>

            <button
              onClick={() => setStep('join')}
              data-testid="card-join-org"
              {...tapMotionProps}
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 16,
                padding: '28px 16px',
                cursor: 'pointer',
                textAlign: 'center',
                transition: 'border-color 200ms, background 200ms',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = '#D4B896';
                e.currentTarget.style.background = 'rgba(212,184,150,0.06)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)';
                e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
              }}
            >
              <Link2 size={28} color="#D4B896" style={{ margin: '0 auto 12px' }} />
              <div style={{ color: 'white', fontSize: 15, fontWeight: 600, marginBottom: 6 }}>加入组织</div>
              <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13 }}>通过邀请码加入已有团队</div>
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'create') {
    return (
      <div style={pageStyle} data-testid="onboarding-create">
        <BackButton onClick={() => setStep('welcome')} testId="button-back-create" />
        <div style={containerStyle}>
          <h1 style={{ color: 'white', fontSize: 22, fontWeight: 700, marginBottom: 32, textAlign: 'center' }}>
            创建你的组织
          </h1>
          <form onSubmit={handleCreateOrg} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ display: 'block', color: 'rgba(255,255,255,0.6)', fontSize: 13, marginBottom: 6, paddingLeft: 4 }}>
                组织名称 *
              </label>
              <input
                data-testid="input-org-name"
                type="text"
                placeholder="如 Deltapex Education"
                value={orgName}
                onChange={e => setOrgName(e.target.value)}
                disabled={isLoading}
                className={inputClass}
                autoFocus
              />
            </div>
            <div>
              <label style={{ display: 'block', color: 'rgba(255,255,255,0.6)', fontSize: 13, marginBottom: 6, paddingLeft: 4 }}>
                组织描述（可选）
              </label>
              <textarea
                data-testid="input-org-desc"
                placeholder="简单描述你的团队..."
                value={orgDesc}
                onChange={e => setOrgDesc(e.target.value)}
                disabled={isLoading}
                className={textareaClass}
                rows={3}
              />
            </div>
            <div style={{ marginTop: 8 }}>
              <PrimaryButton type="submit" disabled={isLoading || !orgName.trim()} testId="button-create-org">
                {isLoading ? (
                  <><Loader2 className="w-4 h-4 animate-spin" />创建中...</>
                ) : '创建组织'}
              </PrimaryButton>
            </div>
          </form>
        </div>
      </div>
    );
  }

  if (step === 'create-success') {
    return (
      <div style={pageStyle} data-testid="onboarding-create-success">
        <div style={{ ...containerStyle, textAlign: 'center' }}>
          <div style={{
            width: 56, height: 56, borderRadius: '50%',
            background: 'rgba(74,222,128,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 20px',
          }}>
            <CheckCircle2 size={28} color="#4ade80" />
          </div>
          <h1 style={{ color: 'white', fontSize: 22, fontWeight: 700, marginBottom: 8 }}>
            组织创建成功！
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, marginBottom: 28 }}>
            将邀请码分享给同事，他们注册后输入即可申请加入
          </p>

          <div style={{
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 16,
            padding: '24px 20px',
            marginBottom: 28,
          }}>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, marginBottom: 10 }}>你的邀请码</p>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
              <span
                data-testid="text-invite-code"
                style={{
                  fontFamily: 'monospace',
                  fontSize: 28,
                  fontWeight: 700,
                  color: '#D4B896',
                  letterSpacing: '0.08em',
                }}
              >
                {createdInviteCode}
              </span>
              <button
                onClick={handleCopyCode}
                data-testid="button-copy-code"
                {...tapMotionProps}
                style={{
                  width: 36, height: 36, borderRadius: '50%',
                  background: 'rgba(255,255,255,0.1)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                {copied ? <Check size={16} color="#4ade80" /> : <Copy size={16} color="rgba(255,255,255,0.6)" />}
              </button>
            </div>
          </div>

          <PrimaryButton onClick={handleEnterWorkspace} testId="button-enter-workspace">
            进入工作台
          </PrimaryButton>
        </div>
      </div>
    );
  }

  if (step === 'join') {
    return (
      <div style={pageStyle} data-testid="onboarding-join">
        <BackButton onClick={() => setStep('welcome')} testId="button-back-join" />
        <div style={containerStyle}>
          <h1 style={{ color: 'white', fontSize: 22, fontWeight: 700, marginBottom: 32, textAlign: 'center' }}>
            加入组织
          </h1>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ display: 'block', color: 'rgba(255,255,255,0.6)', fontSize: 13, marginBottom: 6, paddingLeft: 4 }}>
                邀请码
              </label>
              <input
                data-testid="input-invite-code"
                type="text"
                placeholder="输入邀请码，如 DPE-X4NM"
                value={joinCode}
                onChange={e => setJoinCode(e.target.value.toUpperCase())}
                disabled={isLoading}
                className={inputClass}
                autoFocus
                style={{ textTransform: 'uppercase' }}
              />
            </div>
            <div style={{ marginTop: 8 }}>
              <PrimaryButton onClick={handleSearchOrg} disabled={isLoading || !joinCode.trim()} testId="button-search-org">
                {isLoading ? (
                  <><Loader2 className="w-4 h-4 animate-spin" />搜索中...</>
                ) : '搜索'}
              </PrimaryButton>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'join-preview') {
    return (
      <div style={pageStyle} data-testid="onboarding-join-preview">
        <BackButton onClick={() => setStep('join')} testId="button-back-preview" />
        <div style={containerStyle}>
          <h1 style={{ color: 'white', fontSize: 22, fontWeight: 700, marginBottom: 24, textAlign: 'center' }}>
            确认加入
          </h1>

          <div style={{
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 16,
            padding: '24px 20px',
            marginBottom: 20,
          }}>
            <h2 data-testid="text-org-name" style={{ color: 'white', fontSize: 18, fontWeight: 600, marginBottom: 6 }}>
              {orgPreview?.name}
            </h2>
            {orgPreview?.description && (
              <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, marginBottom: 12, lineHeight: 1.5 }}>
                {orgPreview.description}
              </p>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'rgba(255,255,255,0.45)', fontSize: 13 }}>
              <Users size={14} />
              <span data-testid="text-member-count">{orgPreview?.memberCount ?? 0} 位成员</span>
            </div>
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', color: 'rgba(255,255,255,0.6)', fontSize: 13, marginBottom: 6, paddingLeft: 4 }}>
              申请留言（可选）
            </label>
            <textarea
              data-testid="input-join-message"
              placeholder="向管理员介绍一下你自己..."
              value={joinMessage}
              onChange={e => setJoinMessage(e.target.value)}
              disabled={isLoading}
              className={textareaClass}
              rows={3}
            />
          </div>

          <PrimaryButton onClick={handleSubmitJoinRequest} disabled={isLoading} testId="button-submit-join">
            {isLoading ? (
              <><Loader2 className="w-4 h-4 animate-spin" />提交中...</>
            ) : '申请加入'}
          </PrimaryButton>
        </div>
      </div>
    );
  }

  if (step === 'pending') {
    return (
      <div style={pageStyle} data-testid="onboarding-pending">
        <div style={{ ...containerStyle, textAlign: 'center' }}>
          <div style={{
            width: 56, height: 56, borderRadius: '50%',
            background: 'rgba(212,184,150,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 20px',
            animation: 'pulse 2s ease-in-out infinite',
          }}>
            <Clock size={28} color="#D4B896" />
          </div>
          <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }`}</style>
          <h1 style={{ color: 'white', fontSize: 22, fontWeight: 700, marginBottom: 8 }}>
            申请已提交
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, lineHeight: 1.6, marginBottom: 40 }}>
            请等待组织管理员审批<br />审批通过后将自动进入工作台
          </p>

          <button
            onClick={() => setStep('welcome')}
            data-testid="link-create-own"
            {...tapMotionProps}
            style={{
              background: 'none',
              border: 'none',
              color: 'rgba(255,255,255,0.4)',
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            或者 <span style={{ color: '#D4A27F', textDecoration: 'underline' }}>创建自己的组织</span>
          </button>
        </div>
      </div>
    );
  }

  if (step === 'complete') {
    if (matchedProfile) {
      const aliasesList = matchedProfile.aliases ? (() => { try { return JSON.parse(matchedProfile.aliases!); } catch { return []; } })() : [];
      return (
        <div style={pageStyle} data-testid="onboarding-claim">
          <div style={containerStyle}>
            <div style={{ textAlign: 'center', marginBottom: 28 }}>
              <div style={{
                width: 56, height: 56, borderRadius: '50%',
                background: 'rgba(212,184,150,0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 20px',
              }}>
                <UserCheck size={28} color="#D4B896" />
              </div>
              <h1 style={{ color: 'white', fontSize: 22, fontWeight: 700, marginBottom: 8 }}>
                发现匹配的档案
              </h1>
              <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14 }}>
                系统发现一份可能属于你的员工档案
              </p>
            </div>

            <div style={{
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 16,
              padding: '24px 20px',
              marginBottom: 24,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <div style={{
                  width: 44, height: 44, borderRadius: '50%',
                  background: 'rgba(212,184,150,0.2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <span style={{ fontSize: 18, fontWeight: 700, color: '#D4B896' }}>
                    {matchedProfile.fullName.charAt(0)}
                  </span>
                </div>
                <div>
                  <div data-testid="text-claim-name" style={{ color: 'white', fontSize: 17, fontWeight: 600 }}>
                    {matchedProfile.fullName}
                  </div>
                  {aliasesList.length > 0 && (
                    <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13, marginTop: 2 }}>
                      {aliasesList.join(' / ')}
                    </div>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {(deptName || roleName) && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Briefcase size={14} color="rgba(255,255,255,0.4)" />
                    <span data-testid="text-claim-dept-role" style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14 }}>
                      {[deptName, roleName].filter(Boolean).join(' · ')}
                    </span>
                  </div>
                )}
                {matchedProfile.title && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Users size={14} color="rgba(255,255,255,0.4)" />
                    <span data-testid="text-claim-title" style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14 }}>
                      {matchedProfile.title}
                    </span>
                  </div>
                )}
                {matchedProfile.pendingTaskCount > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <CheckCircle2 size={14} color="rgba(255,255,255,0.4)" />
                    <span data-testid="text-claim-task-count" style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14 }}>
                      {matchedProfile.pendingTaskCount} 个待办任务将分配给你
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <PrimaryButton onClick={handleClaimProfile} disabled={claimLoading} testId="button-claim-profile">
                {claimLoading ? (
                  <><Loader2 className="w-4 h-4 animate-spin" />认领中...</>
                ) : '是的，这是我'}
              </PrimaryButton>
              <SecondaryButton onClick={handleDismissClaim} testId="button-dismiss-claim">
                不是我
              </SecondaryButton>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div style={pageStyle} data-testid="onboarding-complete">
        <div style={{ ...containerStyle, textAlign: 'center' }}>
          <div style={{
            width: 56, height: 56, borderRadius: '50%',
            background: 'rgba(74,222,128,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 20px',
          }}>
            <CheckCircle2 size={28} color="#4ade80" />
          </div>
          <h1 style={{ color: 'white', fontSize: 22, fontWeight: 700, marginBottom: 8 }}>
            欢迎加入！
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, marginBottom: 32 }}>
            正在跳转到工作台...
          </p>
          <PrimaryButton onClick={() => navigate('/')} testId="button-enter-workspace-final">
            进入工作台
          </PrimaryButton>
        </div>
      </div>
    );
  }

  return null;
}
