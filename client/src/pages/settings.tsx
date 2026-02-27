import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Organization } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Building2, User, Lock, Loader2, UserPlus, Plus, Copy, Trash2, BarChart3 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

function formatTokenCount(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return n.toString();
}

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

  const [tokenPeriod, setTokenPeriod] = useState('30d');
  const { data: tokenStatsData, isLoading: tokenStatsLoading } = useQuery<{ data: any }>({
    queryKey: [`/api/token-usage/stats?period=${tokenPeriod}`],
  });
  const tokenStats = tokenStatsData?.data;

  const { data: balanceData } = useQuery<{ data: any }>({
    queryKey: ['/api/token-usage/balance'],
  });
  const balance = balanceData?.data;

  const [budgetInput, setBudgetInput] = useState('');
  const [budgetSaving, setBudgetSaving] = useState(false);

  useEffect(() => {
    if (balance?.budgetUsd !== undefined && balance?.budgetUsd !== null) {
      setBudgetInput(String(balance.budgetUsd));
    }
  }, [balance?.budgetUsd]);

  const handleSaveBudget = async () => {
    setBudgetSaving(true);
    try {
      const value = budgetInput.trim() === '' ? null : parseFloat(budgetInput);
      await apiRequest('PATCH', '/api/organization/budget', { tokenBudgetUsd: value });
      queryClient.invalidateQueries({ queryKey: ['/api/token-usage/balance'] });
      toast({ title: '额度已更新' });
    } catch (e: any) {
      toast({ title: '更新失败', description: e.message, variant: 'destructive' });
    } finally {
      setBudgetSaving(false);
    }
  };

  const [inviteRole, setInviteRole] = useState('member');
  const [inviteCreating, setInviteCreating] = useState(false);

  const { data: invitationsData, isLoading: invitationsLoading } = useQuery<{ data: any[] }>({
    queryKey: ['/api/invitations'],
  });
  const invitations = invitationsData?.data || [];

  const handleCreateInvite = async () => {
    setInviteCreating(true);
    try {
      await apiRequest('POST', '/api/invitations', { role: inviteRole });
      queryClient.invalidateQueries({ queryKey: ['/api/invitations'] });
      toast({ title: '邀请链接已生成' });
    } catch (e: any) {
      toast({ title: '生成失败', description: e.message, variant: 'destructive' });
    } finally {
      setInviteCreating(false);
    }
  };

  const handleDeactivateInvite = async (id: number) => {
    try {
      await apiRequest('DELETE', `/api/invitations/${id}`);
      queryClient.invalidateQueries({ queryKey: ['/api/invitations'] });
      toast({ title: '邀请已停用' });
    } catch (e: any) {
      toast({ title: '操作失败', description: e.message, variant: 'destructive' });
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

      <Card>
        <CardHeader className="flex flex-row items-center gap-2">
          <BarChart3 className="w-5 h-5 text-muted-foreground" />
          <CardTitle className="flex-1">AI 用量统计</CardTitle>
          <div className="flex gap-1">
            {(['7d', '30d', '90d'] as const).map(p => (
              <button
                key={p}
                onClick={() => setTokenPeriod(p)}
                className={`px-2 py-1 text-xs rounded-md transition-colors ${
                  tokenPeriod === p
                    ? 'bg-foreground/10 text-foreground font-medium'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                data-testid={`button-period-${p}`}
              >
                {p === '7d' ? '7天' : p === '30d' ? '30天' : '90天'}
              </button>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          {tokenStatsLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : tokenStats ? (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 rounded-lg bg-muted/50 text-center">
                  <div className="text-lg font-semibold" data-testid="text-total-tokens">
                    {formatTokenCount(tokenStats.totalTokens)}
                  </div>
                  <div className="text-xs text-muted-foreground">总 Tokens</div>
                </div>
                <div className="p-3 rounded-lg bg-muted/50 text-center">
                  <div className="text-lg font-semibold" data-testid="text-prompt-tokens">
                    {formatTokenCount(tokenStats.totalPromptTokens)}
                  </div>
                  <div className="text-xs text-muted-foreground">输入</div>
                </div>
                <div className="p-3 rounded-lg bg-muted/50 text-center">
                  <div className="text-lg font-semibold" data-testid="text-completion-tokens">
                    {formatTokenCount(tokenStats.totalCompletionTokens)}
                  </div>
                  <div className="text-xs text-muted-foreground">输出</div>
                </div>
              </div>
              <div className="text-sm text-muted-foreground text-right" data-testid="text-total-cost">
                预估费用: ${parseFloat(tokenStats.totalCostUsd || '0').toFixed(4)}
              </div>
              {tokenStats.byPurpose && Object.keys(tokenStats.byPurpose).length > 0 && (
                <div className="space-y-2">
                  <div className="text-sm font-medium text-muted-foreground">按用途</div>
                  {Object.entries(tokenStats.byPurpose).map(([purpose, data]: [string, any]) => (
                    <div key={purpose} className="flex items-center justify-between text-sm py-1 border-b border-border/50 last:border-0">
                      <span className="text-foreground capitalize">{purpose.replace(/_/g, ' ')}</span>
                      <span className="text-muted-foreground">{formatTokenCount(data.tokens)} tokens</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">暂无使用数据</p>
          )}
        </CardContent>
      </Card>

      {(authUser?.role === 'owner' || authUser?.role === 'admin') && (
        <Card>
          <CardHeader className="flex flex-row items-center gap-2">
            <BarChart3 className="w-5 h-5 text-muted-foreground" />
            <CardTitle>月度额度</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {balance && balance.budgetUsd !== null ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">本月已用</span>
                  <span className="font-medium" data-testid="text-budget-used">
                    ${balance.usedUsd.toFixed(4)} / ${balance.budgetUsd.toFixed(2)}
                  </span>
                </div>
                <div className="w-full h-2.5 rounded-full bg-muted overflow-hidden" data-testid="budget-progress-bar">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min(100, balance.percentUsed || 0)}%`,
                      background: (balance.percentUsed || 0) > 80
                        ? ((balance.percentUsed || 0) > 95 ? '#ef4444' : '#f59e0b')
                        : 'var(--brand)',
                    }}
                  />
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>剩余 ${balance.remainingUsd?.toFixed(4)}</span>
                  <span>{(balance.percentUsed || 0).toFixed(1)}% 已用</span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">未设置月度额度</p>
            )}
            <div className="pt-2 border-t border-border/50 space-y-2">
              <label className="text-sm text-muted-foreground block">月度预算 (USD)</label>
              <div className="flex items-center gap-2">
                <input
                  data-testid="input-budget"
                  type="number"
                  step="0.01"
                  min="0"
                  value={budgetInput}
                  onChange={e => setBudgetInput(e.target.value)}
                  placeholder="例如 10.00"
                  className="flex-1 px-3 py-2 text-sm rounded-md border border-border bg-background"
                />
                <Button
                  size="sm"
                  onClick={handleSaveBudget}
                  disabled={budgetSaving}
                  data-testid="btn-save-budget"
                >
                  {budgetSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : '保存'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {(authUser?.role === 'owner' || authUser?.role === 'admin') && (
        <Card>
          <CardHeader className="flex flex-row items-center gap-2">
            <UserPlus className="w-5 h-5 text-muted-foreground" />
            <CardTitle>邀请成员</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Generate invite section */}
            <div className="flex items-center gap-2">
              <select 
                value={inviteRole}
                onChange={e => setInviteRole(e.target.value)}
                className="h-10 px-3 text-sm bg-background border border-border rounded-md outline-none"
                data-testid="select-invite-role"
              >
                <option value="member">成员</option>
                <option value="head">主管</option>
                <option value="admin">管理员</option>
              </select>
              <Button onClick={handleCreateInvite} disabled={inviteCreating} data-testid="button-create-invite">
                {inviteCreating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                生成邀请链接
              </Button>
            </div>

            {/* Active invitations list */}
            {invitationsLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : invitations.length === 0 ? (
              <p className="text-sm text-muted-foreground">暂无活跃的邀请链接</p>
            ) : (
              <div className="space-y-2">
                {invitations.map((inv: any) => (
                  <div key={inv.id} className="flex items-center gap-3 p-3 rounded-lg border border-border bg-muted/30" data-testid={`invitation-${inv.id}`}>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-mono text-foreground truncate" data-testid={`invite-code-${inv.id}`}>
                        {inv.inviteCode}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {inv.role === 'admin' ? '管理员' : inv.role === 'head' ? '主管' : '成员'}
                        {inv.maxUses ? ` · ${inv.usedCount}/${inv.maxUses} 已使用` : ` · ${inv.usedCount} 已使用`}
                        {inv.expiresAt ? ` · ${new Date(inv.expiresAt) < new Date() ? '已过期' : `${new Date(inv.expiresAt).toLocaleDateString('zh-CN')} 过期`}` : ''}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        navigator.clipboard.writeText(inv.inviteCode);
                        toast({ title: '邀请码已复制' });
                      }}
                      data-testid={`button-copy-invite-${inv.id}`}
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeactivateInvite(inv.id)}
                      data-testid={`button-deactivate-invite-${inv.id}`}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
