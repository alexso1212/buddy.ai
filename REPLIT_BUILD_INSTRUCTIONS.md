# 🚀 AI Chat App 构建指令书

# 请严格按照 STEP 顺序逐步执行，每完成一个 STEP 后再读取下一个 STEP。

# ⚠️ 不要一次性读取全部内容。完成当前 STEP → 确认无误 → 再继续。

-----

## ⛔ 设计铁律（贯穿全程，任何 STEP 都不得违反）

```
1. 页面背景永远是 #F5F5F0（温暖米色），绝对不能用纯白 #FFFFFF
2. AI 回复永远用衬线字体 font-family: Georgia, 'Noto Serif SC', serif
3. 品牌主色永远是 #AE5630（赤陶橙），绝对不能用蓝色/紫色
4. 用户消息气泡圆角永远 18px，Composer 输入框圆角永远 20px
5. 所有过渡动画使用 cubic-bezier(0.165, 0.85, 0.45, 1)
6. 所有可点击元素触摸热区至少 44×44px
7. 必须同时支持 Light Mode 和 Dark Mode
```

-----

# STEP 1：项目初始化 + Design Tokens

> 📌 本步目标：搭建项目骨架，配置全局设计变量。完成后页面应该显示一个米色背景的空白页面。

### 1.1 技术栈

- React + TypeScript + Vite（或 Next.js）
- Tailwind CSS v3+
- Lucide React（图标库）

### 1.2 Tailwind 配置

在 `tailwind.config.ts` 中添加以下自定义配置：

```js
module.exports = {
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#AE5630',
          hover: '#C4633A',
          light: '#F0DDD4',
          dark: '#8B4526',
        },
        page: {
          light: '#F5F5F0',
          dark: '#2B2A27',
        },
        sidebar: {
          light: '#EEECE7',
          dark: '#242320',
        },
        composer: {
          light: '#FFFFFF',
          dark: '#1F1E1B',
        },
        bubble: {
          light: '#DDD9CE',
          dark: '#393937',
        },
        codeblock: {
          light: '#F7F5F2',
          dark: '#1A1917',
        },
        content: {
          primary: { light: '#1A1A18', dark: '#EEEEEE' },
          secondary: { light: '#6B6A68', dark: '#9A9893' },
        },
      },
      fontFamily: {
        serif: ['Georgia', 'Noto Serif SC', 'Source Han Serif', 'serif'],
        sans: ['-apple-system', 'BlinkMacSystemFont', 'SF Pro Text', 'PingFang SC', 'Helvetica Neue', 'sans-serif'],
        mono: ['SF Mono', 'Fira Code', 'Menlo', 'Consolas', 'monospace'],
      },
      borderRadius: {
        'bubble': '18px',
        'composer': '20px',
        'card': '12px',
        'btn': '8px',
      },
      boxShadow: {
        'composer': '0 4px 20px rgba(0,0,0,0.035)',
        'dropdown': '0 4px 24px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04)',
        'sidebar': '4px 0 24px rgba(0,0,0,0.1)',
      },
      transitionTimingFunction: {
        'brand': 'cubic-bezier(0.165, 0.85, 0.45, 1)',
      },
    },
  },
}
```

### 1.3 全局 CSS 变量

在全局样式文件中添加：

```css
:root {
  --bg-primary: #F5F5F0;
  --bg-sidebar: #EEECE7;
  --bg-composer: #FFFFFF;
  --bg-bubble: #DDD9CE;
  --bg-code: #F7F5F2;
  --text-primary: #1A1A18;
  --text-secondary: #6B6A68;
  --border-subtle: rgba(0, 0, 0, 0.08);
  --overlay: rgba(0, 0, 0, 0.3);
  --brand: #AE5630;
  --brand-hover: #C4633A;
}

.dark {
  --bg-primary: #2B2A27;
  --bg-sidebar: #242320;
  --bg-composer: #1F1E1B;
  --bg-bubble: #393937;
  --bg-code: #1A1917;
  --text-primary: #EEEEEE;
  --text-secondary: #9A9893;
  --border-subtle: rgba(255, 255, 255, 0.08);
  --overlay: rgba(0, 0, 0, 0.5);
}

body {
  background-color: var(--bg-primary);
  color: var(--text-primary);
  font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'PingFang SC', sans-serif;
  -webkit-font-smoothing: antialiased;
}
```

### 1.4 基础布局骨架

创建 `App.tsx` 的基础结构：

```
<div className="h-screen flex flex-col bg-[var(--bg-primary)]">
  {/* 侧边栏 Overlay + Sidebar（后续 STEP 实现）*/}
  {/* TopBar 顶部导航（后续 STEP 实现）*/}
  {/* MessageArea 消息区域（后续 STEP 实现）*/}
  {/* Composer 输入框（后续 STEP 实现）*/}
</div>
```

### ✅ STEP 1 检查清单

- [ ] 页面背景是 `#F5F5F0` 米色（不是纯白）
- [ ] Tailwind 配置文件已包含所有自定义 tokens
- [ ] CSS 变量已定义，`.dark` 类可切换深色模式
- [ ] 安装了 `lucide-react`

> ✅ 确认以上全部通过后，继续 STEP 2。

-----

# STEP 2：侧边栏（Sidebar）

> 📌 本步目标：实现一个从左侧滑入的侧边栏，包含对话历史列表。

### 2.1 组件结构

创建 `Sidebar.tsx` 组件：

```
┌─────────────────────┐
│  [Logo] App名称   ✕  │  ← 顶部：Logo + 名称 + 关闭按钮
├─────────────────────┤
│  🔍 搜索对话...      │  ← 搜索框
├─────────────────────┤
│  TODAY              │  ← 时间分组标题
│  ├ 对话标题 1        │
│  ├ 对话标题 2 ●      │  ← 当前项高亮
│  └ 对话标题 3        │
│                     │
│  YESTERDAY          │
│  └ 对话标题 4        │
│                     │
│  PREVIOUS 7 DAYS    │
│  └ 对话标题 5        │
├─────────────────────┤
│  ⚙ 设置    👤用户名  │  ← 底部固定
└─────────────────────┘
```

### 2.2 详细样式参数

**侧边栏容器：**

- `position: fixed; top: 0; left: 0; bottom: 0;`
- `width: 85vw; max-width: 320px;`
- `background: var(--bg-sidebar);`
- `z-index: 50;`
- `transform: translateX(-100%);` — 默认隐藏
- 打开时 `transform: translateX(0);`
- `transition: transform 300ms cubic-bezier(0.165, 0.85, 0.45, 1);`
- `box-shadow: 4px 0 24px rgba(0,0,0,0.1);` — 仅打开时显示

**遮罩层：**

- `position: fixed; inset: 0;`
- `background: var(--overlay);` — `rgba(0,0,0,0.3)`
- `z-index: 40;`
- `opacity: 0 → 1`，`transition: opacity 300ms;`
- 关闭时 `pointer-events: none; opacity: 0;`
- 点击遮罩触发关闭

**搜索框：**

- 背景：比侧边栏略深 `rgba(0,0,0,0.04)`
- 圆角 `8px`
- 内边距 `8px 12px`
- 左侧搜索图标 `16px`，颜色 `var(--text-secondary)`
- 字号 `14px`
- margin: `12px 16px`

**时间分组标题：**

- 字号 `12px`
- 字重 `600`
- 颜色 `var(--text-secondary)`
- `text-transform: uppercase`
- `letter-spacing: 0.5px`
- padding: `16px 16px 6px 16px`

**对话列表项：**

- 高度 `44px`
- padding: `0 12px`，内部 `padding: 10px 12px`
- margin: `0 8px` — 不贴边
- 圆角 `8px`
- 标题：`15px`，单行，`overflow: hidden; text-overflow: ellipsis; white-space: nowrap;`
- 副标题/预览（可选）：`13px`，`var(--text-secondary)`，单行截断
- **当前选中项**：`background: rgba(0,0,0,0.06);`（Dark: `rgba(255,255,255,0.08)`）
- hover: `background: rgba(0,0,0,0.03);`
- 左滑手势：显示红色「删除」按钮（可选，后续实现）

**底部固定区域：**

- `border-top: 1px solid var(--border-subtle);`
- padding: `12px 16px`
- 设置图标（齿轮）+ 用户头像（28px 圆形）+ 名称

### ✅ STEP 2 检查清单

- [ ] 侧边栏从左侧滑入，动画流畅（300ms）
- [ ] 打开时有半透明遮罩，点击遮罩可关闭
- [ ] 背景色是 `#EEECE7`（不是纯白或纯灰）
- [ ] 对话列表有时间分组标题
- [ ] 当前对话有高亮背景
- [ ] 关闭后侧边栏完全隐藏（不残留阴影）

> ✅ 确认以上全部通过后，继续 STEP 3。

-----

# STEP 3：顶部导航栏（TopBar）

> 📌 本步目标：实现顶部导航栏，连接侧边栏的开关。

### 3.1 结构

```
┌─────────────────────────────────┐
│  ☰        App名称/Logo       ✎  │
└─────────────────────────────────┘
```

### 3.2 样式参数

- 高度 `52px`（不含系统状态栏）
- 背景 `var(--bg-primary)`
- 底部边框 `1px solid var(--border-subtle)`
- padding: `0 16px`
- `display: flex; align-items: center; justify-content: space-between;`

**左侧 — 菜单按钮：**

- Lucide `Menu` 图标，`24px`
- 颜色 `var(--text-primary)`
- 点击 → 打开侧边栏
- 热区 `44×44px`

**中间 — 标题区域：**

- 显示 App 名称 或 模型名称
- 字号 `16px`，字重 `600`
- 可选：左侧放一个小 Logo（16px）

**右侧 — 新建对话按钮：**

- Lucide `SquarePen` 或 `Plus` 图标，`24px`
- 颜色 `var(--text-primary)`
- 点击 → 清空消息，回到欢迎页
- 热区 `44×44px`

### ✅ STEP 3 检查清单

- [ ] 导航栏高度正确，三个区域对齐
- [ ] 菜单按钮可以打开侧边栏
- [ ] 新建按钮可以重置对话
- [ ] Dark Mode 下显示正常

> ✅ 确认以上全部通过后，继续 STEP 4。

-----

# STEP 4：聊天消息区域（MessageArea）

> 📌 本步目标：实现对话消息列表，包含用户消息和 AI 回复两种完全不同的样式。
> ⚠️ 这是整个 App 最核心的部分，AI 回复必须用衬线字体！

### 4.1 消息容器

- `flex: 1; overflow-y: auto;`
- padding: `16px 16px 8px 16px`
- `-webkit-overflow-scrolling: touch;` — iOS 顺滑滚动
- 消息之间间距 `20px`（`gap: 20px` 或 `margin-bottom: 20px`）

### 4.2 用户消息样式

```
                              ┌─────────────────────┐
                              │  用户输入的文字内容    │
                              └─────────────────────┘
```

|属性          |值                                         |
|------------|------------------------------------------|
|对齐          |`align-self: flex-end`（靠右）                |
|背景          |`var(--bg-bubble)` → `#DDD9CE` / `#393937`|
|圆角          |`18px`                                    |
|内边距         |`10px 16px`                               |
|最大宽度        |`85%`                                     |
|字体          |**Sans-serif**（系统默认），`16px`               |
|文字颜色        |`var(--text-primary)`                     |
|`word-break`|`break-word`                              |

### 4.3 AI 回复样式 ⚠️ 最重要

```
🔶 （Logo 小图标）
AI 回复的文字内容，使用衬线字体，
段落之间有 16px 间距，
整体没有背景色，直接显示在米色页面上。
```

|属性  |值                                                    |
|----|-----------------------------------------------------|
|对齐  |`align-self: flex-start`（靠左）                         |
|背景  |**无！透明！** 直接显示在 `#F5F5F0` 页面上                        |
|最大宽度|`100%`                                               |
|字体  |⚠️ **`font-family: Georgia, 'Noto Serif SC', serif;`**|
|字号  |`16px`                                               |
|行高  |`1.65`                                               |
|文字颜色|`var(--text-primary)`                                |
|段落间距|每个 `<p>` 的 `margin-bottom: 16px`                     |

**AI 头像/Logo 图标：**

- 显示在 AI 回复上方
- 你的品牌 Logo，`20×20px`
- 颜色 `#AE5630`
- `margin-bottom: 8px`

**AI 回复中的代码块：**

- 容器背景 `var(--bg-code)` → `#F7F5F2` / `#1A1917`
- 圆角 `8px`
- padding: `16px`
- 字体：`font-mono`，`14px`，`line-height: 1.5`
- 代码块顶部栏：语言名称（左） + 复制按钮（右）
  - 背景 `rgba(0,0,0,0.04)`
  - padding `8px 16px`
  - 字号 `12px`，`var(--text-secondary)`
- `overflow-x: auto;` 水平滚动

**AI 回复中的加粗文字：**

- `font-weight: 600`

**AI 回复中的列表：**

- `padding-left: 20px`
- 列表项间距 `8px`

**AI 回复中的链接：**

- 颜色 `var(--brand)` → `#AE5630`
- `text-decoration: underline`

### 4.4 自动滚动逻辑

```
- 默认行为：新消息出现时，自动滚动到底部
- 用户上滑：检测用户手动上滑 → 暂停自动滚动
- 恢复条件：用户滚回距离底部 100px 以内 → 恢复自动滚动
- 实现方式：监听 scroll 事件，比较 scrollTop + clientHeight 与 scrollHeight
```

### 4.5 消息出现动画

```css
@keyframes messageIn {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.message-enter {
  animation: messageIn 200ms ease-out forwards;
}
```

### 4.6 用于测试的模拟数据

请创建至少 3 组模拟对话数据用于测试显示效果：

- 1 条短的用户消息 + 短的 AI 回复
- 1 条长的用户消息 + 包含代码块的 AI 回复
- 1 条用户消息 + 包含列表、加粗、链接的 AI 回复

### ✅ STEP 4 检查清单

- [ ] ⚠️ AI 回复是 **衬线字体 Georgia**，不是 sans-serif
- [ ] 用户消息右对齐，有米色圆角气泡
- [ ] AI 回复左对齐，没有背景气泡
- [ ] AI 回复上方有品牌 Logo 小图标（#AE5630）
- [ ] 代码块有独立背景、圆角、复制按钮
- [ ] 消息之间间距 20px
- [ ] 页面可以上下顺滑滚动
- [ ] Dark Mode 下所有消息显示正常

> ✅ 确认以上全部通过后，继续 STEP 5。

-----

# STEP 5：Composer 输入框

> 📌 本步目标：实现底部固定的输入框组件。

### 5.1 结构

```
┌────────────────────────────────────┐
│  在这里输入你的问题...               │  ← textarea
│                                    │
│  ┌──┐                      ┌───┐  │
│  │＋│                      │ ▲ │  │  ← 附件按钮 + 发送按钮
│  └──┘                      └───┘  │
└────────────────────────────────────┘
```

### 5.2 样式参数

**外层容器：**

|属性           |值                                                  |
|-------------|---------------------------------------------------|
|定位           |非脱离文档流，在 flex 布局底部                                 |
|margin       |`0 12px 8px 12px`                                  |
|background   |`var(--bg-composer)` → `#FFFFFF` / `#1F1E1B`       |
|border-radius|`20px`                                             |
|border       |`1px solid var(--border-subtle)`                   |
|box-shadow   |`0 4px 20px rgba(0,0,0,0.035)`                     |
|padding      |`0` — 由内部元素各自设置                                    |
|底部安全区        |`padding-bottom: env(safe-area-inset-bottom)` 加在最外层|

**Textarea 输入区域：**

|属性               |值                             |
|-----------------|------------------------------|
|min-height       |`40px`                        |
|max-height       |`120px`                       |
|padding          |`12px 16px`                   |
|font-size        |`16px` ⚠️ 必须 ≥16px 防止 iOS 自动缩放 |
|font-family      |sans-serif（不是衬线体）             |
|background       |透明                            |
|border           |无                             |
|outline          |无                             |
|resize           |`none`                        |
|color            |`var(--text-primary)`         |
|placeholder      |“有什么可以帮你的吗？”                  |
|placeholder-color|`var(--text-secondary)`       |
|自动增高             |内容增多时高度自动增加到 max-height，然后变为滚动|

**底部工具栏：**

|属性     |值                                                            |
|-------|-------------------------------------------------------------|
|布局     |`flex`，`justify-content: space-between`，`align-items: center`|
|padding|`4px 12px 10px 12px`                                         |

**附件按钮（＋）：**

|属性           |值                                              |
|-------------|-----------------------------------------------|
|尺寸           |`32×32px`，热区 `44×44px`                         |
|background   |透明                                             |
|border       |`1px solid var(--border-subtle)`               |
|border-radius|`8px`                                          |
|图标           |Lucide `Plus`，`18px`，颜色 `var(--text-secondary)`|
|hover        |`background: var(--bg-primary)`                |

**发送按钮（▲）：**

|属性           |值                                           |
|-------------|--------------------------------------------|
|尺寸           |`32×32px`，热区 `44×44px`                      |
|background   |`#AE5630`                                   |
|hover        |`#C4633A`                                   |
|border-radius|`8px`                                       |
|图标           |Lucide `ArrowUp`，`18px`，颜色 `#FFFFFF`        |
|按下           |`transform: scale(0.98); transition: 150ms;`|
|**禁用态**（输入为空）|`opacity: 0.4; pointer-events: none;`       |

### 5.3 键盘适配

- 使用 `visualViewport` API 或 CSS `env(keyboard-inset-height)` 检测键盘
- 键盘弹出时确保 Composer 在键盘上方可见
- 页面消息区域高度相应减少

### ✅ STEP 5 检查清单

- [ ] 输入框固定在底部，不被消息列表遮挡
- [ ] 圆角 20px，阴影极淡
- [ ] 发送按钮是橙色 `#AE5630`
- [ ] 输入框为空时发送按钮为禁用态（半透明）
- [ ] textarea 可以自动增高
- [ ] 在 iOS 上字号 ≥ 16px（不会触发自动缩放）
- [ ] Dark Mode 显示正常
- [ ] 底部有 Safe Area 适配

> ✅ 确认以上全部通过后，继续 STEP 6。

-----

# STEP 6：欢迎页（空状态）

> 📌 本步目标：没有对话消息时显示欢迎页面。

### 6.1 结构

```
            [Logo 图标]
             64×64px
          颜色 #AE5630

      "有什么可以帮你的吗？"
     Georgia serif, 24px, 600

   ┌──────────┐  ┌──────────┐
   │ 帮我写一份  │  │ 解释量子    │
   │ 周报       │  │ 计算的原理  │
   └──────────┘  └──────────┘
   ┌──────────┐  ┌──────────┐
   │ 翻译这段    │  │ 给我推荐    │
   │ 英文       │  │ 几本好书    │
   └──────────┘  └──────────┘
```

### 6.2 样式

**整体：**

- `flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center;`
- padding: `0 24px`
- 内容整体偏上（`padding-bottom: 80px` 或 `margin-top: -40px`）

**Logo：**

- 尺寸 `64×64px`
- 使用品牌 Logo 图片，或纯色 `#AE5630` 的 SVG 版本
- `margin-bottom: 20px`

**标题文字：**

- “有什么可以帮你的吗？”
- `font-family: Georgia, serif;` ⚠️ 衬线字体
- `font-size: 24px; font-weight: 600;`
- `color: var(--text-primary);`
- `margin-bottom: 32px;`

**建议提示卡片 Grid：**

- `display: grid; grid-template-columns: 1fr 1fr; gap: 8px;`
- `max-width: 360px; width: 100%;`

**单个提示卡片：**

|属性           |值                                           |
|-------------|--------------------------------------------|
|background   |`var(--bg-composer)` → `#FFFFFF` / `#1F1E1B`|
|border       |`1px solid var(--border-subtle)`            |
|border-radius|`12px`                                      |
|padding      |`14px 16px`                                 |
|font-size    |`14px`                                      |
|font-family  |sans-serif                                  |
|color        |`var(--text-primary)`                       |
|cursor       |pointer                                     |
|hover        |`background: #F5F5F0` (Light) / 微亮          |
|active       |`transform: scale(0.98); transition: 150ms;`|
|点击行为         |将卡片文字填入 Composer，自动发送                       |

### 6.3 显示逻辑

- `messages.length === 0` → 显示欢迎页
- `messages.length > 0` → 隐藏欢迎页，显示消息列表
- 点击 TopBar 右侧新建按钮 → 清空消息 → 重新显示欢迎页

### ✅ STEP 6 检查清单

- [ ] 空对话时显示欢迎页，有对话后消失
- [ ] Logo 显示正确，颜色 `#AE5630`
- [ ] 标题是衬线字体
- [ ] 4 个建议提示卡片排列整齐（2×2）
- [ ] 点击提示卡片可以触发对话

> ✅ 确认以上全部通过后，继续 STEP 7。

-----

# STEP 7：交互逻辑 + 对话功能

> 📌 本步目标：串联所有组件，实现完整的对话交互流程。

### 7.1 状态管理

```typescript
interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  updatedAt: Date;
}

// 核心状态
const [conversations, setConversations] = useState<Conversation[]>([]);
const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
const [sidebarOpen, setSidebarOpen] = useState(false);
const [inputValue, setInputValue] = useState('');
const [isGenerating, setIsGenerating] = useState(false);
```

### 7.2 发送消息流程

```
用户输入 → 点击发送按钮或按 Enter
  → 将用户消息添加到当前对话
  → 清空输入框
  → 显示 AI loading 状态（三个脉冲圆点）
  → 调用 AI API
  → 逐步显示 AI 回复（流式响应）或一次性显示
  → AI 回复完成
  → 自动滚动到底部
  → 更新侧边栏对话列表（标题用第一条消息截断）
```

### 7.3 AI Loading 动画

当 AI 正在生成回复时，显示加载指示器：

```
🔶
● ● ●  ← 三个圆点依次脉冲
```

- Logo 图标（20px，#AE5630）在上方
- 三个圆点：`6px` 圆形，颜色 `var(--text-secondary)`
- 依次放大缩小，间隔 `150ms`
- 动画循环直到回复开始

### 7.4 新建对话

- 点击 TopBar 右侧按钮
- 如果当前对话不为空 → 保存到对话列表
- 清空消息 → 显示欢迎页
- 关闭侧边栏（如果开着）

### 7.5 切换对话

- 在侧边栏点击某个对话
- 加载该对话的消息
- 关闭侧边栏
- 滚动到消息底部

### 7.6 Dark Mode 切换

- 在侧边栏设置区域添加 Dark Mode 开关
- 切换时 toggle `<html>` 的 `dark` class
- 保存到 localStorage

### ✅ STEP 7 检查清单

- [ ] 可以发送消息并收到（模拟的）AI 回复
- [ ] 发送时显示 loading 动画
- [ ] 对话自动保存到侧边栏列表
- [ ] 可以切换不同对话
- [ ] 可以新建对话
- [ ] Dark Mode 开关正常工作
- [ ] 整体交互流畅

> ✅ 确认以上全部通过后，继续 STEP 8。

-----

# STEP 8：最终打磨

> 📌 本步目标：全面检查和优化细节。

### 8.1 强制检查（再确认一次设计铁律）

请逐项检查并修复：

```
□ 页面背景是 #F5F5F0（查看实际渲染色值，不是代码里写了就行）
□ AI 回复文字是 serif 衬线字体（视觉上明显不同于 UI 文字）
□ 发送按钮和 Logo 图标颜色是 #AE5630 橙色
□ 没有任何元素使用了蓝色/紫色作为主色
□ 用户气泡圆角 18px，Composer 圆角 20px
□ Dark Mode 下所有组件正确切换
```

### 8.2 移动端适配

```
□ iOS Safe Area 适配（顶部状态栏 + 底部 Home Indicator）
□ 键盘弹出时 Composer 可见
□ 字号 ≥ 16px（防止 iOS Safari 缩放）
□ 触摸热区 ≥ 44×44px
□ 滚动顺滑（momentum scrolling）
□ 没有横向溢出
```

### 8.3 动画优化

```
□ 侧边栏滑入/滑出流畅（300ms，ease-brand）
□ 消息出现有 fade-in + translateY 动画
□ 按钮按下有 scale(0.98) 反馈
□ 没有掉帧或卡顿
□ 所有 transition 使用 GPU 加速的属性（transform, opacity）
```

### 8.4 可选增强

以下功能可以提升体验，但不是必须的：

- 侧边栏支持从屏幕左边缘右滑手势打开
- 消息长按弹出操作菜单（复制、删除）
- 对话列表左滑显示删除按钮
- Composer 支持 Shift+Enter 换行，Enter 发送
- 代码块的复制按钮点击后显示 “已复制” 反馈
- 欢迎页 Logo 有微妙的呼吸/脉冲动画
- 页面间跳转有过渡动画

### ✅ STEP 8 最终检查清单

- [ ] 所有设计铁律均已遵守
- [ ] Light/Dark 两个模式视觉完美
- [ ] 移动端适配完善
- [ ] 动画流畅无卡顿
- [ ] 对话功能完整可用
- [ ] 代码整洁，组件结构清晰

-----

# 🎉 完成！

如果所有 STEP 的检查清单都通过了，这个 App 应该已经具备了 Claude iOS 风格的核心视觉和交互体验。

**三个最能体现 Claude 风格的特征再次提醒：**

1. `#F5F5F0` 米色背景（不是纯白）
1. AI 回复用 `Georgia, serif` 衬线字体（不是 sans-serif）
1. `#AE5630` 赤陶橙品牌色（不是蓝色）

如果 Replit 在任何步骤中把这三个搞错了，请立即纠正再继续。