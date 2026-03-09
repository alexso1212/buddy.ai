import { useState } from 'react';
import { useLocation } from 'wouter';
import { Loader2, ArrowLeft, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { tapMotionProps } from '@/hooks/use-tap-motion';

export default function ForgotPasswordPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast({ title: '请输入有效的邮箱地址', variant: 'destructive' });
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || '请求失败');
      }

      setSent(true);
    } catch (err: any) {
      toast({ title: '发送失败', description: err.message, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const inputClass = 'w-full h-12 px-4 text-[15px] bg-transparent border border-[rgba(255,255,255,0.15)] rounded-full outline-none focus:border-[rgba(255,255,255,0.4)] transition-colors text-white placeholder:text-[rgba(255,255,255,0.35)]';

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

      {sent ? (
        <div style={{ textAlign: 'center', maxWidth: 360 }}>
          <CheckCircle size={48} color="#D4B896" style={{ margin: '0 auto 16px' }} />
          <h2 style={{ color: 'white', fontSize: '20px', fontWeight: 600, marginBottom: 12 }}>
            邮件已发送
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px', lineHeight: 1.6, marginBottom: 24 }}>
            如果该邮箱已注册，您将收到一封包含密码重置链接的邮件。请检查您的收件箱（包括垃圾邮件文件夹）。
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
            返回登录
          </button>
        </div>
      ) : (
        <>
          <h2 style={{ color: 'white', fontSize: '20px', fontWeight: 600, marginBottom: 8 }}>
            重置密码
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px', marginBottom: 32, textAlign: 'center' }}>
            输入您的注册邮箱，我们将发送密码重置链接
          </p>

          <form onSubmit={handleSubmit} style={{ width: '100%', maxWidth: 360, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <input
              type="email"
              placeholder="邮箱地址"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoading}
              className={inputClass}
              autoFocus
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
                  发送中...
                </>
              ) : (
                '发送重置链接'
              )}
            </button>
          </form>
        </>
      )}
    </div>
  );
}
