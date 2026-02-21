import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { ClipboardList, Loader2 } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

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
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-primary/3 rounded-full blur-3xl"></div>
      </div>

      <Card className="w-full max-w-sm relative z-10">
        <CardHeader className="space-y-2 text-center">
          <div className="flex justify-center mb-2">
            <div className="p-3 rounded-lg bg-primary/10">
              <ClipboardList className="w-6 h-6 text-primary" />
            </div>
          </div>
          <CardTitle className="text-3xl font-bold">德湃任务中心</CardTitle>
          <CardDescription className="text-base">团队任务看板</CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Input
                data-testid="input-invite-code"
                type="text"
                placeholder="请输入邀请码 (DP-XXXX-XXXX)"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                disabled={isLoading}
                className="uppercase"
              />
            </div>

            <Button
              data-testid="button-login"
              type="submit"
              className="w-full"
              disabled={isLoading || !inviteCode.trim()}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  登录中...
                </>
              ) : (
                '登录'
              )}
            </Button>
          </form>
        </CardContent>

        <div className="px-6 py-4 text-center text-xs text-muted-foreground border-t border-card-border">
          © 2026 德湃教育科技
        </div>
      </Card>
    </div>
  );
}
