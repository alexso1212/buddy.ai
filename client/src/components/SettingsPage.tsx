import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useTheme } from "@/components/ThemeProvider";
import { useAuth } from "@/lib/auth";
import {
  X, ArrowLeft, User, CreditCard, Building2, Users,
  Moon, Globe, Bell, Lock, Info, LogOut, ChevronRight,
  Loader2, Copy, Trash2, Plus, Sun, Monitor,
  Shield, FileText, HelpCircle, Mail, Settings2,
  Blocks, Link2, Smartphone, ExternalLink,
  MessageSquare, Phone, Send,
  CheckSquare, FolderKanban, UserCog,
  Bot, Zap, BarChart3, GitBranch,
} from "lucide-react";
import type { Organization } from "@shared/schema";

type PageId = 'main' | 'profile' | 'organization' | 'capabilities' | 'connectors' | 'permissions' | 'notifications' | 'privacy' | 'about' | 'shared-links';

interface SettingsPageProps {
  open: boolean;
  onClose: () => void;
  onOpenOrgSwitcher: () => void;
  onCloseSidebar: () => void;
}

function useIOSBounceScroll(scrollRef: React.RefObject<HTMLDivElement | null>) {
  const touchStartY = useRef(0);
  const pulling = useRef(false);
  const pullDir = useRef<'top' | 'bottom' | null>(null);
  const currentPull = useRef(0);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const getContentEl = () => el.firstElementChild as HTMLElement | null;

    const onTouchStart = (e: TouchEvent) => {
      touchStartY.current = e.touches[0].clientY;
      pulling.current = false;
      pullDir.current = null;
      currentPull.current = 0;
      const content = getContentEl();
      if (content) {
        content.style.transition = 'none';
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      const content = getContentEl();
      if (!content) return;

      const touchY = e.touches[0].clientY;
      const delta = touchY - touchStartY.current;
      const atTop = el.scrollTop <= 0;
      const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 1;

      if (atTop && delta > 0) {
        if (!pulling.current) {
          pulling.current = true;
          pullDir.current = 'top';
          touchStartY.current = touchY;
        }
        if (pullDir.current === 'top') {
          const rawDelta = touchY - touchStartY.current;
          const dampened = rawDelta * 0.4;
          currentPull.current = dampened;
          content.style.transform = `translateY(${dampened}px)`;
          e.preventDefault();
        }
      } else if (atBottom && delta < 0) {
        if (!pulling.current) {
          pulling.current = true;
          pullDir.current = 'bottom';
          touchStartY.current = touchY;
        }
        if (pullDir.current === 'bottom') {
          const rawDelta = touchY - touchStartY.current;
          const dampened = rawDelta * 0.4;
          currentPull.current = dampened;
          content.style.transform = `translateY(${dampened}px)`;
          e.preventDefault();
        }
      } else if (!pulling.current) {
        pullDir.current = null;
      }
    };

    const onTouchEnd = () => {
      const content = getContentEl();
      if (!content) return;

      if (pulling.current && currentPull.current !== 0) {
        content.style.transition = 'transform 300ms cubic-bezier(0.32, 0.72, 0, 1)';
        content.style.transform = 'translateY(0)';
      }
      pulling.current = false;
      pullDir.current = null;
      currentPull.current = 0;
    };

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd, { passive: true });

    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
    };
  }, [scrollRef]);
}

const scrollStyle: React.CSSProperties = {
  overflowY: 'auto',
  overflowX: 'hidden',
  WebkitOverflowScrolling: 'touch' as any,
  overscrollBehavior: 'none',
};

function BounceScroll({ children, style, className }: { children: React.ReactNode; style?: React.CSSProperties; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useIOSBounceScroll(ref);
  return (
    <div ref={ref} style={{ ...scrollStyle, ...style }} className={className}>
      <div>{children}</div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  height: 44,
  padding: '0 14px',
  fontSize: 15,
  color: '#ECECEC',
  background: 'transparent',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 12,
  outline: 'none',
  fontFamily: 'inherit',
};

const sectionLabelStyle: React.CSSProperties = {
  fontSize: 13,
  color: '#7A7874',
  display: 'block',
  marginBottom: 6,
  paddingLeft: 2,
};

function SettingsItem({
  icon: Icon,
  label,
  value,
  onClick,
  rightElement,
  destructive,
  testId,
}: {
  icon: typeof User;
  label: string;
  value?: string;
  onClick?: () => void;
  rightElement?: React.ReactNode;
  destructive?: boolean;
  testId?: string;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        height: 52,
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '0 16px',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'background 150ms',
      }}
      onMouseEnter={e => { if (onClick) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
      data-testid={testId}
    >
      <Icon size={20} color={destructive ? '#E5534B' : '#9A9893'} strokeWidth={1.8} />
      <span style={{
        flex: 1,
        fontSize: 16,
        color: destructive ? '#E5534B' : '#ECECEC',
      }}>{label}</span>
      {rightElement}
      {value && !rightElement && (
        <>
          <span style={{ fontSize: 14, color: '#7A7874' }}>{value}</span>
          {onClick && <ChevronRight size={16} color="#7A7874" style={{ marginLeft: 2 }} />}
        </>
      )}
      {onClick && !rightElement && !value && (
        <ChevronRight size={18} color="#7A7874" />
      )}
    </div>
  );
}

function SettingsToggleItem({
  icon: Icon,
  label,
  description,
  checked,
  onChange,
  testId,
}: {
  icon?: typeof User;
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  testId?: string;
}) {
  return (
    <div
      style={{
        minHeight: 52,
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: description ? '12px 16px' : '0 16px',
      }}
      data-testid={testId}
    >
      {Icon && <Icon size={20} color="#9A9893" strokeWidth={1.8} style={{ flexShrink: 0, alignSelf: description ? 'flex-start' : 'center', marginTop: description ? 2 : 0 }} />}
      <div style={{ flex: 1, minWidth: 0 }}>
        <span style={{ fontSize: 16, color: '#ECECEC', display: 'block' }}>{label}</span>
        {description && (
          <span style={{ fontSize: 13, color: '#7A7874', display: 'block', marginTop: 3, lineHeight: '1.4' }}>{description}</span>
        )}
      </div>
      <div
        onClick={() => onChange(!checked)}
        style={{
          width: 44,
          height: 24,
          borderRadius: 12,
          background: checked ? '#3B82F6' : 'rgba(255,255,255,0.15)',
          position: 'relative',
          cursor: 'pointer',
          transition: 'background 200ms',
          flexShrink: 0,
        }}
      >
        <div
          style={{
            width: 20,
            height: 20,
            borderRadius: '50%',
            background: '#FFFFFF',
            position: 'absolute',
            top: 2,
            left: checked ? 22 : 2,
            transition: 'left 200ms cubic-bezier(0.32, 0.72, 0, 1)',
            boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
          }}
        />
      </div>
    </div>
  );
}

function Divider() {
  return <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', margin: '0 16px' }} />;
}

function SectionDivider() {
  return <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', margin: '28px 0' }} />;
}

function GroupSpacer() {
  return <div style={{ height: 20 }} />;
}

function GroupLabel({ text }: { text: string }) {
  return (
    <div style={{
      fontSize: 12,
      fontWeight: 500,
      color: '#7A7874',
      textTransform: 'uppercase',
      letterSpacing: '0.5px',
      padding: '0 4px',
      marginBottom: 6,
      marginLeft: 20,
    }}>{text}</div>
  );
}

function SubSectionLabel({ text }: { text: string }) {
  return (
    <div style={{
      fontSize: 13,
      fontWeight: 500,
      color: '#7A7874',
      padding: '12px 16px 4px',
    }}>{text}</div>
  );
}

function PageHeader({
  title,
  onBack,
  onClose,
}: {
  title: string;
  onBack?: () => void;
  onClose?: () => void;
}) {
  return (
    <div style={{
      height: 56,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
      flexShrink: 0,
    }}>
      {(onBack || onClose) && (
        <button
          onClick={onBack || onClose}
          style={{
            position: 'absolute',
            left: 16,
            width: 36,
            height: 36,
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.1)',
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'background 150ms',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.15)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; }}
          data-testid={onBack ? "button-settings-back" : "button-settings-close"}
        >
          {onBack ? <ArrowLeft size={20} color="#ECECEC" /> : <X size={20} color="#ECECEC" />}
        </button>
      )}
      <span style={{ fontSize: 17, fontWeight: 600, color: '#ECECEC' }}>{title}</span>
    </div>
  );
}

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const options: { value: string; label: string; icon: typeof Sun }[] = [
    { value: 'system', label: 'System', icon: Monitor },
    { value: 'light', label: 'Light', icon: Sun },
    { value: 'dark', label: 'Dark', icon: Moon },
  ];

  return (
    <div style={{
      display: 'flex',
      gap: 2,
      background: 'rgba(255,255,255,0.06)',
      borderRadius: 10,
      padding: 3,
    }}>
      {options.map(opt => {
        const active = theme === opt.value;
        const OptIcon = opt.icon;
        return (
          <button
            key={opt.value}
            onClick={() => setTheme(opt.value as any)}
            style={{
              padding: '5px 10px',
              borderRadius: 8,
              background: active ? 'rgba(255,255,255,0.15)' : 'transparent',
              border: 'none',
              color: active ? '#ECECEC' : '#7A7874',
              fontSize: 12,
              fontWeight: 500,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              transition: 'all 150ms',
            }}
            data-testid={`theme-option-${opt.value}`}
          >
            <OptIcon size={13} />
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function PrimaryButton({
  onClick,
  disabled,
  loading,
  children,
  testId,
}: {
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  children: React.ReactNode;
  testId?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        width: '100%',
        height: 44,
        borderRadius: 12,
        background: disabled ? 'rgba(255,255,255,0.08)' : '#ECECEC',
        color: disabled ? '#7A7874' : '#1E1D1A',
        border: 'none',
        fontSize: 15,
        fontWeight: 600,
        cursor: disabled ? 'not-allowed' : 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        transition: 'all 150ms',
      }}
      data-testid={testId}
    >
      {loading && <Loader2 size={16} className="animate-spin" />}
      {children}
    </button>
  );
}

function SecondaryButton({
  onClick,
  disabled,
  loading,
  children,
  testId,
}: {
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  children: React.ReactNode;
  testId?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        width: '100%',
        height: 44,
        borderRadius: 12,
        background: 'rgba(255,255,255,0.08)',
        color: disabled ? '#7A7874' : '#ECECEC',
        border: 'none',
        fontSize: 15,
        fontWeight: 600,
        cursor: disabled ? 'not-allowed' : 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        transition: 'all 150ms',
      }}
      data-testid={testId}
    >
      {loading && <Loader2 size={16} className="animate-spin" />}
      {children}
    </button>
  );
}

function SettingsGroup({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      margin: '0 20px',
      borderRadius: 14,
      background: 'rgba(255,255,255,0.04)',
      overflow: 'hidden',
    }}>
      {children}
    </div>
  );
}

function ProfilePage({ onBack }: { onBack: () => void }) {
  const { user: authUser, updateUser } = useAuth();
  const { toast } = useToast();
  const [displayName, setDisplayName] = useState(authUser?.displayName || '');
  const [nickname, setNickname] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);

  const [preferences, setPreferences] = useState('');
  const [prefSaving, setPrefSaving] = useState(false);
  const [prefLoaded, setPrefLoaded] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);

  const { data: memoriesData } = useQuery<{ data: any[] }>({
    queryKey: ['/api/user-memories'],
  });

  useEffect(() => {
    if (memoriesData?.data && !prefLoaded) {
      const prefMemory = memoriesData.data.find(
        (m: any) => m.category === 'preferences' || m.content?.startsWith?.('[Personal Preferences]')
      );
      if (prefMemory) {
        const content = prefMemory.content || '';
        setPreferences(content.replace('[Personal Preferences] ', ''));
      }
      const nickMemory = memoriesData.data.find(
        (m: any) => m.content?.startsWith?.('[Nickname]')
      );
      if (nickMemory) {
        setNickname(nickMemory.content.replace('[Nickname] ', ''));
      }
      setPrefLoaded(true);
    }
  }, [memoriesData, prefLoaded]);

  const handleProfileSave = async () => {
    if (!displayName.trim()) {
      toast({ title: 'Please enter a name', variant: 'destructive' });
      return;
    }
    setProfileSaving(true);
    try {
      const res = await apiRequest('PUT', '/api/auth/profile', { displayName: displayName.trim() });
      const data = await res.json();
      updateUser({ displayName: data.user.displayName });
      if (nickname.trim()) {
        await apiRequest('POST', '/api/user-memories', {
          content: `[Nickname] ${nickname.trim()}`,
          category: 'context',
        });
      }
      toast({ title: 'Profile updated' });
    } catch (e: any) {
      toast({ title: 'Update failed', description: e.message, variant: 'destructive' });
    } finally {
      setProfileSaving(false);
    }
  };

  const handlePrefSave = async () => {
    setPrefSaving(true);
    try {
      await apiRequest('POST', '/api/user-memories', {
        content: `[Personal Preferences] ${preferences.trim()}`,
        category: 'preferences',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/user-memories'] });
      toast({ title: 'Preferences saved' });
    } catch (e: any) {
      toast({ title: 'Save failed', description: e.message, variant: 'destructive' });
    } finally {
      setPrefSaving(false);
    }
  };

  const handlePasswordChange = async () => {
    if (!currentPassword) {
      toast({ title: 'Please enter current password', variant: 'destructive' });
      return;
    }
    if (newPassword.length < 8) {
      toast({ title: 'New password must be at least 8 characters', variant: 'destructive' });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: 'Passwords do not match', variant: 'destructive' });
      return;
    }
    setPasswordSaving(true);
    try {
      await apiRequest('PUT', '/api/auth/password', { currentPassword, newPassword });
      toast({ title: 'Password changed' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (e: any) {
      toast({ title: 'Failed', description: e.message, variant: 'destructive' });
    } finally {
      setPasswordSaving(false);
    }
  };

  const profileChanged = displayName.trim() !== (authUser?.displayName || '') || nickname.trim() !== '';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <PageHeader title="Profile" onBack={onBack} />
      <BounceScroll style={{ flex: 1, padding: '0 20px 40px' }}>

        <div style={{ marginBottom: 16 }}>
          <label style={sectionLabelStyle}>Full Name</label>
          <input
            value={displayName}
            onChange={e => setDisplayName(e.target.value)}
            style={inputStyle}
            data-testid="input-settings-fullname"
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={sectionLabelStyle}>Nickname</label>
          <input
            value={nickname}
            onChange={e => setNickname(e.target.value)}
            placeholder="How AI should call you"
            style={inputStyle}
            data-testid="input-settings-nickname"
          />
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={sectionLabelStyle}>Email</label>
          <input
            value={authUser?.email || ''}
            disabled
            style={{ ...inputStyle, color: '#7A7874', cursor: 'not-allowed' }}
            data-testid="input-settings-email"
          />
        </div>

        <PrimaryButton
          onClick={handleProfileSave}
          disabled={profileSaving || !profileChanged}
          loading={profileSaving}
          testId="button-update-profile"
        >
          Update Profile
        </PrimaryButton>

        <SectionDivider />

        <div style={{ fontSize: 14, color: '#9A9893', marginBottom: 12, fontWeight: 500 }}>Personal Preferences</div>
        <div style={{ marginBottom: 16 }}>
          <textarea
            value={preferences}
            onChange={e => setPreferences(e.target.value)}
            placeholder="Tell the AI about your work style, communication preferences, or anything else you'd like it to know..."
            rows={4}
            style={{
              ...inputStyle,
              height: 'auto',
              padding: '12px 14px',
              resize: 'vertical',
              minHeight: 100,
              lineHeight: '1.5',
            }}
            data-testid="input-settings-preferences"
          />
        </div>

        <SecondaryButton
          onClick={handlePrefSave}
          disabled={prefSaving || !preferences.trim()}
          loading={prefSaving}
          testId="button-save-preferences"
        >
          Save Preferences
        </SecondaryButton>

        <SectionDivider />

        <div style={{ fontSize: 14, color: '#9A9893', marginBottom: 12, fontWeight: 500 }}>Change Password</div>

        <div style={{ marginBottom: 12 }}>
          <label style={sectionLabelStyle}>Current Password</label>
          <input
            type="password"
            value={currentPassword}
            onChange={e => setCurrentPassword(e.target.value)}
            style={inputStyle}
            data-testid="input-settings-current-password"
          />
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={sectionLabelStyle}>New Password</label>
          <input
            type="password"
            value={newPassword}
            onChange={e => setNewPassword(e.target.value)}
            placeholder="At least 8 characters"
            style={inputStyle}
            data-testid="input-settings-new-password"
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={sectionLabelStyle}>Confirm New Password</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
            style={inputStyle}
            data-testid="input-settings-confirm-password"
          />
        </div>

        <SecondaryButton
          onClick={handlePasswordChange}
          disabled={passwordSaving || !currentPassword || !newPassword || !confirmPassword}
          loading={passwordSaving}
          testId="button-change-password"
        >
          Change Password
        </SecondaryButton>

        <SectionDivider />

        <div
          onClick={() => {}}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '12px 0',
            cursor: 'pointer',
          }}
          data-testid="button-delete-account"
        >
          <Trash2 size={18} color="#E5534B" />
          <span style={{ fontSize: 15, color: '#E5534B' }}>Delete account</span>
        </div>
      </BounceScroll>
    </div>
  );
}

function OrganizationPage({ onBack }: { onBack: () => void }) {
  const { user: authUser } = useAuth();
  const { toast } = useToast();
  const { data: orgsData, isLoading } = useQuery<{ data: Organization[] }>({
    queryKey: ["/api/organizations"],
  });
  const org = orgsData?.data?.[0] ?? null;

  const [inviteRole, setInviteRole] = useState('member');
  const [inviteCreating, setInviteCreating] = useState(false);

  const { data: invitationsData } = useQuery<{ data: any[] }>({
    queryKey: ['/api/invitations'],
  });
  const invitations = invitationsData?.data || [];

  const handleCreateInvite = async () => {
    setInviteCreating(true);
    try {
      await apiRequest('POST', '/api/invitations', { role: inviteRole });
      queryClient.invalidateQueries({ queryKey: ['/api/invitations'] });
      toast({ title: 'Invite link generated' });
    } catch (e: any) {
      toast({ title: 'Failed', description: e.message, variant: 'destructive' });
    } finally {
      setInviteCreating(false);
    }
  };

  const handleDeactivateInvite = async (id: number) => {
    try {
      await apiRequest('DELETE', `/api/invitations/${id}`);
      queryClient.invalidateQueries({ queryKey: ['/api/invitations'] });
      toast({ title: 'Invite deactivated' });
    } catch (e: any) {
      toast({ title: 'Failed', description: e.message, variant: 'destructive' });
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <PageHeader title="Organization" onBack={onBack} />
      <BounceScroll style={{ flex: 1, padding: '0 20px 40px' }}>
        {isLoading ? (
          <div style={{ padding: '40px 0', textAlign: 'center', color: '#7A7874' }}>
            <Loader2 size={24} className="animate-spin" style={{ margin: '0 auto 8px' }} />
          </div>
        ) : org ? (
          <>
            <div style={{
              background: 'rgba(255,255,255,0.04)',
              borderRadius: 14,
              padding: '16px',
              marginBottom: 24,
            }}>
              <div style={{ fontSize: 13, color: '#7A7874', marginBottom: 4 }}>Organization</div>
              <div style={{ fontSize: 18, fontWeight: 600, color: '#ECECEC' }} data-testid="settings-org-name">{org.name}</div>
              {org.description && (
                <div style={{ fontSize: 14, color: '#9A9893', marginTop: 6 }}>{org.description}</div>
              )}
              <div style={{ fontSize: 13, color: '#7A7874', marginTop: 8 }}>
                Created {new Date(org.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
              </div>
            </div>

            {(authUser?.role === 'owner' || authUser?.role === 'admin') && (
              <>
                <div style={{ fontSize: 14, color: '#9A9893', marginBottom: 12, fontWeight: 500 }}>Invite Members</div>

                <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                  <select
                    value={inviteRole}
                    onChange={e => setInviteRole(e.target.value)}
                    style={{
                      flex: 1,
                      height: 40,
                      padding: '0 12px',
                      fontSize: 14,
                      color: '#ECECEC',
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(255,255,255,0.12)',
                      borderRadius: 10,
                      outline: 'none',
                    }}
                    data-testid="select-invite-role"
                  >
                    <option value="member">Member</option>
                    <option value="head">Head</option>
                    <option value="admin">Admin</option>
                  </select>
                  <button
                    onClick={handleCreateInvite}
                    disabled={inviteCreating}
                    style={{
                      height: 40,
                      padding: '0 16px',
                      borderRadius: 10,
                      background: 'rgba(255,255,255,0.08)',
                      border: 'none',
                      color: '#ECECEC',
                      fontSize: 14,
                      fontWeight: 500,
                      cursor: inviteCreating ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      transition: 'background 150ms',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.12)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; }}
                    data-testid="button-create-invite"
                  >
                    {inviteCreating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                    Generate
                  </button>
                </div>

                {invitations.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {invitations.map((inv: any) => (
                      <div
                        key={inv.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                          padding: '10px 14px',
                          borderRadius: 12,
                          background: 'rgba(255,255,255,0.04)',
                          border: '1px solid rgba(255,255,255,0.06)',
                        }}
                        data-testid={`invitation-${inv.id}`}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontFamily: 'monospace', color: '#ECECEC', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {inv.inviteCode}
                          </div>
                          <div style={{ fontSize: 12, color: '#7A7874', marginTop: 2 }}>
                            {inv.role} · {inv.usedCount} used
                          </div>
                        </div>
                        <button
                          onClick={() => { navigator.clipboard.writeText(inv.inviteCode); toast({ title: 'Copied' }); }}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6 }}
                          data-testid={`button-copy-invite-${inv.id}`}
                        >
                          <Copy size={16} color="#9A9893" />
                        </button>
                        <button
                          onClick={() => handleDeactivateInvite(inv.id)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6 }}
                          data-testid={`button-deactivate-invite-${inv.id}`}
                        >
                          <Trash2 size={16} color="#E5534B" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </>
        ) : (
          <div style={{ padding: '40px 0', textAlign: 'center', color: '#7A7874' }}>
            No organization found
          </div>
        )}
      </BounceScroll>
    </div>
  );
}

function CapabilitiesPage({ onBack }: { onBack: () => void }) {
  const [aiChat, setAiChat] = useState(true);
  const [aiAssignment, setAiAssignment] = useState(true);
  const [smartNotif, setSmartNotif] = useState(false);
  const [graphViz, setGraphViz] = useState(true);
  const [autoDeps, setAutoDeps] = useState(false);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <PageHeader title="Capabilities" onBack={onBack} />
      <BounceScroll style={{ flex: 1, padding: '0 0 40px' }}>
        <SettingsGroup>
          <SettingsToggleItem
            icon={Bot}
            label="AI Chat"
            checked={aiChat}
            onChange={setAiChat}
            testId="toggle-ai-chat"
          />
          <Divider />
          <SettingsToggleItem
            icon={UserCog}
            label="AI Task Assignment"
            description="Allow Buddy AI to suggest task assignments based on team workload and skills"
            checked={aiAssignment}
            onChange={setAiAssignment}
            testId="toggle-ai-assignment"
          />
          <Divider />
          <SettingsToggleItem
            icon={Zap}
            label="Smart Notifications"
            description="Buddy will analyze task urgency and send priority alerts"
            checked={smartNotif}
            onChange={setSmartNotif}
            testId="toggle-smart-notif"
          />
        </SettingsGroup>

        <GroupSpacer />
        <GroupLabel text="Data & Analysis" />

        <SettingsGroup>
          <SettingsToggleItem
            icon={BarChart3}
            label="Graph Visualization"
            checked={graphViz}
            onChange={setGraphViz}
            testId="toggle-graph-viz"
          />
          <Divider />
          <SettingsToggleItem
            icon={GitBranch}
            label="Auto Dependency Detection"
            description="Automatically detect and suggest task dependencies based on content analysis"
            checked={autoDeps}
            onChange={setAutoDeps}
            testId="toggle-auto-deps"
          />
        </SettingsGroup>
      </BounceScroll>
    </div>
  );
}

function ConnectorItem({
  icon: Icon,
  label,
  connected,
  onConnect,
  testId,
}: {
  icon: typeof MessageSquare;
  label: string;
  connected?: boolean;
  onConnect?: () => void;
  testId?: string;
}) {
  return (
    <div
      style={{
        height: 56,
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '0 16px',
      }}
      data-testid={testId}
    >
      <div style={{
        width: 36,
        height: 36,
        borderRadius: 10,
        background: 'rgba(255,255,255,0.06)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}>
        <Icon size={18} color="#9A9893" />
      </div>
      <span style={{ flex: 1, fontSize: 15, color: '#ECECEC' }}>{label}</span>
      {connected ? (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          fontSize: 13,
          color: '#3B82F6',
        }}>
          Connected
        </div>
      ) : (
        <div
          onClick={onConnect}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            fontSize: 13,
            color: '#9A9893',
            cursor: 'pointer',
            padding: '4px 0',
          }}
        >
          Connect
          <ExternalLink size={13} color="#9A9893" />
        </div>
      )}
    </div>
  );
}

function ConnectorsPage({ onBack }: { onBack: () => void }) {
  const { toast } = useToast();

  const handleConnect = (name: string) => {
    toast({ title: `${name} integration coming soon` });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <PageHeader title="Connectors" onBack={onBack} />
      <BounceScroll style={{ flex: 1, padding: '0 0 40px' }}>

        <div style={{ padding: '12px 20px 16px' }}>
          <div style={{ fontSize: 13, color: '#7A7874', lineHeight: '1.5' }}>
            Connect third-party services to extend Buddy's capabilities. Integrations allow task syncing, notifications, and more.
          </div>
        </div>

        <GroupLabel text="Available" />
        <SettingsGroup>
          <ConnectorItem
            icon={MessageSquare}
            label="WeChat Work"
            onConnect={() => handleConnect('WeChat Work')}
            testId="connector-wechat"
          />
          <Divider />
          <ConnectorItem
            icon={Phone}
            label="DingTalk"
            onConnect={() => handleConnect('DingTalk')}
            testId="connector-dingtalk"
          />
          <Divider />
          <ConnectorItem
            icon={Send}
            label="Feishu"
            onConnect={() => handleConnect('Feishu')}
            testId="connector-feishu"
          />
          <Divider />
          <ConnectorItem
            icon={Mail}
            label="Email"
            onConnect={() => handleConnect('Email')}
            testId="connector-email"
          />
        </SettingsGroup>
      </BounceScroll>
    </div>
  );
}

function PermissionsPage({ onBack }: { onBack: () => void }) {
  const { user: authUser } = useAuth();
  const role = authUser?.role || 'member';

  const getPermLevel = (resource: string): { label: string; color: string } => {
    switch (resource) {
      case 'tasks':
        return role === 'owner' || role === 'admin'
          ? { label: 'Full access', color: '#3B82F6' }
          : { label: 'Read & write', color: '#22C55E' };
      case 'team':
        return role === 'owner' || role === 'admin'
          ? { label: 'Manage', color: '#3B82F6' }
          : role === 'head'
          ? { label: 'View team', color: '#22C55E' }
          : { label: 'View', color: '#9A9893' };
      case 'projects':
        return role === 'owner' || role === 'admin'
          ? { label: 'Full access', color: '#3B82F6' }
          : role === 'head'
          ? { label: 'Read & write', color: '#22C55E' }
          : { label: 'Read only', color: '#9A9893' };
      case 'org':
        return role === 'owner'
          ? { label: 'Full access', color: '#3B82F6' }
          : role === 'admin'
          ? { label: 'Manage', color: '#3B82F6' }
          : { label: 'No access', color: '#7A7874' };
      default:
        return { label: 'None', color: '#7A7874' };
    }
  };

  const items: { icon: typeof CheckSquare; label: string; resource: string }[] = [
    { icon: CheckSquare, label: 'Task Management', resource: 'tasks' },
    { icon: Users, label: 'Team Members', resource: 'team' },
    { icon: FolderKanban, label: 'Projects', resource: 'projects' },
    { icon: Building2, label: 'Organization Settings', resource: 'org' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <PageHeader title="Permissions" onBack={onBack} />
      <BounceScroll style={{ flex: 1, padding: '0 0 40px' }}>

        <div style={{ padding: '4px 20px 16px' }}>
          <div style={{
            display: 'inline-block',
            padding: '4px 12px',
            borderRadius: 8,
            background: 'rgba(59,130,246,0.15)',
            fontSize: 13,
            color: '#3B82F6',
            fontWeight: 500,
          }}>
            Role: {role.charAt(0).toUpperCase() + role.slice(1)}
          </div>
        </div>

        <SettingsGroup>
          {items.map((item, i) => {
            const perm = getPermLevel(item.resource);
            const ItemIcon = item.icon;
            return (
              <div key={item.resource}>
                {i > 0 && <Divider />}
                <div
                  style={{
                    height: 52,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                    padding: '0 16px',
                  }}
                  data-testid={`perm-${item.resource}`}
                >
                  <ItemIcon size={20} color="#9A9893" strokeWidth={1.8} />
                  <span style={{ flex: 1, fontSize: 16, color: '#ECECEC' }}>{item.label}</span>
                  <span style={{ fontSize: 13, color: perm.color, fontWeight: 500 }}>{perm.label}</span>
                </div>
              </div>
            );
          })}
        </SettingsGroup>

        <div style={{
          padding: '20px 24px',
          fontSize: 13,
          color: '#7A7874',
          lineHeight: '1.5',
          textAlign: 'center',
        }}>
          Contact your organization admin to change permissions
        </div>
      </BounceScroll>
    </div>
  );
}

function ComingSoonPage({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <PageHeader title={title} onBack={onBack} />
      <BounceScroll style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: 48,
            height: 48,
            borderRadius: 12,
            background: 'rgba(255,255,255,0.06)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px',
          }}>
            <FileText size={24} color="#7A7874" />
          </div>
          <div style={{ fontSize: 16, color: '#9A9893', marginBottom: 4 }}>Coming soon</div>
          <div style={{ fontSize: 13, color: '#7A7874' }}>This feature is under development</div>
        </div>
      </BounceScroll>
    </div>
  );
}

function AboutPage({ onBack }: { onBack: () => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <PageHeader title="About" onBack={onBack} />
      <BounceScroll style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
        <div style={{
          width: 72,
          height: 72,
          borderRadius: 18,
          background: 'linear-gradient(135deg, #AE5630 0%, #C4703F 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 32,
          fontWeight: 700,
          color: '#FFF',
          fontFamily: "Georgia, serif",
          boxShadow: '0 8px 24px rgba(174, 86, 48, 0.3)',
        }}>
          B
        </div>
        <div style={{ fontSize: 22, fontWeight: 600, color: '#ECECEC', marginTop: 4 }}>Buddy</div>
        <div style={{ fontSize: 14, color: '#7A7874' }}>Version 0.1.0</div>
        <div style={{ fontSize: 13, color: '#7A7874', marginTop: 12, textAlign: 'center', lineHeight: '1.5', maxWidth: 260 }}>
          AI-powered task management for teams
        </div>

        <div style={{ marginTop: 32 }}>
          <div
            onClick={() => { window.location.href = 'mailto:support@buddy.app'; }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 20px',
              borderRadius: 10,
              background: 'rgba(255,255,255,0.06)',
              cursor: 'pointer',
              transition: 'background 150ms',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
            data-testid="button-contact-support"
          >
            <Mail size={16} color="#9A9893" />
            <span style={{ fontSize: 14, color: '#9A9893' }}>Contact Support</span>
          </div>
        </div>
      </BounceScroll>
    </div>
  );
}

export default function SettingsPage({ open, onClose, onOpenOrgSwitcher, onCloseSidebar }: SettingsPageProps) {
  const { user: authUser, logout } = useAuth();
  const { theme } = useTheme();
  const [page, setPage] = useState<PageId>('main');
  const [subVisible, setSubVisible] = useState(false);
  const [subSlideIn, setSubSlideIn] = useState(false);
  const [hapticFeedback, setHapticFeedback] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setPage('main');
      setSubVisible(false);
      setSubSlideIn(false);
    }
  }, [open]);

  const navigateTo = useCallback((target: PageId) => {
    setPage(target);
    setSubVisible(true);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setSubSlideIn(true);
      });
    });
  }, []);

  const goBack = useCallback(() => {
    setSubSlideIn(false);
    setTimeout(() => {
      setSubVisible(false);
      setPage('main');
    }, 300);
  }, []);

  if (!open) return null;

  const renderSubPage = () => {
    if (!subVisible) return null;

    const subStyle: React.CSSProperties = {
      position: 'absolute',
      inset: 0,
      background: '#1E1D1A',
      zIndex: 2,
      transform: subSlideIn ? 'translateX(0)' : 'translateX(100%)',
      transition: 'transform 300ms cubic-bezier(0.32, 0.72, 0, 1)',
    };

    switch (page) {
      case 'profile':
        return <div style={subStyle}><ProfilePage onBack={goBack} /></div>;
      case 'organization':
        return <div style={subStyle}><OrganizationPage onBack={goBack} /></div>;
      case 'capabilities':
        return <div style={subStyle}><CapabilitiesPage onBack={goBack} /></div>;
      case 'connectors':
        return <div style={subStyle}><ConnectorsPage onBack={goBack} /></div>;
      case 'permissions':
        return <div style={subStyle}><PermissionsPage onBack={goBack} /></div>;
      case 'notifications':
        return <div style={subStyle}><ComingSoonPage title="Notifications" onBack={goBack} /></div>;
      case 'privacy':
        return <div style={subStyle}><ComingSoonPage title="Privacy" onBack={goBack} /></div>;
      case 'about':
        return <div style={subStyle}><AboutPage onBack={goBack} /></div>;
      case 'shared-links':
        return <div style={subStyle}><ComingSoonPage title="Shared Links" onBack={goBack} /></div>;
      default:
        return null;
    }
  };

  return (
    <div
      ref={containerRef}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 60,
        background: '#1E1D1A',
        animation: 'settingsPageIn 300ms cubic-bezier(0.32, 0.72, 0, 1) forwards',
        overflow: 'hidden',
      }}
      data-testid="settings-page"
    >
      <style>{`
        @keyframes settingsPageIn {
          from { opacity: 0; transform: scale(0.97) translateY(8px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>

      <div style={{
        position: 'relative',
        height: '100%',
        paddingTop: 'env(safe-area-inset-top, 0px)',
      }}>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
        }}>
          <PageHeader title="Settings" onClose={onClose} />

          <BounceScroll style={{ flex: 1 }}>
            <div style={{
              margin: '4px 20px 16px',
              padding: '14px 16px',
              borderRadius: 14,
              background: 'rgba(255,255,255,0.04)',
            }}>
              <div style={{ fontSize: 14, color: '#9A9893' }}>{authUser?.email || ''}</div>
            </div>

            <GroupLabel text="Account" />
            <SettingsGroup>
              <SettingsItem icon={User} label="Profile" onClick={() => navigateTo('profile')} testId="settings-nav-profile" />
              <Divider />
              <SettingsItem icon={CreditCard} label="Subscription" value="Free" testId="settings-nav-billing" />
            </SettingsGroup>

            <GroupSpacer />

            <GroupLabel text="Workspace" />
            <SettingsGroup>
              <SettingsItem icon={Building2} label="Organization" value={authUser?.orgName || ''} onClick={() => navigateTo('organization')} testId="settings-nav-organization" />
              <Divider />
              <SettingsItem
                icon={Users}
                label="Switch Organization"
                onClick={() => { onClose(); onOpenOrgSwitcher(); }}
                testId="settings-nav-switch-org"
              />
              <Divider />
              <SettingsItem icon={Settings2} label="Capabilities" onClick={() => navigateTo('capabilities')} testId="settings-nav-capabilities" />
              <Divider />
              <SettingsItem icon={Blocks} label="Connectors" onClick={() => navigateTo('connectors')} testId="settings-nav-connectors" />
              {(authUser?.role === 'owner' || authUser?.role === 'admin') && (
                <>
                  <Divider />
                  <SettingsItem icon={Shield} label="Permissions" onClick={() => navigateTo('permissions')} testId="settings-nav-permissions" />
                </>
              )}
            </SettingsGroup>

            <GroupSpacer />

            <GroupLabel text="Preferences" />
            <SettingsGroup>
              <SettingsItem
                icon={Moon}
                label="Appearance"
                rightElement={<ThemeToggle />}
                testId="settings-nav-appearance"
              />
              <Divider />
              <SettingsItem icon={Globe} label="Language" value="English" testId="settings-nav-language" />
              <Divider />
              <SettingsItem icon={Bell} label="Notifications" onClick={() => navigateTo('notifications')} testId="settings-nav-notifications" />
            </SettingsGroup>

            <GroupSpacer />

            <GroupLabel text="More" />
            <SettingsGroup>
              <SettingsItem icon={Lock} label="Privacy" onClick={() => navigateTo('privacy')} testId="settings-nav-privacy" />
              <Divider />
              <SettingsItem icon={HelpCircle} label="Help & Feedback" onClick={() => { window.location.href = 'mailto:support@buddy.app'; }} testId="settings-nav-help" />
              <Divider />
              <SettingsItem icon={Info} label="About" value="v0.1.0" onClick={() => navigateTo('about')} testId="settings-nav-about" />
            </SettingsGroup>

            <GroupSpacer />

            <SettingsGroup>
              <SettingsItem icon={Link2} label="Shared Links" onClick={() => navigateTo('shared-links')} testId="settings-nav-shared-links" />
              <Divider />
              <SettingsToggleItem
                icon={Smartphone}
                label="Haptic Feedback"
                checked={hapticFeedback}
                onChange={setHapticFeedback}
                testId="toggle-haptic-feedback"
              />
            </SettingsGroup>

            <GroupSpacer />

            <SettingsGroup>
              <SettingsItem
                icon={LogOut}
                label="Log Out"
                destructive
                onClick={() => {
                  onClose();
                  onCloseSidebar();
                  logout();
                }}
                testId="settings-nav-logout"
              />
            </SettingsGroup>

            <div style={{ height: 'calc(40px + env(safe-area-inset-bottom, 0px))' }} />
          </BounceScroll>
        </div>

        {page !== 'main' && renderSubPage()}
      </div>
    </div>
  );
}
