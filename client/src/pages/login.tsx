import { useState } from 'react';
import { useLocation } from 'wouter';
import { Loader2 } from 'lucide-react';
import logoImg from '@assets/AD5CCB66-F553-4B90-AFBC-EEA51B534333_1771683834711.png';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';

export default function LoginPage() {
  const [, navigate] = useLocation();
  const { login, register } = useAuth();
  const { toast } = useToast();

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [isLoading, setIsLoading] = useState(false);

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

    if (mode === 'register') {
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
      if (mode === 'login') {
        await login(email, password);
        toast({ title: '登录成功', description: '正在跳转...' });
      } else {
        await register(email, password, displayName);
        toast({ title: '注册成功', description: '正在跳转...' });
      }
      navigate('/agent');
    } catch (error) {
      const msg = error instanceof Error ? error.message : '操作失败';
      toast({ title: mode === 'login' ? '登录失败' : '注册失败', description: msg, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const inputClass = 'w-full h-10 px-3 text-sm bg-background border border-border rounded-md outline-none focus:ring-2 focus:ring-ring/20 focus:border-foreground/30 transition-colors';

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-[360px]">
        <div className="bg-card border border-border rounded-lg shadow-sm p-8">
          <div className="flex flex-col items-center mb-8">
            <img src={logoImg} alt="Deltapex" className="h-7 object-contain dark:invert mb-3" />
            <h1 className="text-base font-medium text-foreground" data-testid="text-title">任务中心</h1>
            <p className="text-xs text-muted-foreground mt-1">团队任务看板</p>
          </div>

          <div className="flex mb-6" data-testid="auth-tabs">
            <button
              type="button"
              onClick={() => setMode('login')}
              className={`flex-1 pb-2 text-sm font-medium border-b-2 transition-colors ${
                mode === 'login'
                  ? 'border-foreground text-foreground'
                  : 'border-transparent text-muted-foreground'
              }`}
              data-testid="tab-login"
            >
              登录
            </button>
            <button
              type="button"
              onClick={() => setMode('register')}
              className={`flex-1 pb-2 text-sm font-medium border-b-2 transition-colors ${
                mode === 'register'
                  ? 'border-foreground text-foreground'
                  : 'border-transparent text-muted-foreground'
              }`}
              data-testid="tab-register"
            >
              注册
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
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

            {mode === 'register' && (
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
              className="w-full h-10 bg-foreground text-background text-[13px] font-medium rounded-md hover:bg-foreground/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {mode === 'login' ? '登录中...' : '注册中...'}
                </>
              ) : (
                mode === 'login' ? '登录' : '注册'
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-[11px] text-muted-foreground mt-6">
          © 2026 Buddy
        </p>
      </div>
    </div>
  );
}
