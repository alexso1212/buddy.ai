import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Loader2 } from 'lucide-react';
import logoImg from '@assets/AD5CCB66-F553-4B90-AFBC-EEA51B534333_1771683834711.png';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';

export default function LoginPage() {
  const [, navigate] = useLocation();
  const { user, login } = useAuth();
  const { toast } = useToast();
  const [inviteCode, setInviteCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (user) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!inviteCode.trim()) {
      toast({
        title: '请输入邀请码',
        description: '邀请码不能为空',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);

    try {
      await login(inviteCode);
      toast({
        title: '登录成功',
        description: '正在跳转到工作台...',
      });
      navigate('/dashboard');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '登录失败，请检查邀请码';
      toast({
        title: '登录失败',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-[360px]">
        <div className="bg-card border border-border rounded-lg shadow-sm p-8">
          <div className="flex flex-col items-center mb-8">
            <img src={logoImg} alt="Deltapex" className="h-7 object-contain dark:invert mb-3" />
            <h1 className="text-base font-medium text-foreground">任务中心</h1>
            <p className="text-xs text-muted-foreground mt-1">团队任务看板</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              data-testid="input-invite-code"
              type="text"
              placeholder="请输入邀请码 (DP-XXXX-XXXX)"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              disabled={isLoading}
              className="w-full h-10 px-3 text-sm bg-background border border-border rounded-md outline-none focus:ring-2 focus:ring-ring/20 focus:border-foreground/30 transition-colors uppercase placeholder:text-muted-foreground placeholder:normal-case"
            />

            <button
              data-testid="button-login"
              type="submit"
              disabled={isLoading || !inviteCode.trim()}
              className="w-full h-10 bg-foreground text-background text-[13px] font-medium rounded-md hover:bg-foreground/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  登录中...
                </>
              ) : (
                '登录'
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
