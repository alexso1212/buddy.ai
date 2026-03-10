import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, useSearch } from 'wouter';
import { Loader2, X } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { tapMotionProps } from '@/hooks/use-tap-motion';

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}

declare global {
  interface Window {
    onTelegramAuth?: (user: any) => void;
  }
}

function TelegramLoginIcon({ onAuth }: { onAuth: (user: any) => void }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    window.onTelegramAuth = onAuth;

    const script = document.createElement('script');
    script.src = 'https://telegram.org/js/telegram-widget.js?22';
    script.setAttribute('data-telegram-login', import.meta.env.VITE_TELEGRAM_BOT_USERNAME || 'Deltapex_Alex_Bot');
    script.setAttribute('data-size', 'small');
    script.setAttribute('data-radius', '20');
    script.setAttribute('data-request-access', 'write');
    script.setAttribute('data-onauth', 'onTelegramAuth(user)');
    script.async = true;
    container.appendChild(script);

    return () => {
      delete window.onTelegramAuth;
      if (container.contains(script)) {
        container.removeChild(script);
      }
    };
  }, [onAuth]);

  return <div ref={containerRef} />;
}

const SLOGANS = [
  '一起协作',
  '智能管理',
  '高效执行',
  '团队赋能',
  '创造价值',
];

function TypingSlogan() {
  const [displayText, setDisplayText] = useState('');
  const [sloganIndex, setSloganIndex] = useState(0);
  const [charIndex, setCharIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showCursor, setShowCursor] = useState(true);

  useEffect(() => {
    const cursorInterval = setInterval(() => {
      setShowCursor(prev => !prev);
    }, 530);
    return () => clearInterval(cursorInterval);
  }, []);

  useEffect(() => {
    const currentSlogan = SLOGANS[sloganIndex];

    if (!isDeleting && charIndex <= currentSlogan.length) {
      const timeout = setTimeout(() => {
        const newText = currentSlogan.slice(0, charIndex);
        setDisplayText(newText);

        if (charIndex > 0 && charIndex <= currentSlogan.length) {
          try {
            if (navigator.vibrate) {
              navigator.vibrate(8);
            }
          } catch {}
        }

        if (charIndex === currentSlogan.length) {
          setTimeout(() => setIsDeleting(true), 2000);
        } else {
          setCharIndex(prev => prev + 1);
        }
      }, 120);
      return () => clearTimeout(timeout);
    }

    if (isDeleting && charIndex >= 0) {
      const timeout = setTimeout(() => {
        setDisplayText(currentSlogan.slice(0, charIndex));
        if (charIndex === 0) {
          setIsDeleting(false);
          setSloganIndex(prev => (prev + 1) % SLOGANS.length);
        } else {
          setCharIndex(prev => prev - 1);
        }
      }, 60);
      return () => clearTimeout(timeout);
    }
  }, [charIndex, isDeleting, sloganIndex]);

  return (
    <div className="flex items-center justify-center gap-0" data-testid="typing-slogan">
      <span
        style={{
          fontSize: '28px',
          fontWeight: 600,
          color: '#F0B8C8',
          letterSpacing: '0.02em',
        }}
      >
        {displayText}
      </span>
      <span
        style={{
          display: 'inline-block',
          width: '3px',
          height: '32px',
          background: '#D4829A',
          marginLeft: '2px',
          opacity: showCursor ? 1 : 0,
          transition: 'opacity 0.1s',
          borderRadius: '2px',
        }}
      />
    </div>
  );
}

function BuddyLogo() {
  return (
    <div
      style={{
        width: 32,
        height: 32,
        borderRadius: '50%',
        background: '#E8A0B5',
      }}
      data-testid="buddy-logo"
    />
  );
}

export default function LoginPage() {
  const [, navigate] = useLocation();
  const searchString = useSearch();
  const { login, loginWithToken, register } = useAuth();
  const { toast } = useToast();

  const [view, setView] = useState<'main' | 'login' | 'register'>('main');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const authCheckRef = useRef(false);

  const tryAutoLogin = useCallback(async () => {
    if (authCheckRef.current) return;
    const token = localStorage.getItem('buddy_token');
    if (!token) return;
    authCheckRef.current = true;
    try {
      await loginWithToken(token);
      navigate('/agent');
    } catch {
      authCheckRef.current = false;
    }
  }, [loginWithToken, navigate]);

  useEffect(() => {
    const params = new URLSearchParams(searchString);
    const token = params.get('token');
    const error = params.get('error');

    if (error === 'auth_failed') {
      toast({ title: '登录失败', description: '第三方认证失败，请重试', variant: 'destructive' });
      window.history.replaceState({}, '', '/login');
      return;
    }

    if (params.get('verified') === 'true') {
      toast({ title: '邮箱验证成功', description: '请使用您的账号登录' });
      window.history.replaceState({}, '', '/login');
      setView('login');
      return;
    }

    if (token) {
      window.history.replaceState({}, '', '/login');
      loginWithToken(token)
        .then(() => {
          toast({ title: '登录成功', description: '正在跳转...' });
          navigate('/agent');
        })
        .catch(() => {
          toast({ title: '登录失败', description: '令牌验证失败', variant: 'destructive' });
        });
      return;
    }

    tryAutoLogin();
  }, []);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        tryAutoLogin();
      }
    };
    const onFocus = () => tryAutoLogin();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onFocus);
    const interval = setInterval(tryAutoLogin, 2000);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onFocus);
      clearInterval(interval);
    };
  }, [tryAutoLogin]);

  const handleTelegramAuth = useCallback(async (telegramUser: any) => {
    try {
      const res = await fetch('/api/auth/telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(telegramUser),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Telegram login failed');
      }
      const data = await res.json();
      await loginWithToken(data.token);
      toast({ title: '登录成功', description: '正在跳转...' });
      navigate('/agent');
    } catch (err: any) {
      toast({ title: '登录失败', description: err.message || 'Telegram 认证失败', variant: 'destructive' });
    }
  }, [loginWithToken, navigate, toast]);

  const handleGoogleLogin = () => {
    localStorage.removeItem('buddy_token');
    localStorage.removeItem('buddy_user');
    authCheckRef.current = false;
    window.location.href = '/api/auth/google';
  };

  const handleAppleLogin = () => {
    window.location.href = '/api/login';
  };

  const handleGithubLogin = () => {
    window.location.href = '/api/login';
  };

  const validateEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateEmail(email)) {
      toast({ title: '邮箱格式不正确', variant: 'destructive' });
      return;
    }

    if (password.length < 8) {
      toast({ title: '密码至少需要8个字符', variant: 'destructive' });
      return;
    }

    if (view === 'register') {
      if (!displayName.trim()) {
        toast({ title: '请输入显示名称', variant: 'destructive' });
        return;
      }
      if (password !== confirmPassword) {
        toast({ title: '两次输入的密码不一致', variant: 'destructive' });
        return;
      }
    }

    setIsLoading(true);

    try {
      if (view === 'login') {
        await login(email, password);
        toast({ title: '登录成功', description: '正在跳转...' });
      } else {
        await register(email, password, displayName);
        toast({ title: '注册成功', description: '正在跳转...' });
      }
      navigate('/agent');
    } catch (error) {
      const msg = error instanceof Error ? error.message : '操作失败';
      toast({ title: view === 'login' ? '登录失败' : '注册失败', description: msg, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const inputClass = 'w-full h-12 px-4 text-[15px] bg-transparent border border-[rgba(255,255,255,0.15)] rounded-full outline-none focus:border-[rgba(255,255,255,0.4)] transition-colors text-white placeholder:text-[rgba(255,255,255,0.35)]';

  if (view === 'login' || view === 'register') {
    return (
      <div
        style={{
          minHeight: '100%',
          background: 'var(--bg-sidebar)',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
        }}
      >
        <div style={{ position: 'absolute', top: 16, right: 16, zIndex: 10 }}>
          <button
            onClick={() => setView('main')}
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
            data-testid="button-back"
            {...tapMotionProps}
          >
            <X size={18} color="rgba(255,255,255,0.6)" />
          </button>
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 24px' }}>
          <BuddyLogo />
          <h2 style={{ color: 'white', fontSize: '20px', fontWeight: 600, marginTop: 16, marginBottom: 32 }}>
            {view === 'login' ? '欢迎回来' : '创建账户'}
          </h2>

          <form onSubmit={handleSubmit} style={{ width: '100%', maxWidth: 360, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {view === 'register' && (
              <input
                data-testid="input-display-name"
                type="text"
                placeholder="显示名称"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                disabled={isLoading}
                className={inputClass}
              />
            )}

            <input
              data-testid="input-email"
              type="email"
              placeholder="邮箱地址"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoading}
              className={inputClass}
            />

            <input
              data-testid="input-password"
              type="password"
              placeholder="密码"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
              className={inputClass}
            />

            {view === 'register' && (
              <input
                data-testid="input-confirm-password"
                type="password"
                placeholder="确认密码"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={isLoading}
                className={inputClass}
              />
            )}

            <button
              data-testid="button-submit"
              type="submit"
              disabled={isLoading}
              {...tapMotionProps}
              style={{
                width: '100%',
                height: 48,
                borderRadius: 9999,
                background: '#E8A0B5',
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
                  {view === 'login' ? '登录中...' : '注册中...'}
                </>
              ) : (
                view === 'login' ? '登录' : '注册'
              )}
            </button>
          </form>

          {view === 'login' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
              <button
                onClick={() => navigate('/forgot-password')}
                style={{
                  marginTop: 16,
                  background: 'none',
                  border: 'none',
                  color: 'rgba(255,255,255,0.4)',
                  fontSize: '12px',
                  cursor: 'pointer',
                }}
                data-testid="link-forgot-password"
                {...tapMotionProps}
              >
                忘记密码？
              </button>
              <button
                onClick={() => setView('register')}
                style={{
                  marginTop: 4,
                  background: 'none',
                  border: 'none',
                  color: 'rgba(255,255,255,0.5)',
                  fontSize: '13px',
                  cursor: 'pointer',
                }}
                data-testid="link-to-register"
                {...tapMotionProps}
              >
                没有账户？<span style={{ color: '#D4829A', textDecoration: 'underline' }}>注册</span>
              </button>
            </div>
          )}
          {view === 'register' && (
            <button
              onClick={() => setView('login')}
              style={{
                marginTop: 20,
                background: 'none',
                border: 'none',
                color: 'rgba(255,255,255,0.5)',
                fontSize: '13px',
                cursor: 'pointer',
              }}
              data-testid="link-to-login"
              {...tapMotionProps}
            >
              已有账户？<span style={{ color: '#D4829A', textDecoration: 'underline' }}>登录</span>
            </button>
          )}
        </div>
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
        position: 'relative',
      }}
    >
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          paddingBottom: '30vh',
        }}
      >
        <div style={{ marginBottom: 24 }}>
          <BuddyLogo />
        </div>
        <TypingSlogan />
      </div>

      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          padding: '0 20px',
          paddingBottom: 'calc(20px + env(safe-area-inset-bottom))',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 10,
          background: 'linear-gradient(to top, var(--bg-sidebar) 60%, transparent 100%)',
          paddingTop: 40,
        }}
      >
        <div style={{ width: '100%', maxWidth: 360, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button
            onClick={handleAppleLogin}
            data-testid="button-apple-login"
            {...tapMotionProps}
            style={{
              width: '100%',
              height: 50,
              borderRadius: 9999,
              background: '#E8A0B5',
              color: '#1E1D1A',
              fontSize: '15px',
              fontWeight: 600,
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="#1E1D1A">
              <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
            </svg>
            通过 Apple 继续
          </button>

          <button
            onClick={handleGoogleLogin}
            data-testid="button-google-login"
            {...tapMotionProps}
            style={{
              width: '100%',
              height: 50,
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
              gap: 10,
            }}
          >
            <GoogleIcon />
            继续使用 Google 登录
          </button>

          <button
            onClick={() => setView('register')}
            data-testid="button-register"
            {...tapMotionProps}
            style={{
              width: '100%',
              height: 50,
              borderRadius: 9999,
              background: '#1a1a1a',
              color: 'white',
              fontSize: '15px',
              fontWeight: 500,
              border: '1px solid rgba(255,255,255,0.15)',
              cursor: 'pointer',
            }}
          >
            注册
          </button>

          <button
            onClick={() => setView('login')}
            data-testid="button-login"
            {...tapMotionProps}
            style={{
              width: '100%',
              height: 50,
              borderRadius: 9999,
              background: 'transparent',
              color: 'white',
              fontSize: '15px',
              fontWeight: 500,
              border: 'none',
              cursor: 'pointer',
            }}
          >
            登录
          </button>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, marginTop: 4 }}>
            <button
              onClick={handleGithubLogin}
              data-testid="button-github-login"
              title="GitHub"
              {...tapMotionProps}
              style={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.12)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
                <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2z" />
              </svg>
            </button>
            <div data-testid="telegram-login-container" style={{ display: 'flex', alignItems: 'center' }}>
              <TelegramLoginIcon onAuth={handleTelegramAuth} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
