import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Organization } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Building2, User, Lock, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function Settings() {
  const { user: authUser, updateUser } = useAuth();
  const { toast } = useToast();
  const { data: orgsData, isLoading } = useQuery<{ data: Organization[] }>({
    queryKey: ["/api/organizations"],
  });

  const org = orgsData?.data?.[0] ?? null;

  const [displayName, setDisplayName] = useState(authUser?.displayName || '');
  const [profileSaving, setProfileSaving] = useState(false);

  useEffect(() => {
    if (authUser?.displayName && !displayName) {
      setDisplayName(authUser.displayName);
    }
  }, [authUser?.displayName]);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);

  const handleProfileSave = async () => {
    if (!displayName.trim()) {
      toast({ title: '请输入显示名称', variant: 'destructive' });
      return;
    }
    setProfileSaving(true);
    try {
      const res = await apiRequest('PUT', '/api/auth/profile', { displayName: displayName.trim() });
      const data = await res.json();
      updateUser({ displayName: data.user.displayName });
      toast({ title: '资料已更新' });
    } catch (e: any) {
      toast({ title: '更新失败', description: e.message, variant: 'destructive' });
    } finally {
      setProfileSaving(false);
    }
  };

  const handlePasswordChange = async () => {
    if (!currentPassword) {
      toast({ title: '请输入当前密码', variant: 'destructive' });
      return;
    }
    if (newPassword.length < 8) {
      toast({ title: '新密码至少需要8个字符', variant: 'destructive' });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: '两次密码输入不一致', variant: 'destructive' });
      return;
    }
    setPasswordSaving(true);
    try {
      await apiRequest('PUT', '/api/auth/password', { currentPassword, newPassword });
      toast({ title: '密码修改成功' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (e: any) {
      toast({ title: '密码修改失败', description: e.message, variant: 'destructive' });
    } finally {
      setPasswordSaving(false);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <h1 className="text-xl md:text-2xl font-bold" data-testid="settings-title">系统设置</h1>

      <Card>
        <CardHeader className="flex flex-row items-center gap-2">
          <User className="w-5 h-5 text-muted-foreground" />
          <CardTitle>个人资料</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm text-muted-foreground block mb-1">邮箱</label>
            <input
              data-testid="input-profile-email"
              type="text"
              value={authUser?.email || ''}
              disabled
              className="w-full h-10 px-3 text-sm bg-muted border border-border rounded-md text-muted-foreground cursor-not-allowed"
            />
          </div>
          <div>
            <label className="text-sm text-muted-foreground block mb-1">显示名称</label>
            <input
              data-testid="input-profile-displayname"
              type="text"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              className="w-full h-10 px-3 text-sm bg-background border border-border rounded-md outline-none focus:ring-2 focus:ring-ring/20 focus:border-foreground/30 transition-colors"
            />
          </div>
          <Button
            data-testid="button-save-profile"
            onClick={handleProfileSave}
            disabled={profileSaving || displayName.trim() === authUser?.displayName}
          >
            {profileSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            保存修改
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center gap-2">
          <Lock className="w-5 h-5 text-muted-foreground" />
          <CardTitle>修改密码</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm text-muted-foreground block mb-1">当前密码</label>
            <input
              data-testid="input-current-password"
              type="password"
              value={currentPassword}
              onChange={e => setCurrentPassword(e.target.value)}
              className="w-full h-10 px-3 text-sm bg-background border border-border rounded-md outline-none focus:ring-2 focus:ring-ring/20 focus:border-foreground/30 transition-colors"
            />
          </div>
          <div>
            <label className="text-sm text-muted-foreground block mb-1">新密码</label>
            <input
              data-testid="input-new-password"
              type="password"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              placeholder="至少8个字符"
              className="w-full h-10 px-3 text-sm bg-background border border-border rounded-md outline-none focus:ring-2 focus:ring-ring/20 focus:border-foreground/30 transition-colors placeholder:text-muted-foreground"
            />
          </div>
          <div>
            <label className="text-sm text-muted-foreground block mb-1">确认新密码</label>
            <input
              data-testid="input-confirm-password"
              type="password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              className="w-full h-10 px-3 text-sm bg-background border border-border rounded-md outline-none focus:ring-2 focus:ring-ring/20 focus:border-foreground/30 transition-colors"
            />
          </div>
          <Button
            data-testid="button-change-password"
            onClick={handlePasswordChange}
            disabled={passwordSaving || !currentPassword || !newPassword || !confirmPassword}
          >
            {passwordSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            修改密码
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center gap-2">
          <Building2 className="w-5 h-5 text-muted-foreground" />
          <CardTitle>组织信息</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-5 w-72" />
              <Skeleton className="h-5 w-36" />
            </div>
          ) : org ? (
            <>
              <div>
                <div className="text-sm text-muted-foreground">组织名称</div>
                <h2 className="text-xl font-semibold" data-testid="org-name">{org.name}</h2>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">描述</div>
                <p data-testid="org-description">{org.description || "暂无描述"}</p>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">创建时间</div>
                <p>{new Date(org.createdAt).toLocaleDateString("zh-CN")}</p>
              </div>
            </>
          ) : (
            <p className="text-muted-foreground">未找到组织信息</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
