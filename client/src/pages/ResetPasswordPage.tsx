import { useState, useEffect } from 'react';
import { useLocation, useSearch } from 'wouter';
import { Loader2, ArrowLeft, CheckCircle, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { tapMotionProps } from '@/hooks/use-tap-motion';

export default function ResetPasswordPage() {
  const [, navigate] = useLocation();
  const searchString = useSearch();
  const { toast } = useToast();

  const [token, setToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [verifying, setVerifying] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [email, setEmail] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(searchString);
    const t = params.get('token');
    if (!t) {
      setVerifying(false);
      return;
    }
    setToken(t);

    fetch(`/api/auth/reset-password/${t}`)
      .then(async (res) => {
        if (res.ok) {
          const data = await res.json();
          setTokenValid(true);
          setEmail(data.email || '');
        }
      })
      .catch(() => {})
      .finally(() => setVerifying(false));
  }, [searchString]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword.length < 8) {
      toast({ title: '密码至少需要8个字符', variant: 'destructive' });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: '两次输入的密码不一致', variant: 'destructive' });
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || '重置失败');
      }

      setDone(true);
    } catch (err: any) {
      toast({ title: '重置失败', description: err.message, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const inputClass = 'w-full h-12 px-4 text-[15px] bg-transparent border border-[rgba(255,255,255,0.15)] rounded-full outline-none focus:border-[rgba(255,255,255,0.4)] transition-colors text-white placeholder:text-[rgba(255,255,255,0.35)]';

  if (verifying) {
    return (
      <div style={{ minHeight: '100dvh', background: 'var(--bg-sidebar)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: '#D4B896' }} />
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: '100dvh',
        background: 'var(--bg-sidebar)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0 24px',
      }}
    >
      <div style={{ position: 'absolute', top: 16, left: 16 }}>
        <button
          onClick={() => navigate('/login')}
          {...tapMotionProps}
          style={{
            width: 36,
            height: 36,
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.1)',
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <ArrowLeft size={18} color="rgba(255,255,255,0.6)" />
        </button>
      </div>

      {done ? (
        <div style={{ textAlign: 'center', maxWidth: 360 }}>
          <CheckCircle size={48} color="#D4B896" style={{ margin: '0 auto 16px' }} />
          <h2 style={{ color: 'white', fontSize: '20px', fontWeight: 600, marginBottom: 12 }}>
            密码已重置
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px', marginBottom: 24 }}>
            请使用新密码登录您的账号
          </p>
          <button
            onClick={() => navigate('/login')}
            {...tapMotionProps}
            style={{
              height: 44,
              borderRadius: 9999,
              background: '#D4B896',
              color: '#1E1D1A',
              fontSize: '14px',
              fontWeight: 600,
              border: 'none',
              cursor: 'pointer',
              padding: '0 32px',
            }}
          >
            前往登录
          </button>
        </div>
      ) : !tokenValid ? (
        <div style={{ textAlign: 'center', maxWidth: 360 }}>
          <AlertCircle size={48} color="#ef4444" style={{ margin: '0 auto 16px' }} />
          <h2 style={{ color: 'white', fontSize: '20px', fontWeight: 600, marginBottom: 12 }}>
            链接无效
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px', marginBottom: 24 }}>
            此密码重置链接已过期或无效，请重新申请
          </p>
          <button
            onClick={() => navigate('/forgot-password')}
            {...tapMotionProps}
            style={{
              height: 44,
              borderRadius: 9999,
              background: '#D4B896',
              color: '#1E1D1A',
              fontSize: '14px',
              fontWeight: 600,
              border: 'none',
              cursor: 'pointer',
              padding: '0 32px',
            }}
          >
            重新申请
          </button>
        </div>
      ) : (
        <>
          <h2 style={{ color: 'white', fontSize: '20px', fontWeight: 600, marginBottom: 8 }}>
            设置新密码
          </h2>
          {email && (
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px', marginBottom: 24 }}>
              {email}
            </p>
          )}

          <form onSubmit={handleSubmit} style={{ width: '100%', maxWidth: 360, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <input
              type="password"
              placeholder="新密码（至少8个字符）"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              disabled={isLoading}
              className={inputClass}
              autoFocus
            />
            <input
              type="password"
              placeholder="确认新密码"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={isLoading}
              className={inputClass}
            />

            <button
              type="submit"
              disabled={isLoading}
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
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                marginTop: 4,
                opacity: isLoading ? 0.5 : 1,
              }}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  重置中...
                </>
              ) : (
                '重置密码'
              )}
            </button>
          </form>
        </>
      )}
    </div>
  );
}
