# 🚀 Buddy App UI 全面修复指令

# ⚠️ 请严格按 STEP 顺序执行，每完成一个 STEP 停下来让我检查，确认后再继续下一个。

# ⚠️ 不要一次性执行所有 STEP，不要跳步。

-----

## ⛔ 铁律（每个 STEP 都必须遵守，违反立即修正）

```
1. App 名称 = "Buddy"，所有显示 "德湃" 的地方改为 "Buddy"
2. 页面背景 = #2B2A27（暖深棕），绝不能用纯黑或冷灰
3. AI 回复字体 = Georgia, 'Noto Serif SC', serif（衬线体）
4. 品牌色 = #AE5630（赤陶橙），绝不能用蓝色/紫色
5. 所有动画 = cubic-bezier(0.165, 0.85, 0.45, 1)
6. 触摸热区 ≥ 44×44px
```

-----

# STEP 1：全局基础修复（背景色 + 字体 + CSS 变量）

> 📌 目标：修正整体色调和字体配置，奠定正确的视觉基调。

### 1.1 修正全局 CSS 变量

请替换或新建全局 CSS 变量如下，确保 Dark Mode 生效：

```css
:root {
  /* 字体 */
  --font-serif: Georgia, 'Noto Serif SC', 'Source Han Serif SC', 'Songti SC', serif;
  --font-sans: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'PingFang SC', 'Helvetica Neue', sans-serif;
  --font-mono: 'SF Mono', 'Fira Code', Menlo, Consolas, monospace;
}

/* Dark Mode（当前主要模式） */
:root, .dark {
  --bg-primary: #2B2A27;
  --bg-sidebar: #2B2A27;
  --bg-composer: #3C3B37;
  --bg-bubble: #393937;
  --bg-code: #1A1917;
  --bg-code-header: #2B2A27;
  --text-primary: #ECECEC;
  --text-secondary: #9A9893;
  --text-placeholder: #7A7874;
  --text-bright: #FFFFFF;
  --border-subtle: rgba(255, 255, 255, 0.06);
  --border-medium: rgba(255, 255, 255, 0.12);
  --overlay: rgba(0, 0, 0, 0.4);
  --brand: #AE5630;
  --brand-hover: #C4633A;
  --brand-icon: #C4703F;
  --sidebar-active: rgba(255, 255, 255, 0.08);
  --sidebar-hover: rgba(255, 255, 255, 0.04);
  --section-title: #C4703F;
}

/* Light Mode */
.light {
  --bg-primary: #F5F5F0;
  --bg-sidebar: #F5F5F0;
  --bg-composer: #FFFFFF;
  --bg-bubble: #DDD9CE;
  --bg-code: #F7F5F2;
  --bg-code-header: #EEECE7;
  --text-primary: #1A1A18;
  --text-secondary: #6B6A68;
  --text-placeholder: #9A9893;
  --text-bright: #000000;
  --border-subtle: rgba(0, 0, 0, 0.08);
  --border-medium: rgba(0, 0, 0, 0.15);
  --overlay: rgba(0, 0, 0, 0.3);
  --brand: #AE5630;
  --brand-hover: #C4633A;
  --brand-icon: #AE5630;
  --sidebar-active: rgba(0, 0, 0, 0.06);
  --sidebar-hover: rgba(0, 0, 0, 0.03);
  --section-title: #AE5630;
}

body {
  background-color: var(--bg-primary);
  color: var(--text-primary);
  font-family: var(--font-sans);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
```

### 1.2 修正页面背景

查找所有 `background` 相关样式，确保主页面背景色是 `var(--bg-primary)` 即 `#2B2A27`。
如果看到 `#000000`、`#1a1a1a`、`#121212`、`#171717` 或任何偏冷的深色，全部替换为 `#2B2A27`。

### 1.3 全局 App 名称替换

将所有出现 “德湃” 的地方替换为 “Buddy”。包括：

- 顶栏标题
- 侧边栏标题
- 页面 `<title>`
- 任何其他位置

### ✅ STEP 1 检查点

```
□ 页面背景是暖深棕 #2B2A27，不是纯黑/冷灰
□ CSS 变量全部就位
□ 所有 "德湃" 已改为 "Buddy"
```

> ✅ 等我确认后再继续 STEP 2。

-----

# STEP 2：Markdown 渲染修复

> 📌 目标：AI 回复不再显示 ### ** - 等原始 Markdown 符号，正确渲染为格式化内容。
> ⚠️ 这是当前最严重的 bug。

### 2.1 安装依赖

```bash
npm install react-markdown remark-gfm
```

### 2.2 创建 AI 消息渲染组件

创建一个专门的组件来渲染 AI 回复，用 `react-markdown` 解析内容：

```jsx
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

function AIMessageContent({ content }) {
  return (
    <div style={{
      fontFamily: "Georgia, 'Noto Serif SC', 'Source Han Serif SC', serif",
      fontSize: '16px',
      lineHeight: '1.65',
      letterSpacing: '0.02em',
      color: 'var(--text-primary)',
    }}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // 段落
          p: ({ children }) => (
            <p style={{ marginBottom: 16, marginTop: 0 }}>{children}</p>
          ),

          // 标题
          h1: ({ children }) => (
            <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-bright)', margin: '28px 0 14px', fontFamily: 'inherit' }}>{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 style={{ fontSize: 19, fontWeight: 700, color: 'var(--text-bright)', margin: '24px 0 12px', fontFamily: 'inherit' }}>{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-bright)', margin: '24px 0 12px', fontFamily: 'inherit' }}>{children}</h3>
          ),

          // 加粗
          strong: ({ children }) => (
            <strong style={{ fontWeight: 700, color: 'var(--text-bright)' }}>{children}</strong>
          ),

          // 斜体
          em: ({ children }) => (
            <em style={{ fontStyle: 'italic' }}>{children}</em>
          ),

          // 无序列表
          ul: ({ children }) => (
            <ul style={{ paddingLeft: 20, marginBottom: 16, marginTop: 0 }}>{children}</ul>
          ),

          // 有序列表
          ol: ({ children }) => (
            <ol style={{ paddingLeft: 20, marginBottom: 16, marginTop: 0 }}>{children}</ol>
          ),

          // 列表项
          li: ({ children }) => (
            <li style={{ marginBottom: 8, color: 'var(--text-primary)' }}>{children}</li>
          ),

          // 链接
          a: ({ children, href }) => (
            <a href={href} style={{ color: 'var(--brand-icon)', textDecoration: 'underline' }}>{children}</a>
          ),

          // 引用块
          blockquote: ({ children }) => (
            <blockquote style={{
              borderLeft: '3px solid var(--brand)',
              paddingLeft: 16,
              margin: '16px 0',
              color: 'var(--text-secondary)',
              fontStyle: 'italic',
            }}>{children}</blockquote>
          ),

          // 代码（行内 + 代码块）
          code: ({ inline, children, className }) => {
            if (inline) {
              return (
                <code style={{
                  background: 'var(--bg-code)',
                  borderRadius: 4,
                  padding: '2px 6px',
                  fontFamily: "var(--font-mono)",
                  fontSize: 14,
                  color: '#E8C89A',
                }}>{children}</code>
              );
            }
            const language = className ? className.replace('language-', '') : 'code';
            return (
              <div style={{
                background: 'var(--bg-code)',
                borderRadius: 8,
                overflow: 'hidden',
                margin: '16px 0',
              }}>
                <div style={{
                  background: 'var(--bg-code-header)',
                  padding: '8px 12px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)' }}>{language}</span>
                  <button style={{
                    fontSize: 12, color: 'var(--text-secondary)',
                    background: 'none', border: 'none', cursor: 'pointer',
                    fontFamily: 'var(--font-sans)',
                  }}>Copy</button>
                </div>
                <pre style={{ padding: '14px 16px', margin: 0, overflowX: 'auto' }}>
                  <code style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 13.5,
                    lineHeight: 1.55,
                    color: 'var(--text-primary)',
                  }}>{children}</code>
                </pre>
              </div>
            );
          },

          // 水平线
          hr: () => (
            <hr style={{ border: 'none', borderTop: '1px solid var(--border-subtle)', margin: '24px 0' }} />
          ),

          // 表格
          table: ({ children }) => (
            <div style={{ overflowX: 'auto', margin: '16px 0' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>{children}</table>
            </div>
          ),
          th: ({ children }) => (
            <th style={{ borderBottom: '2px solid var(--border-medium)', padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: 'var(--text-bright)' }}>{children}</th>
          ),
          td: ({ children }) => (
            <td style={{ borderBottom: '1px solid var(--border-subtle)', padding: '8px 12px' }}>{children}</td>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
```

### 2.3 替换现有 AI 消息渲染

找到当前渲染 AI 回复的地方，把直接显示 `{message.content}` 的代码替换为：

```jsx
<AIMessageContent content={message.content} />
```

### ✅ STEP 2 检查点

```
□ AI 回复中 ###、**、- 等符号不再直接显示
□ 标题渲染为更大更粗的文字
□ 加粗文字比正文更亮（#FFFFFF）
□ 列表有缩进和圆点/序号
□ 代码块有深色背景、顶部语言标签、Copy 按钮
□ 表格正确渲染
```

> ✅ 等我确认后再继续 STEP 3。

-----

# STEP 3：AI 回复样式 + 用户消息样式

> 📌 目标：AI 回复用衬线字体、无背景；用户消息用无衬线、有气泡。

### 3.1 AI 回复完整样式

```jsx
function AIMessage({ content }) {
  return (
    <div style={{ alignSelf: 'flex-start', maxWidth: '100%', marginBottom: 24 }}>
      {/* Logo 图标 */}
      <img
        src="/logo.png"  /* 替换为你的 Logo 路径 */
        alt="Buddy"
        style={{
          width: 20, height: 20,
          marginBottom: 8,
          /* 如果需要改 Logo 颜色为橙色，用 CSS filter */
        }}
      />
      {/* 消息内容 — 衬线字体渲染 */}
      <AIMessageContent content={content} />
    </div>
  );
}
```

关键点：

- 无背景色（透明，直接显示在 #2B2A27 页面上）
- 衬线字体 Georgia
- 上方有 Logo 图标 20px，颜色 #C4703F

### 3.2 用户消息完整样式

```jsx
function UserMessage({ content }) {
  return (
    <div style={{
      alignSelf: 'flex-end',
      maxWidth: '82%',
      background: 'var(--bg-bubble)',  /* #393937 */
      borderRadius: 18,
      padding: '10px 14px',
      marginBottom: 24,
      fontFamily: 'var(--font-sans)',
      fontSize: 16,
      lineHeight: 1.5,
      color: 'var(--text-primary)',
      wordBreak: 'break-word',
    }}>
      {content}
    </div>
  );
}
```

### 3.3 消息列表容器

```jsx
<div style={{
  flex: 1,
  overflowY: 'auto',
  padding: '16px 16px',
  display: 'flex',
  flexDirection: 'column',
  WebkitOverflowScrolling: 'touch',
}}>
  {messages.map(msg =>
    msg.role === 'user'
      ? <UserMessage key={msg.id} content={msg.content} />
      : <AIMessage key={msg.id} content={msg.content} />
  )}
</div>
```

### ✅ STEP 3 检查点

```
□ AI 回复是衬线字体 Georgia（视觉上与用户消息明显不同）
□ AI 回复无背景，直接显示在页面暖棕背景上
□ AI 回复上方有 Logo 图标（20px，#C4703F）
□ 用户消息右对齐，有 #393937 背景气泡，圆角 18px
□ 消息间距 24px
□ 消息区域可顺滑滚动
```

> ✅ 等我确认后再继续 STEP 4。

-----

# STEP 4：Composer 输入框修复

> 📌 目标：输入框改为大圆角、暖灰背景、方形橙色发送按钮。

### 4.1 完整 Composer 结构和样式

```jsx
function Composer({ value, onChange, onSend, onAttach }) {
  const isEmpty = !value || value.trim() === '';

  return (
    <div style={{
      margin: '0 12px 8px 12px',
      paddingBottom: 'env(safe-area-inset-bottom)',
    }}>
      <div style={{
        background: 'var(--bg-composer)',     /* #3C3B37 — 比页面亮一级 */
        borderRadius: 20,
        border: '1px solid var(--border-subtle)',
        boxShadow: '0 2px 12px rgba(0,0,0,0.2)',
        overflow: 'hidden',
      }}>
        {/* 输入区域 */}
        <textarea
          value={value}
          onChange={onChange}
          placeholder="输入消息..."
          rows={1}
          style={{
            width: '100%',
            minHeight: 36,
            maxHeight: 120,
            padding: '14px 16px 8px 16px',
            fontSize: 16,          /* ⚠️ ≥16px 防 iOS 缩放 */
            fontFamily: 'var(--font-sans)',
            lineHeight: 1.5,
            color: 'var(--text-primary)',
            background: 'transparent',
            border: 'none',
            outline: 'none',
            resize: 'none',
            display: 'block',
          }}
        />

        {/* 底部工具栏 */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '4px 10px 10px 10px',
        }}>
          {/* 附件按钮 */}
          <button
            onClick={onAttach}
            style={{
              width: 30, height: 30,
              background: 'transparent',
              border: '1px solid var(--border-medium)',  /* rgba(255,255,255,0.12) */
              borderRadius: 8,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
              color: 'var(--text-secondary)',
            }}
          >
            {/* Lucide Plus 图标, 16px */}
            <PlusIcon size={16} />
          </button>

          {/* 发送按钮 */}
          <button
            onClick={onSend}
            disabled={isEmpty}
            style={{
              width: 30, height: 30,
              background: 'var(--brand)',           /* #AE5630 */
              borderRadius: 8,                      /* 方形圆角，不是圆形！ */
              border: 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: isEmpty ? 'default' : 'pointer',
              opacity: isEmpty ? 0.35 : 1,
              transition: 'opacity 150ms, transform 100ms',
            }}
            onMouseDown={e => e.currentTarget.style.transform = 'scale(0.95)'}
            onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
          >
            {/* Lucide ArrowUp 图标, 16px, 白色 */}
            <ArrowUpIcon size={16} color="#FFFFFF" strokeWidth={2.5} />
          </button>
        </div>
      </div>
    </div>
  );
}
```

### ✅ STEP 4 检查点

```
□ 输入框容器圆角 20px
□ 输入框背景 #3C3B37（比页面背景 #2B2A27 亮一级，不是同色）
□ 发送按钮是 30x30 方形圆角(8px)，橙色 #AE5630，不是圆形
□ 发送按钮禁用态（空输入）opacity 0.35
□ 附件按钮透明背景 + 淡边框
□ textarea 字号 ≥ 16px
□ 底部有 Safe Area 适配
```

> ✅ 等我确认后再继续 STEP 5。

-----

# STEP 5：侧边栏完全重做

> 📌 目标：把当前项目管理风格的侧边栏改成 Claude 聊天列表风格。

### 5.1 需要删除的元素

```
❌ "德湃任务中心" 标题和红色方块图标
❌ 仪表盘、图谱、助手、项目、任务、团队、通知、设置 这些导航项
❌ "助手" 项的绿色/橙色高亮背景条
❌ 右上角 ✕ 关闭按钮
❌ 底部 浅色/深色/系统 主题切换按钮条
❌ "(Owner)" 角色标签
```

### 5.2 新的侧边栏结构

```jsx
function Sidebar({ isOpen, onClose, conversations, activeId, onSelect, onNewChat, user }) {
  return (
    <>
      {/* 遮罩 */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 40,
          background: 'var(--overlay)',     /* rgba(0,0,0,0.4) */
          opacity: isOpen ? 1 : 0,
          pointerEvents: isOpen ? 'auto' : 'none',
          transition: 'opacity 300ms ease',
        }}
      />

      {/* 侧边栏本体 */}
      <aside style={{
        position: 'fixed', top: 0, left: 0, bottom: 0,
        width: '82vw', maxWidth: 340,
        background: 'var(--bg-sidebar)',    /* #2B2A27 */
        zIndex: 50,
        transform: isOpen ? 'translateX(0)' : 'translateX(-100%)',
        transition: 'transform 300ms cubic-bezier(0.165, 0.85, 0.45, 1)',
        display: 'flex', flexDirection: 'column',
        paddingTop: 'env(safe-area-inset-top)',
      }}>

        {/* ---- 顶部：App 名称 ---- */}
        <div style={{
          padding: '20px 20px 24px 20px',
          flexShrink: 0,
        }}>
          <h1 style={{
            fontFamily: "Georgia, 'Noto Serif SC', serif",  /* ⚠️ 衬线体 */
            fontSize: 28,
            fontWeight: 700,
            color: 'var(--text-primary)',   /* #ECECEC */
            margin: 0,
          }}>Buddy</h1>
        </div>

        {/* ---- 对话列表（可滚动） ---- */}
        <div style={{
          flex: 1, overflowY: 'auto',
          WebkitOverflowScrolling: 'touch',
        }}>

          {/* 收藏分组 */}
          <div style={{
            fontSize: 14, fontWeight: 500,
            color: 'var(--section-title)',    /* #C4703F 橙色 */
            padding: '16px 20px 8px 20px',
            fontFamily: 'var(--font-sans)',
          }}>收藏</div>

          {/* 收藏的对话 */}
          {conversations.filter(c => c.starred).map(conv => (
            <div
              key={conv.id}
              onClick={() => { onSelect(conv.id); onClose(); }}
              style={{
                padding: '12px 16px',
                margin: '0 8px 2px 8px',
                borderRadius: 10,
                cursor: 'pointer',
                background: conv.id === activeId ? 'var(--sidebar-active)' : 'transparent',
                fontSize: 15.5,
                fontFamily: 'var(--font-sans)',
                color: 'var(--text-primary)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                transition: 'background 150ms',
              }}
            >
              {conv.title}
            </div>
          ))}

          {/* 最近对话分组 */}
          <div style={{
            fontSize: 14, fontWeight: 500,
            color: 'var(--section-title)',    /* #C4703F 橙色 */
            padding: '20px 20px 8px 20px',
            fontFamily: 'var(--font-sans)',
          }}>最近对话</div>

          {/* 最近的对话列表 */}
          {conversations.filter(c => !c.starred).map(conv => (
            <div
              key={conv.id}
              onClick={() => { onSelect(conv.id); onClose(); }}
              style={{
                padding: '12px 16px',
                margin: '0 8px 2px 8px',
                borderRadius: 10,
                cursor: 'pointer',
                background: conv.id === activeId ? 'var(--sidebar-active)' : 'transparent',
                fontSize: 15.5,
                fontFamily: 'var(--font-sans)',
                color: 'var(--text-primary)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                transition: 'background 150ms',
              }}
            >
              {conv.title}
            </div>
          ))}
        </div>

        {/* ---- 底部：用户 + 新建按钮 ---- */}
        <div style={{
          padding: '12px 20px',
          paddingBottom: 'calc(12px + env(safe-area-inset-bottom))',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          {/* 用户信息 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%',
              background: '#4A4A47',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 14, fontWeight: 600, color: '#ECECEC',
            }}>
              {user.name.charAt(0).toUpperCase()}
            </div>
            <span style={{
              fontSize: 15, color: 'var(--text-primary)',
              fontFamily: 'var(--font-sans)',
            }}>{user.name}</span>
          </div>

          {/* 新建对话按钮 */}
          <button
            onClick={() => { onNewChat(); onClose(); }}
            style={{
              width: 40, height: 40, borderRadius: '50%',
              background: 'var(--brand)',      /* #AE5630 */
              border: 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
              transition: 'transform 100ms',
            }}
            onMouseDown={e => e.currentTarget.style.transform = 'scale(0.95)'}
            onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
          >
            <PlusIcon size={20} color="#FFFFFF" />
          </button>
        </div>

      </aside>
    </>
  );
}
```

### ✅ STEP 5 检查点

```
□ 顶部显示 "Buddy"，衬线字体 Georgia，28px，Bold
□ 没有 ✕ 关闭按钮（靠点遮罩关闭）
□ 没有仪表盘/图谱/项目/任务等导航项
□ 没有主题切换条
□ 对话分组标题 "收藏" "最近对话" 是橙色 #C4703F
□ 选中对话背景 rgba(255,255,255,0.08)，圆角 10px
□ 底部：圆形头像 + 用户名 + 圆形橙色新建按钮(40px)
□ 侧边栏背景 #2B2A27
□ 遮罩 rgba(0,0,0,0.4)，点击可关闭
□ 滑入动画 300ms 流畅
```

> ✅ 等我确认后再继续 STEP 6。

-----

# STEP 6：顶部导航栏修复

> 📌 目标：顶栏简洁，分隔线极淡。

```jsx
<header style={{
  height: 54,
  padding: '0 20px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  borderBottom: '1px solid var(--border-subtle)',   /* 极淡分隔线 */
  background: 'var(--bg-primary)',
  flexShrink: 0,
}}>
  {/* 左：菜单按钮 */}
  <button onClick={openSidebar} style={{
    width: 44, height: 44,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'none', border: 'none', cursor: 'pointer',
  }}>
    <MenuIcon size={24} color="var(--text-primary)" strokeWidth={1.5} />
  </button>

  {/* 中：App 名称 */}
  <span style={{
    fontSize: 17, fontWeight: 600,
    color: 'var(--text-primary)',
    fontFamily: 'var(--font-sans)',
  }}>Buddy</span>

  {/* 右：新建对话 */}
  <button onClick={newChat} style={{
    width: 44, height: 44,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'none', border: 'none', cursor: 'pointer',
  }}>
    <SquarePenIcon size={22} color="var(--text-primary)" strokeWidth={1.5} />
  </button>
</header>
```

### ✅ STEP 6 检查点

```
□ 顶栏显示 "Buddy"，17px，600 字重
□ 底部分隔线极淡（几乎看不见），不是粗线
□ 左侧菜单按钮可打开侧边栏
□ 右侧新建按钮可重置对话
```

> ✅ 等我确认后再继续 STEP 7。

-----

# STEP 7：AI Loading 动画

> 📌 目标：AI 思考时显示 Logo + 旋转渐变光圈 + 脉冲圆点。

### 7.1 Loading 组件

```jsx
function AILoading() {
  return (
    <div style={{
      alignSelf: 'flex-start',
      marginBottom: 24,
    }}>
      {/* Logo + 旋转光圈 */}
      <div style={{
        position: 'relative',
        width: 32, height: 32,
        marginBottom: 10,
      }}>
        {/* 渐变旋转光圈 */}
        <svg width="32" height="32" viewBox="0 0 32 32"
          style={{ animation: 'buddySpin 1.2s linear infinite', position: 'absolute' }}>
          <defs>
            <linearGradient id="loadingGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#AE5630" stopOpacity="1" />
              <stop offset="100%" stopColor="#AE5630" stopOpacity="0" />
            </linearGradient>
          </defs>
          <circle cx="16" cy="16" r="14" fill="none"
            stroke="url(#loadingGrad)" strokeWidth="2"
            strokeDasharray="66 22" strokeLinecap="round" />
        </svg>

        {/* Logo 居中 */}
        <img src="/logo.png" alt=""
          style={{
            width: 20, height: 20,
            position: 'absolute',
            top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
          }}
        />
      </div>

      {/* 脉冲圆点 */}
      <div style={{ display: 'flex', gap: 6 }}>
        {[0, 1, 2].map(i => (
          <span key={i} style={{
            width: 6, height: 6, borderRadius: '50%',
            background: 'var(--text-secondary)',
            animation: `buddyDotPulse 1.4s ease-in-out ${i * 0.15}s infinite`,
          }} />
        ))}
      </div>
    </div>
  );
}
```

### 7.2 动画 CSS

在全局样式中添加：

```css
@keyframes buddySpin {
  to { transform: rotate(360deg); }
}

@keyframes buddyDotPulse {
  0%, 80%, 100% {
    opacity: 0.3;
    transform: scale(0.8);
  }
  40% {
    opacity: 1;
    transform: scale(1);
  }
}
```

### 7.3 使用逻辑

```jsx
{/* 在消息列表末尾 */}
{isGenerating && <AILoading />}
```

当收到 AI 第一个 token 后，`isGenerating` 设为 false，Loading 消失，AI 回复组件接管显示。

### ✅ STEP 7 检查点

```
□ AI 思考时显示 Logo + 旋转渐变光圈
□ 下方有三个脉冲圆点
□ 光圈旋转流畅（1.2s 一圈）
□ 圆点依次脉冲（间隔 0.15s）
□ 收到回复后 Loading 消失，AI 回复正常显示
```

> ✅ 等我确认后再继续 STEP 8。

-----

# STEP 8：最终打磨

> 📌 目标：全面检查，修复遗漏。

请逐项检查并修复：

### 8.1 强制复查铁律

```
□ 页面背景 #2B2A27 暖深棕（不是纯黑/冷灰）
□ AI 回复是衬线字体 Georgia（不是 sans-serif）
□ 品牌色 #AE5630 橙色（不是蓝色/紫色）
□ Markdown 正确渲染（无原始符号暴露）
□ 所有显示 "德湃" 的地方都已改为 "Buddy"
```

### 8.2 细节优化

```
□ 消息出现动画：opacity 0→1 + translateY 8px→0，200ms ease-out
□ 新消息自动滚动到底部
□ 用户上滑后暂停自动滚动
□ Composer 支持 Enter 发送、Shift+Enter 换行
□ 代码块 Copy 按钮点击后显示 "已复制" 反馈（1.5s 后恢复）
□ 侧边栏支持从屏幕左边缘右滑手势打开（可选）
□ 消息长按弹出菜单：复制、重新生成（可选）
```

### 8.3 移动端适配

```
□ iOS Safe Area（顶部状态栏 + 底部 Home Indicator）
□ 键盘弹出时 Composer 上移可见
□ 字号 ≥ 16px（防 iOS Safari 缩放）
□ 触摸热区 ≥ 44×44px
□ 无横向溢出
□ 滚动顺滑
```

### ✅ STEP 8 最终检查

```
□ 所有铁律通过
□ 所有组件在 Dark Mode 下正常显示
□ 动画流畅无卡顿
□ 对话功能完整可用
□ 代码整洁
```

-----

# 🎉 完成！

执行完 8 个 STEP 后，Buddy App 应该具备 Claude iOS 的核心视觉和交互体验。

**最容易出错的三件事，收到结果后优先检查：**

1. AI 回复是不是衬线字体？（看起来和用户消息字体应该明显不同）
1. 背景色是不是暖棕色？（不能偏冷/偏黑）
1. Markdown 是不是正确渲染了？（不能看到 ### ** - 符号）