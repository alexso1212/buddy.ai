# Buddy 侧边栏功能接线指令（修订版）

# 消除所有”点击无反应”，去掉假数据，设计真实产品逻辑

-----

# STEP 1：去掉假数据

## 1.1 对话列表初始状态

当用户没有任何对话历史时，侧边栏对话区域显示空状态：

```jsx
{conversations.length === 0 ? (
  <div style={{
    padding: '32px 28px',
    textAlign: 'center',
  }}>
    <p style={{
      fontSize: 14,
      color: 'var(--text-secondary)',  /* #9A9893 */
      lineHeight: 1.5,
    }}>还没有对话</p>
    <p style={{
      fontSize: 13,
      color: 'var(--text-placeholder)',  /* #7A7874 */
      marginTop: 4,
    }}>点击下方 ＋ 开始新对话</p>
  </div>
) : (
  <>
    {/* 收藏分组 —— 只在有收藏对话时才显示 */}
    {starredConvs.length > 0 && (
      <>
        <SectionTitle>收藏</SectionTitle>
        {starredConvs.map(conv => <ConversationItem key={conv.id} {...conv} />)}
      </>
    )}

    {/* 最近对话 */}
    {recentConvs.length > 0 && (
      <>
        <SectionTitle>最近对话</SectionTitle>
        {recentConvs.map(conv => <ConversationItem key={conv.id} {...conv} />)}
      </>
    )}
  </>
)}
```

## 1.2 对话数据全部从 localStorage 来

```typescript
// 初始化 —— 从 localStorage 读取，没有就是空数组
const [conversations, setConversations] = useState<Conversation[]>(() => {
  try {
    const saved = localStorage.getItem('buddy_conversations');
    return saved ? JSON.parse(saved) : [];   // ⚠️ 空数组，不要预填假数据
  } catch {
    return [];
  }
});

// 派生数据
const starredConvs = conversations.filter(c => c.starred).sort((a, b) => b.updatedAt - a.updatedAt);
const recentConvs = conversations.filter(c => !c.starred).sort((a, b) => b.updatedAt - a.updatedAt);
```

## 1.3 对话自动创建

不要预先创建空对话。用户第一次发消息时才创建：

```typescript
function handleSendMessage(text: string) {
  let convId = activeConversationId;

  // 如果当前没有活跃对话，自动创建一个
  if (!convId) {
    const newConv: Conversation = {
      id: crypto.randomUUID(),
      title: text.slice(0, 30) + (text.length > 30 ? '...' : ''),
      messages: [],
      starred: false,
      projectId: null,           // 未归属项目
      projectName: null,
      visibility: 'private',     // 默认仅自己可见
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    setConversations(prev => [newConv, ...prev]);
    convId = newConv.id;
    setActiveConversationId(convId);
  }

  // 添加用户消息
  addMessageToConversation(convId, {
    id: crypto.randomUUID(),
    role: 'user',
    text: text,
    timestamp: Date.now(),
  });

  // 调用 AI API...
}
```

-----

# STEP 2：导航项功能分配

## 2.1 最终分配

|导航项          |点击行为                    |状态           |
|-------------|------------------------|-------------|
|**Chats**    |切换到聊天主页面，关闭侧边栏          |✅ 立即实现       |
|**Projects** |toast “即将推出”            |⏳ 占位         |
|**Artifacts**|跳转到 Artifacts 页面（AI 工具集）|✅ 保留，见 STEP 3|
|**Code**     |toast “即将推出”            |⏳ 占位         |

## 2.2 企业管理导航项

|导航项|点击行为                   |
|---|-----------------------|
|仪表盘|跳转到仪表盘（已实现就跳，没有就 toast）|
|图谱 |跳转到图谱页                 |
|项目 |跳转到项目管理页               |
|任务 |跳转到任务管理页               |
|团队 |跳转到团队管理页               |

-----

# STEP 3：Artifacts 页面（AI 工具集）

Artifacts 不是”即将推出”，而是 AI 能力的入口页面。

## 3.1 Artifacts 页面结构

```
┌─────────────────────────────────────┐
│  ←          AI 工具集               │  ← 顶栏
├─────────────────────────────────────┤
│                                     │
│  🔍 企业诊断                        │  ← 工具卡片
│  AI 读取企业资料，生成诊断报告       │
│                                     │
│  📊 项目总结                        │
│  抓取项目和任务数据，AI 总结分析     │
│                                     │
│  📋 任务洞察                        │
│  分析任务分布、瓶颈和建议            │
│                                     │
│  👥 团队分析                        │
│  分析团队负载和协作效率              │
│                                     │
│  更多工具即将推出...                 │
│                                     │
└─────────────────────────────────────┘
```

## 3.2 工具卡片样式

```jsx
function ArtifactToolCard({ icon, title, description, onClick, comingSoon = false }) {
  return (
    <button
      onClick={comingSoon ? () => showToast('即将推出') : onClick}
      style={{
        width: '100%',
        padding: '16px 18px',
        background: 'var(--bg-composer)',     /* #3C3B37 */
        borderRadius: 14,
        border: '1px solid var(--border-subtle)',
        marginBottom: 10,
        display: 'flex',
        alignItems: 'flex-start',
        gap: 14,
        cursor: 'pointer',
        textAlign: 'left',
        opacity: comingSoon ? 0.5 : 1,
        transition: 'background 150ms',
      }}
    >
      <div style={{
        width: 40, height: 40, borderRadius: 10,
        background: 'rgba(174, 86, 48, 0.12)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        <span style={{ fontSize: 20 }}>{icon}</span>
      </div>
      <div>
        <div style={{
          fontSize: 15.5, fontWeight: 500,
          color: 'var(--text-primary)',
          marginBottom: 4,
        }}>
          {title}
          {comingSoon && <span style={{
            fontSize: 11, color: 'var(--text-secondary)',
            marginLeft: 8, fontWeight: 400,
          }}>即将推出</span>}
        </div>
        <div style={{
          fontSize: 13.5, color: 'var(--text-secondary)',
          lineHeight: 1.4,
        }}>{description}</div>
      </div>
    </button>
  );
}
```

## 3.3 初期可用的工具

先做一个最简单的能用的：点击后跳转到一个**预设 system prompt 的对话**。

```typescript
function handleToolClick(tool: ArtifactTool) {
  // 创建一个带有特殊 system prompt 的新对话
  const newConv: Conversation = {
    id: crypto.randomUUID(),
    title: tool.title,
    messages: [],
    starred: false,
    projectId: null,
    visibility: 'private',
    systemPrompt: tool.systemPrompt,  // ⚠️ 特殊 system prompt
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  setConversations(prev => [newConv, ...prev]);
  setActiveConversationId(newConv.id);
  navigateTo('chat');
  setSidebarOpen(false);
}

// 工具列表
const artifactTools: ArtifactTool[] = [
  {
    icon: '🔍',
    title: '企业诊断',
    description: 'AI 读取企业资料，生成诊断报告',
    systemPrompt: '你是 Buddy 企业诊断助手。用户会提供企业资料，请全面分析并生成诊断报告，涵盖组织架构、业务流程、风险点和改进建议。',
    comingSoon: false,
  },
  {
    icon: '📊',
    title: '项目总结',
    description: '抓取项目和任务数据，AI 总结分析',
    systemPrompt: '你是 Buddy 项目分析助手。基于用户提供的项目和任务数据，生成项目进度总结、风险预警和下一步建议。',
    comingSoon: false,
  },
  {
    icon: '📋',
    title: '任务洞察',
    description: '分析任务分布、瓶颈和建议',
    systemPrompt: '你是 Buddy 任务分析助手。分析团队的任务数据，识别瓶颈、负载不均、逾期风险，并给出优化建议。',
    comingSoon: false,
  },
  {
    icon: '👥',
    title: '团队分析',
    description: '分析团队负载和协作效率',
    comingSoon: true,   // 先占位
  },
];
```

-----

# STEP 4：「移到项目」功能（关联真实项目）

这是核心产品特性：AI 对话可以归属到企业管理中的真实项目。

## 4.1 数据模型扩展

```typescript
interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  starred: boolean;
  createdAt: number;
  updatedAt: number;

  // ⚠️ 新增：项目关联
  projectId: string | null;       // 关联的项目 ID（null = 未归属）
  projectName: string | null;     // 项目名称（冗余存储，方便显示）

  // ⚠️ 新增：可见范围
  visibility: 'private' | 'project_team' | 'custom';
  visibleTo?: string[];           // custom 模式下的可见用户 ID 列表

  // ⚠️ 新增：AI 工具类型
  systemPrompt?: string;          // 如果从 Artifacts 工具启动
}
```

## 4.2 长按菜单 →「移到项目」→ 弹出项目选择器

```
长按对话 → 弹出菜单 → 点击"移到项目" → 弹出项目选择面板：

┌──────────────────────────────────────┐
│                                      │
│  移到项目                        ✕   │
│                                      │
│  ┌────────────────────────────────┐  │
│  │ 🔍 搜索项目...                 │  │
│  └────────────────────────────────┘  │
│                                      │
│  最近项目                            │
│                                      │
│  📁 品牌视觉升级                     │
│  📁 Q1 销售冲刺                      │
│  📁 新产品研发                       │
│  📁 客户服务优化                     │
│                                      │
│  所有项目                            │
│                                      │
│  📁 2024 年度规划                    │
│  📁 办公室搬迁                       │
│  📁 App 开发                         │
│  ...                                 │
│                                      │
│  ─────────────────────────────────── │
│  📤 从项目中移除                     │ ← 如果已在某项目中
│                                      │
└──────────────────────────────────────┘
```

## 4.3 项目选择面板样式

```jsx
function ProjectPicker({ isOpen, onClose, onSelect, currentProjectId }) {
  const [searchQuery, setSearchQuery] = useState('');
  // projects 从企业管理那边获取
  const projects = useProjects();

  const filtered = projects.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // 分为最近和所有
  const recentProjects = filtered.slice(0, 4);
  const allProjects = filtered;

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 80,
      display: 'flex', flexDirection: 'column',
      justifyContent: 'flex-end',
    }}>
      {/* 遮罩 */}
      <div onClick={onClose} style={{
        position: 'absolute', inset: 0,
        background: 'rgba(0,0,0,0.5)',
      }} />

      {/* 面板 */}
      <div style={{
        position: 'relative',
        background: '#2B2A27',
        borderRadius: '16px 16px 0 0',
        maxHeight: '70vh',
        display: 'flex', flexDirection: 'column',
        animation: 'slideUp 300ms cubic-bezier(0.165, 0.85, 0.45, 1)',
      }}>
        {/* 顶栏 */}
        <div style={{
          padding: '18px 20px 12px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <span style={{ fontSize: 17, fontWeight: 600, color: '#ECECEC' }}>
            移到项目
          </span>
          <button onClick={onClose}>
            <XIcon size={20} color="#9A9893" />
          </button>
        </div>

        {/* 搜索框 */}
        <div style={{ padding: '0 16px 12px' }}>
          <div style={{
            background: 'rgba(255,255,255,0.06)',
            borderRadius: 10,
            padding: '0 12px',
            height: 36,
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <SearchIcon size={16} color="#7A7874" />
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="搜索项目..."
              style={{
                flex: 1, border: 'none', outline: 'none',
                background: 'transparent', fontSize: 14,
                color: '#ECECEC',
              }}
            />
          </div>
        </div>

        {/* 项目列表 */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px' }}>
          {allProjects.map(project => (
            <button
              key={project.id}
              onClick={() => onSelect(project)}
              style={{
                width: '100%',
                padding: '12px 14px',
                borderRadius: 10,
                display: 'flex', alignItems: 'center', gap: 12,
                background: project.id === currentProjectId
                  ? 'rgba(174, 86, 48, 0.12)' : 'transparent',
                border: 'none', cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <FolderIcon size={18} color={
                project.id === currentProjectId ? '#AE5630' : '#9A9893'
              } />
              <span style={{
                fontSize: 15, color: '#ECECEC',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>{project.name}</span>
              {project.id === currentProjectId && (
                <CheckIcon size={16} color="#AE5630" style={{ marginLeft: 'auto' }} />
              )}
            </button>
          ))}

          {/* 从项目中移除（只在已归属项目时显示） */}
          {currentProjectId && (
            <>
              <div style={{
                borderTop: '1px solid rgba(255,255,255,0.06)',
                margin: '8px 6px',
              }} />
              <button
                onClick={() => onSelect(null)}
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  borderRadius: 10,
                  display: 'flex', alignItems: 'center', gap: 12,
                  background: 'transparent',
                  border: 'none', cursor: 'pointer',
                }}
              >
                <FolderMinusIcon size={18} color="#9A9893" />
                <span style={{ fontSize: 15, color: '#9A9893' }}>
                  从项目中移除
                </span>
              </button>
            </>
          )}
        </div>

        {/* 底部安全区 */}
        <div style={{ height: 'env(safe-area-inset-bottom)' }} />
      </div>
    </div>
  );
}
```

## 4.4 移到项目的逻辑

```typescript
function handleMoveToProject(convId: string, project: Project | null) {
  setConversations(prev =>
    prev.map(c => {
      if (c.id !== convId) return c;
      if (project === null) {
        // 从项目中移除
        return { ...c, projectId: null, projectName: null, visibility: 'private' };
      }
      return {
        ...c,
        projectId: project.id,
        projectName: project.name,
        // 移入项目后默认仍是 private，需要用户手动开启团队可见
        visibility: 'private',
      };
    })
  );
  closeProjectPicker();
  closeContextMenu();

  showToast(project ? `已移到「${project.name}」` : '已从项目中移除');
}
```

## 4.5 对话列表中显示项目归属

已归属项目的对话，在标题下方显示项目名：

```jsx
function ConversationItem({ conv, isActive, onSelect, onLongPress }) {
  return (
    <div
      onClick={() => onSelect(conv.id)}
      onTouchStart={e => handleLongPressStart(e, conv)}
      onTouchEnd={handleLongPressEnd}
      style={{
        padding: '10px 16px',
        margin: '0 8px 2px 16px',
        borderRadius: 10,
        background: isActive ? 'var(--sidebar-active)' : 'transparent',
        cursor: 'pointer',
      }}
    >
      {/* 对话标题 */}
      <div style={{
        fontSize: 15.5,
        color: 'var(--text-primary)',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {conv.title}
      </div>

      {/* 项目标签（如果已归属） */}
      {conv.projectName && (
        <div style={{
          fontSize: 12,
          color: 'var(--text-secondary)',
          marginTop: 3,
          display: 'flex', alignItems: 'center', gap: 4,
        }}>
          <FolderIcon size={11} />
          {conv.projectName}
          {conv.visibility !== 'private' && (
            <span style={{
              fontSize: 10,
              color: '#AE5630',
              marginLeft: 4,
            }}>
              • {conv.visibility === 'project_team' ? '团队可见' : '指定可见'}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
```

## 4.6 可见范围设置（未来功能，先占位）

当对话已归属到项目后，用户可以设置可见范围。

这个功能比较复杂（需要用户系统和权限），先在长按菜单中加一个入口：

```
长按已归属项目的对话 → 菜单多出一项：

  📁 移到项目      → 换项目
  👁 可见范围      → 设置谁能看到  ← 新增
  ⭐ 收藏
  ✏️  重命名
  ──────────
  🗑 删除
```

点击”可见范围”时：

- 如果用户系统还没做 → toast “即将推出”
- 如果已做 → 弹出选择器：仅自己 / 项目团队 / 指定成员

-----

# STEP 5：长按菜单最终版

## 5.1 菜单项（根据对话状态动态变化）

```typescript
function getContextMenuItems(conv: Conversation): MenuItem[] {
  const items: MenuItem[] = [];

  // 移到项目（始终显示）
  items.push({
    icon: 'FolderInput',
    label: conv.projectId ? `项目：${conv.projectName}` : '移到项目',
    action: () => openProjectPicker(conv.id),
  });

  // 可见范围（仅当已归属项目时显示）
  if (conv.projectId) {
    items.push({
      icon: 'Eye',
      label: '可见范围',
      sublabel: conv.visibility === 'private' ? '仅自己'
        : conv.visibility === 'project_team' ? '项目团队'
        : '指定成员',
      action: () => showToast('可见范围设置即将推出'),  // 暂时占位
    });
  }

  // 收藏
  items.push({
    icon: conv.starred ? 'StarOff' : 'Star',
    label: conv.starred ? '取消收藏' : '收藏',
    action: () => handleToggleStar(conv.id),
  });

  // 重命名
  items.push({
    icon: 'Pencil',
    label: '重命名',
    action: () => openRenameModal(conv.id, conv.title),
  });

  // 分隔线 + 删除
  items.push({ type: 'separator' });
  items.push({
    icon: 'Trash2',
    label: '删除',
    danger: true,
    action: () => openDeleteConfirm(conv.id),
  });

  return items;
}
```

## 5.2 菜单渲染

```jsx
function ContextMenu({ items, position, onClose }) {
  if (!items || items.length === 0) return null;

  return (
    <>
      {/* 遮罩 */}
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, zIndex: 65,
        background: 'rgba(0,0,0,0.2)',
      }} />

      {/* 菜单 */}
      <div style={{
        position: 'fixed',
        left: Math.min(position.x, window.innerWidth - 220),
        top: Math.min(position.y, window.innerHeight - items.length * 48 - 20),
        zIndex: 70,
        background: '#3C3B37',
        borderRadius: 14,
        boxShadow: '0 8px 32px rgba(0,0,0,0.4), 0 2px 8px rgba(0,0,0,0.2)',
        padding: '6px 0',
        minWidth: 200,
        animation: 'menuIn 200ms ease-out',
      }}>
        {items.map((item, i) => {
          if (item.type === 'separator') {
            return <div key={i} style={{
              borderTop: '1px solid rgba(255,255,255,0.06)',
              margin: '4px 0',
            }} />;
          }

          const Icon = getLucideIcon(item.icon);
          return (
            <button
              key={i}
              onClick={() => { item.action(); onClose(); }}
              style={{
                width: '100%', height: 44,
                padding: '0 16px',
                display: 'flex', alignItems: 'center', gap: 12,
                background: 'none', border: 'none', cursor: 'pointer',
              }}
            >
              <Icon size={18} color={item.danger ? '#E5534B' : '#ECECEC'} />
              <div style={{ flex: 1 }}>
                <span style={{
                  fontSize: 15, color: item.danger ? '#E5534B' : '#ECECEC',
                }}>{item.label}</span>
                {item.sublabel && (
                  <span style={{
                    fontSize: 12, color: '#9A9893', marginLeft: 8,
                  }}>{item.sublabel}</span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </>
  );
}
```

```css
@keyframes menuIn {
  from { opacity: 0; transform: scale(0.95); }
  to { opacity: 1; transform: scale(1); }
}
```

-----

# STEP 6：其余按钮处理

## 6.1 完整分配表

|按钮/菜单项          |行为           |状态          |
|----------------|-------------|------------|
|**新对话按钮 ＋**     |创建新对话，切换过去   |✅ 实现        |
|**对话列表项点击**     |切换对话，加载消息    |✅ 实现        |
|**Chats 导航**    |切换到聊天视图      |✅ 实现        |
|**Artifacts 导航**|跳转 AI 工具集页面  |✅ 实现（STEP 3）|
|**Projects 导航** |toast “即将推出” |⏳ 占位        |
|**Code 导航**     |toast “即将推出” |⏳ 占位        |
|**长按 → 移到项目**   |弹出项目选择器      |✅ 实现        |
|**长按 → 可见范围**   |toast “即将推出” |⏳ 占位        |
|**长按 → 收藏**     |切换 starred   |✅ 实现        |
|**长按 → 重命名**    |弹出 Modal     |✅ 实现        |
|**长按 → 删除**     |弹出确认框        |✅ 实现        |
|**头像 → 设置**     |toast “即将推出” |⏳ 占位        |
|**头像 → 通知**     |toast “即将推出” |⏳ 占位        |
|**头像 → 深色模式**   |Toggle 切换    |✅ 实现        |
|**头像 → 帮助与反馈**  |打开 mailto 或微信|✅ 实现        |
|**头像 → 退出登录**   |暂时隐藏         |🚫 隐藏        |
|**企业管理各项**      |正常跳转对应页面     |✅ 已有页面      |

-----

# STEP 7：给 Replit 的执行 Prompt

```
请按以下要求为侧边栏接上真实功能。

===== 去掉假数据 =====
1. 删除对话列表中的所有硬编码假数据
2. 对话列表从 localStorage 读取，初始为空数组
3. 没有对话时显示空状态提示："还没有对话，点击下方 ＋ 开始新对话"
4. "收藏"分组只在有收藏对话时才显示

===== 核心对话功能 =====
5. 新对话按钮（＋）：创建新空对话，设为活跃，关闭侧边栏，聚焦输入框
6. 不要在打开 App 时自动创建空对话，用户发第一条消息时才创建
7. 第一条消息自动截取前30字符作为对话标题
8. 对话列表项点击：切换到该对话，加载消息历史，关闭侧边栏
9. 每次对话变更自动保存到 localStorage

===== 长按菜单功能 =====
10. 收藏/取消收藏：切换 starred 字段，收藏的对话移到"收藏"分组
11. 重命名：弹出自定义 Modal（背景 #3C3B37，圆角 16px，输入框背景 #2B2A27，确认按钮 #AE5630）
12. 删除：弹出确认框（删除按钮红色 #E5534B，文案："确定删除？此操作无法撤销"）
13. 移到项目：弹出底部面板（Project Picker），从企业管理的项目列表中选择
    - 面板从底部滑入，背景 #2B2A27，圆角 16px 16px 0 0
    - 顶部搜索框可搜索项目名
    - 项目列表显示所有项目，当前关联的项目打勾标 ✓
    - 底部有"从项目中移除"选项（仅当已归属项目时显示）
    - 选择后 toast 提示"已移到「项目名」"
14. 如果对话已归属项目，菜单多显示一项"可见范围"，点击 toast "即将推出"
15. 已归属项目的对话，在标题下方显示小字项目名 + 📁 图标

===== 对话数据模型扩展 =====
16. Conversation 对象新增字段：
    - projectId: string | null（关联的项目ID）
    - projectName: string | null（项目名称）
    - visibility: 'private'（默认仅自己可见）

===== Artifacts 页面 =====
17. Artifacts 导航项点击后跳转到 AI 工具集页面
18. 页面显示工具卡片列表：企业诊断 / 项目总结 / 任务洞察 / 团队分析
19. 卡片样式：背景 #3C3B37，圆角 14px，左侧 40px 图标区，右侧标题+描述
20. 点击可用的工具卡片 → 创建带特殊 system prompt 的新对话并跳转
21. "团队分析"标记为 coming soon，半透明，点击 toast

===== Toast / 占位 =====
22. Projects / Code 导航项 → toast "即将推出"
23. 设置 / 通知 → toast "即将推出"
24. 可见范围 → toast "即将推出"
25. 帮助与反馈 → window.location.href = 'mailto:support@buddy.app'
26. 退出登录 → 暂时隐藏不显示

===== 头像设置面板 =====
27. 深色模式 Toggle 正常工作（切换 dark/light class + localStorage）

确保完成后侧边栏中没有任何按钮是点击无反应的。
```

-----

# 检查清单

```
【假数据】
□ 对话列表初始为空，没有硬编码假数据
□ 空状态有友好提示文案
□ 收藏分组只在有收藏时显示

【核心功能】
□ ＋ 按钮创建新对话
□ 发第一条消息才真正创建对话（不是打开就创建）
□ 点击对话能切换并加载消息
□ 刷新页面后对话还在

【长按菜单】
□ 收藏/取消收藏正常切换
□ 重命名弹出 Modal，可修改标题
□ 删除弹出确认，确认后移除
□ 移到项目弹出选择器，能选真实项目
□ 选择项目后对话标题下方显示项目名
□ 已归属项目时多显示"可见范围"（toast 占位）

【Artifacts】
□ 点击进入 AI 工具集页面
□ 工具卡片可点击，创建带 system prompt 的对话
□ Coming soon 的工具半透明 + toast

【零死角】
□ 没有任何按钮点击无反应
```