# Buddy 侧边栏重新设计规格书

# 融合企业管理 + Claude 风格 AI 助手

# 请严格按 STEP 顺序执行

-----

## ⛔ 铁律

```
1. 品牌名 = "Buddy"，衬线体 Georgia，28px，700
2. 所有颜色偏暖，主色 #AE5630
3. 背景 #2B2A27
4. 侧边栏支持手势拖拉开关 + 弹性动画
5. 所有列表项支持长按弹出菜单
```

-----

# STEP 1：侧边栏整体结构

## 1.1 新结构总览

```
┌──────────────────────────────────────┐
│                                      │
│  Buddy                               │ ← 28px 衬线体，无关闭按钮
│                                      │
│  ∨ 🤖 Buddy AI                      │ ← 可折叠分组（默认展开）
│    💬 Chats                          │   ← 导航项
│    📁 Projects                       │
│    🔧 Artifacts                      │
│    </> Code                          │
│                                      │
│    Starred                           │   ← 橙色分组标题
│    ┌────────────────────────────┐    │
│    │ Claude iOS UI设计规范文档   │    │   ← 选中项
│    └────────────────────────────┘    │
│     任务看板功能齐全却难以坚持...      │
│     团队任务看板系统需求梳理          │
│                                      │
│    Recents                           │   ← 橙色分组标题
│     Anthropic Messages API集成       │
│     Artifact access error            │
│     EOS Capital Tech...              │
│     虚花簪诗解读...                   │
│                                      │
│  > 🏢 企业管理                       │ ← 可折叠分组（默认收起）
│                                      │
│                                      │
│  ┌──────┐                  ┌────┐   │
│  │(A) Alexso│              │ ＋ │   │ ← 底部
│  └──────┘                  └────┘   │
└──────────────────────────────────────┘
```

## 1.2 两大分组说明

|分组            |展开后内容                                                        |默认状态  |
|--------------|-------------------------------------------------------------|------|
|**Buddy AI** 🤖|Chats / Projects / Artifacts / Code + 对话列表（Starred / Recents）|**展开**|
|**企业管理** 🏢    |仪表盘 / 图谱 / 项目 / 任务 / 团队                                      |**收起**|

这样用户打开侧边栏第一眼看到的是 AI 聊天（最常用），往下拉或点击”企业管理”才看到管理功能。

-----

# STEP 2：侧边栏容器

## 2.1 容器样式

|属性                                            |精确值                              |
|----------------------------------------------|---------------------------------|
|宽度                                            |`82vw`，`max-width: 340px`        |
|背景                                            |`#2B2A27`                        |
|`position: fixed; top: 0; left: 0; bottom: 0;`|                                 |
|`z-index: 50`                                 |                                 |
|padding-top                                   |`env(safe-area-inset-top) + 20px`|
|padding-bottom                                |`0`（底部区域自己管 safe area）           |
|内部布局                                          |`flex; flex-direction: column;`  |

## 2.2 App 名称（顶部）

```
  Buddy
```

|属性     |精确值                                    |
|-------|---------------------------------------|
|字体     |`Georgia, 'Noto Serif SC', serif` ⚠️ 衬线体|
|字号     |`28px`（⚠️ Claude 用的很大，你们当前太小了）          |
|字重     |`700`                                  |
|颜色     |`#ECECEC`                              |
|padding|`0 20px 20px 20px`                     |
|无关闭按钮  |靠点遮罩或手势关闭                              |
|无红色方块图标|纯文字                                    |

-----

# STEP 3：Buddy AI 分组（核心）

## 3.1 分组标题行

```
  ∨ 🤖 Buddy AI
```

|属性      |精确值                                                          |
|--------|-------------------------------------------------------------|
|高度      |`48px`                                                       |
|padding |`0 20px`                                                     |
|布局      |`flex; align-items: center; gap: 10px;`                      |
|箭头      |Lucide `ChevronDown`（展开）/ `ChevronRight`（收起），`16px`，`#9A9893`|
|emoji/图标|`🤖` 或 Lucide `Bot`，`20px`                                    |
|文字      |“Buddy AI”，`16px`，`600`，`#ECECEC`，Sans-serif                 |
|点击      |整行可点击，切换展开/收起                                                |
|过渡      |箭头旋转 `200ms ease`，内容区高度 `300ms ease`                         |

## 3.2 导航项（Chats / Projects / Artifacts / Code）

展开后首先显示四个导航入口，完全参考 Claude 侧边栏：

```
    💬 Chats
    📁 Projects
    🔧 Artifacts
    </> Code
```

|属性     |精确值                                           |
|-------|----------------------------------------------|
|每项高度   |`46px`                                        |
|padding|`0 20px 0 28px`（比分组标题多缩进 8px）                 |
|布局     |`flex; align-items: center; gap: 14px;`       |
|图标     |Lucide 图标，`20px`，`#ECECEC`，`stroke-width: 1.5`|
|文字     |`16.5px`，`400`，`#ECECEC`，Sans-serif           |
|hover  |`background: rgba(255,255,255,0.04)`          |
|选中态    |`background: rgba(255,255,255,0.08)`          |
|圆角     |`0`（Claude 导航项没有圆角，全宽）                        |
|过渡     |`background 150ms`                            |

Claude 的导航项用到的 Lucide 图标：

|导航项      |图标名                    |备注    |
|---------|-----------------------|------|
|Chats    |`MessageSquare`        |对话气泡  |
|Projects |`FolderClosed`         |文件夹   |
|Artifacts|`Settings2` 或 `Sliders`|调节图标  |
|Code     |直接用文字 `</>`            |不用图标也行|

## 3.3 对话列表分组标题（Starred / Recents）

```
    Starred
```

|属性     |精确值                              |
|-------|---------------------------------|
|字号     |`14.5px`（⚠️ Claude 的分组标题比一般 App 大）|
|字重     |`500`                            |
|颜色     |`#C4703F`（⚠️ 橙色！不是灰色）             |
|字体     |Sans-serif                       |
|padding|`20px 20px 8px 28px`（与导航项左对齐）    |

对应中文：

- Starred → **收藏**
- Recents → **最近对话**

## 3.4 对话列表项

```
    Claude iOS UI设计规范文档     ← 选中
    任务看板功能齐全却难以坚持...   ← 普通
```

|属性       |精确值                                                              |
|---------|-----------------------------------------------------------------|
|padding  |`12px 16px`                                                      |
|margin   |`0 8px 2px 16px`（⚠️ 左边比导航项多缩进，形成层级）                               |
|圆角       |`10px`                                                           |
|**普通态**  |背景透明                                                             |
|**选中态**  |`rgba(255,255,255,0.08)`                                         |
|**hover**|`rgba(255,255,255,0.04)`                                         |
|标题字号     |`15.5px`（⚠️ Claude 字号偏大）                                          |
|标题字体     |Sans-serif                                                       |
|标题字重     |`400`                                                            |
|标题颜色     |`#ECECEC`                                                        |
|截断       |`overflow: hidden; text-overflow: ellipsis; white-space: nowrap;`|
|支持长按     |弹出上下文菜单（见 STEP 6）                                                |

-----

# STEP 4：企业管理分组

## 4.1 分组标题行

```
  > 🏢 企业管理
```

样式与 Buddy AI 分组标题完全一致，只是默认收起（箭头朝右）。

## 4.2 展开后的导航项

```
    📊 仪表盘
    🔗 图谱
    📋 项目
    ✅ 任务
    👥 团队
```

|属性     |精确值                                  |
|-------|-------------------------------------|
|样式     |与 Buddy AI 的导航项（Chats/Projects 等）完全一致|
|高度     |`46px`                               |
|padding|`0 20px 0 28px`                      |
|图标     |`20px`，`#ECECEC`                     |
|文字     |`16.5px`，`400`，`#ECECEC`             |
|选中态    |`rgba(255,255,255,0.08)`             |

⚠️ **不再有橙色高亮背景条**。选中项用淡白半透明背景，与 Claude 风格一致。

图标映射：

|导航项|Lucide 图标                       |
|---|--------------------------------|
|仪表盘|`LayoutDashboard`               |
|图谱 |`GitFork` 或 `Network`           |
|项目 |`CalendarRange` 或 `FolderKanban`|
|任务 |`CheckSquare`                   |
|团队 |`Users`                         |

## 4.3 两个分组之间

|属性 |精确值         |
|---|------------|
|间距 |`8px` 自然间距即可|
|分隔线|无（不需要线，留白即可）|

-----

# STEP 5：底部区域

## 5.1 结构

```
┌──────────────────────────────────────┐
│                                      │
│  (A) Alexso                    (＋)  │
│                                      │
└──────────────────────────────────────┘
```

|属性            |精确值                                                         |
|--------------|------------------------------------------------------------|
|定位            |固定在侧边栏底部（`margin-top: auto` 或 `flex-shrink: 0`）             |
|padding       |`16px 20px`                                                 |
|padding-bottom|`calc(16px + env(safe-area-inset-bottom))`                  |
|布局            |`flex; align-items: center; justify-content: space-between;`|
|无上边框          |不要分隔线                                                       |
|无主题切换条        |删除浅色/深色/系统切换                                                |
|无 (Owner) 标签  |删除                                                          |

## 5.2 左侧 — 用户头像（点击弹出设置菜单）

|属性      |精确值                                              |
|--------|-------------------------------------------------|
|头像      |`34px` 圆形，背景 `#4A4A47`，白色首字母 `15px 600`          |
|用户名     |`15.5px`，`#ECECEC`，Sans-serif，`margin-left: 10px`|
|**点击行为**|⚠️ 弹出设置弹窗/菜单（见 5.4）                               |

## 5.3 右侧 — 新建对话按钮

|属性|精确值                           |
|--|------------------------------|
|尺寸|`40×40px` 圆形                  |
|背景|`#AE5630`                     |
|图标|Lucide `Plus`，`20px`，`#FFFFFF`|
|按下|`scale(0.95)`                 |
|功能|新建 AI 对话                      |

## 5.4 点击头像 → 弹出设置菜单

点击头像区域后，从底部弹出一个菜单面板（Action Sheet 风格）：

```
┌──────────────────────────────────────┐
│                                      │
│  (A) Alexso                          │
│  alexso@company.com                  │
│                                      │
│  ─────────────────────────────────── │
│                                      │
│  ⚙  设置                             │
│  🔔 通知                             │
│  🌙 深色模式                     [🔘] │
│  ❓ 帮助与反馈                        │
│                                      │
│  ─────────────────────────────────── │
│                                      │
│  🚪 退出登录                          │
│                                      │
└──────────────────────────────────────┘
```

### 弹窗容器样式

|属性            |精确值                                               |
|--------------|--------------------------------------------------|
|定位            |从底部滑入，覆盖在侧边栏之上                                    |
|`z-index`     |`60`                                              |
|背景            |`#2B2A27`                                         |
|圆角            |`16px 16px 0 0`（顶部圆角）                             |
|padding       |`24px 20px`                                       |
|padding-bottom|`calc(24px + env(safe-area-inset-bottom))`        |
|阴影            |`0 -4px 24px rgba(0,0,0,0.3)`                     |
|动画            |`slideUp 300ms cubic-bezier(0.165, 0.85, 0.45, 1)`|
|遮罩            |`rgba(0,0,0,0.4)` 覆盖侧边栏和主内容                       |

### 用户信息区

|属性  |精确值                   |
|----|----------------------|
|头像  |`48px` 圆形（比侧边栏更大）     |
|用户名 |`17px`，`600`，`#ECECEC`|
|邮箱  |`14px`，`#9A9893`      |
|下方间距|`20px`                |

### 菜单项

|属性   |精确值                                    |
|-----|---------------------------------------|
|每项高度 |`48px`                                 |
|布局   |`flex; align-items: center; gap: 14px;`|
|图标   |Lucide 图标，`20px`，`#ECECEC`             |
|文字   |`16px`，`400`，`#ECECEC`                 |
|深色模式 |右侧放 Toggle Switch（与图谱设置面板的开关样式一致）      |
|退出登录 |文字颜色 `#E5534B`（红色）                     |
|分隔线  |`1px solid var(--border-subtle)`       |
|hover|`background: rgba(255,255,255,0.04)`   |
|圆角   |`8px`                                  |

-----

# STEP 6：长按上下文菜单（Context Menu）

Claude 侧边栏的每个对话项长按后会弹出操作菜单。

## 6.1 触发方式

```typescript
// 长按检测（移动端 500ms）
let pressTimer: number;

function handleTouchStart(e: TouchEvent, item: Conversation) {
  pressTimer = setTimeout(() => {
    // 触发触觉反馈（如果支持）
    if (navigator.vibrate) navigator.vibrate(10);
    showContextMenu(item, e.touches[0].clientX, e.touches[0].clientY);
  }, 500);
}

function handleTouchEnd() {
  clearTimeout(pressTimer);
}
```

## 6.2 菜单样式

参考第三张 Claude 截图中的菜单：

```
┌──────────────────────────┐
│  📁 Change project       │
│  ⭐ Unstar / Star        │
│  ✏️  Rename               │
│  ─────────────────────── │
│  🗑  Delete               │  ← 红色
└──────────────────────────┘
```

|属性       |精确值                                                        |
|---------|-----------------------------------------------------------|
|背景       |`#3C3B37`（比侧边栏亮一级）                                         |
|圆角       |`14px`                                                     |
|阴影       |`0 8px 32px rgba(0,0,0,0.4), 0 2px 8px rgba(0,0,0,0.2)`    |
|padding  |`6px 0`                                                    |
|最小宽度     |`200px`                                                    |
|`z-index`|`70`                                                       |
|出现动画     |`scale(0.95) → scale(1)` + `opacity 0 → 1`，`200ms ease-out`|
|定位       |出现在长按位置附近，避免超出屏幕                                           |

### 菜单项

|属性         |精确值                                                    |
|-----------|-------------------------------------------------------|
|每项高度       |`44px`                                                 |
|padding    |`0 16px`                                               |
|布局         |`flex; align-items: center; gap: 12px;`                |
|图标         |Lucide 图标，`18px`                                       |
|文字         |`15px`，`400`，Sans-serif                                |
|普通项        |图标和文字颜色 `#ECECEC`                                      |
|删除项        |图标和文字颜色 `#E5534B`（红色）                                  |
|分隔线        |删除项上方有 `1px solid var(--border-subtle)`，`margin: 4px 0`|
|hover/press|`background: rgba(255,255,255,0.06)`                   |

### 菜单项内容

**对话项的菜单：**

|图标                |文字       |功能             |
|------------------|---------|---------------|
|`FolderInput`     |移到项目     |将对话归入某个 Project|
|`Star` / `StarOff`|收藏 / 取消收藏|切换收藏状态         |
|`Pencil`          |重命名      |弹出输入框修改标题      |
|`Trash2`          |删除       |⚠️ 红色，删除确认      |

**企业管理导航项的菜单（可选）：**
可以没有上下文菜单，或只有”添加到快捷方式”之类的简单操作。

## 6.3 遮罩

菜单出现时：

- 背景加一层极淡遮罩 `rgba(0,0,0,0.2)`
- 点击遮罩关闭菜单
- 菜单消失动画：`scale(1) → scale(0.95)` + `opacity 1 → 0`，`150ms ease-in`

-----

# STEP 7：手势交互（侧边栏拖拉开关）

## 7.1 打开手势

从屏幕**左边缘**向右滑动打开侧边栏：

```typescript
let startX = 0;
let currentX = 0;
let isDragging = false;

function handleTouchStart(e: TouchEvent) {
  const touch = e.touches[0];
  // 只在屏幕左边缘 20px 内触发
  if (touch.clientX < 20) {
    startX = touch.clientX;
    isDragging = true;
  }
}

function handleTouchMove(e: TouchEvent) {
  if (!isDragging) return;
  currentX = e.touches[0].clientX;
  const deltaX = currentX - startX;

  if (deltaX > 0) {
    // 侧边栏跟随手指位移（带阻尼）
    const progress = Math.min(deltaX / sidebarWidth, 1);
    sidebar.style.transform = `translateX(${-sidebarWidth + deltaX}px)`;
    overlay.style.opacity = String(progress * 0.4);
    // 禁用过渡动画（手指跟随要实时）
    sidebar.style.transition = 'none';
    overlay.style.transition = 'none';
  }
}

function handleTouchEnd() {
  if (!isDragging) return;
  isDragging = false;
  const deltaX = currentX - startX;
  const velocity = /* 计算手指速度 */;

  // 恢复过渡动画
  sidebar.style.transition = 'transform 350ms cubic-bezier(0.32, 0.72, 0, 1)';
  overlay.style.transition = 'opacity 350ms ease';

  // 判断是否打开：滑动超过 30% 或速度足够快
  if (deltaX > sidebarWidth * 0.3 || velocity > 0.5) {
    openSidebar();
  } else {
    closeSidebar();
  }
}
```

## 7.2 关闭手势

侧边栏已打开时，在侧边栏上**向左滑动**关闭：

```typescript
// 在侧边栏内部监听
function handleSidebarTouchStart(e: TouchEvent) {
  startX = e.touches[0].clientX;
  isDraggingClose = true;
}

function handleSidebarTouchMove(e: TouchEvent) {
  if (!isDraggingClose) return;
  const deltaX = e.touches[0].clientX - startX;

  if (deltaX < 0) {
    // 向左拖 → 关闭
    sidebar.style.transform = `translateX(${deltaX}px)`;
    const progress = 1 + deltaX / sidebarWidth;
    overlay.style.opacity = String(Math.max(0, progress * 0.4));
    sidebar.style.transition = 'none';
  }
}

function handleSidebarTouchEnd() {
  const deltaX = currentX - startX;
  sidebar.style.transition = 'transform 350ms cubic-bezier(0.32, 0.72, 0, 1)';

  if (deltaX < -sidebarWidth * 0.3 || velocity < -0.5) {
    closeSidebar();
  } else {
    openSidebar(); // 弹回打开位置
  }
}
```

## 7.3 弹性动画

⚠️ Claude 的侧边栏开关有明显的弹性感（spring animation）。

关键参数：

```css
/* 弹性缓动函数 — 有轻微回弹 */
transition: transform 350ms cubic-bezier(0.32, 0.72, 0, 1);
```

或者用 JS spring animation：

```typescript
// 使用 Web Animations API
sidebar.animate([
  { transform: 'translateX(-100%)' },
  { transform: 'translateX(2%)' },    // 轻微过冲
  { transform: 'translateX(0)' },
], {
  duration: 400,
  easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)',  // spring 效果
});
```

## 7.4 遮罩也跟随手势

拖拉过程中，遮罩的 opacity 与侧边栏位移同步变化：

- 完全关闭 → opacity: 0
- 完全打开 → opacity: 0.4
- 中间状态 → 线性插值

-----

# STEP 8：分组折叠动画

两大分组（Buddy AI / 企业管理）的展开和收起需要流畅动画。

```typescript
function CollapsibleSection({ title, icon, children, defaultOpen = false }) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const contentRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | 'auto'>(defaultOpen ? 'auto' : 0);

  useEffect(() => {
    if (isOpen) {
      const h = contentRef.current?.scrollHeight || 0;
      setHeight(h);
      // 动画结束后设为 auto（允许内容动态变化）
      setTimeout(() => setHeight('auto'), 300);
    } else {
      // 先设为具体值再设为 0（触发动画）
      const h = contentRef.current?.scrollHeight || 0;
      setHeight(h);
      requestAnimationFrame(() => setHeight(0));
    }
  }, [isOpen]);

  return (
    <div>
      {/* 标题行 */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: '100%', height: 48,
          padding: '0 20px',
          display: 'flex', alignItems: 'center', gap: 10,
          background: 'none', border: 'none', cursor: 'pointer',
        }}
      >
        <ChevronIcon
          style={{
            transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)',
            transition: 'transform 200ms ease',
            width: 16, color: '#9A9893',
          }}
        />
        <span style={{ fontSize: 20 }}>{icon}</span>
        <span style={{
          fontSize: 16, fontWeight: 600,
          color: '#ECECEC',
        }}>{title}</span>
      </button>

      {/* 内容区（动画折叠） */}
      <div
        ref={contentRef}
        style={{
          height: height,
          overflow: 'hidden',
          transition: 'height 300ms cubic-bezier(0.165, 0.85, 0.45, 1)',
        }}
      >
        {children}
      </div>
    </div>
  );
}
```

-----

# STEP 9：完整的 Replit 执行 Prompt

直接复制粘贴：

```
请重做侧边栏，按以下要求实现。这是一次大改，请仔细阅读。

===== 删除 =====
1. 删除当前侧边栏的所有内容
2. 删除红色方块图标 + "Buddy" 标题组合
3. 删除 ✕ 关闭按钮
4. 删除底部 浅色/深色/系统 主题切换条
5. 删除 (Owner) 角色标签
6. 删除导航项上的橙色/绿色高亮背景条

===== 顶部 =====
7. 顶部显示 "Buddy"，Georgia serif 衬线字体，28px，700字重，#ECECEC，padding 0 20px

===== 两大可折叠分组 =====
8. 第一个分组："Buddy AI"（图标🤖或 Lucide Bot），默认展开
   展开后包含：
   - 四个导航项：Chats(💬) / Projects(📁) / Artifacts(🔧) / Code(</>)
     每项 46px 高，图标 20px + 文字 16.5px，padding-left 28px
   - "收藏" 分组标题，14.5px，500字重，颜色 #C4703F（橙色）
   - 收藏的对话列表
   - "最近对话" 分组标题，同上橙色
   - 最近的对话列表
   - 对话项：15.5px，padding 12px 16px，margin 0 8px 2px 16px，圆角 10px
   - 选中项背景 rgba(255,255,255,0.08)

9. 第二个分组："企业管理"（图标🏢），默认收起
   展开后包含：
   - 导航项：仪表盘 / 图谱 / 项目 / 任务 / 团队
   - 样式与 Buddy AI 导航项一致

10. 分组标题行 48px 高，点击展开/收起，箭头旋转动画 200ms
11. 内容区展开/收起有高度过渡动画 300ms

===== 底部 =====
12. 左侧：34px 圆形头像（深色底+白色首字母）+ 用户名 15.5px
13. 右侧：40px 圆形橙色(#AE5630)新建按钮，白色 + 图标
14. 点击头像弹出底部设置面板（Action Sheet），包含：
    - 用户信息（大头像48px + 名称 + 邮箱）
    - 设置、通知、深色模式（带Toggle开关）、帮助与反馈
    - 退出登录（红色文字 #E5534B）
    - 面板从底部滑入，背景 #2B2A27，圆角 16px 16px 0 0

===== 长按上下文菜单 =====
15. 对话列表项支持长按（500ms）弹出上下文菜单
16. 菜单包含：移到项目 / 收藏(取消收藏) / 重命名 / 删除(红色)
17. 菜单样式：背景 #3C3B37，圆角 14px，阴影，每项 44px 高
18. 删除项文字和图标为红色 #E5534B
19. 点击遮罩或菜单外部关闭菜单
20. 出现动画 scale(0.95→1) + opacity，200ms

===== 手势交互 =====
21. 从屏幕左边缘（20px内）向右滑可打开侧边栏
22. 在侧边栏上向左滑可关闭侧边栏
23. 拖拉过程中侧边栏实时跟随手指（禁用transition）
24. 松手后根据滑动距离(>30%)或速度判断开/关
25. 松手后的弹性动画：350ms cubic-bezier(0.32, 0.72, 0, 1)
26. 遮罩 opacity 与侧边栏位移同步变化

===== 整体样式 =====
27. 侧边栏背景 #2B2A27
28. 遮罩 rgba(0,0,0,0.4)，点击可关闭
29. 宽度 82vw，max-width 340px
30. 所有图标统一用 Lucide React，20px，stroke-width 1.5

请逐项实现，不要遗漏。
```

-----

# 检查清单

```
【结构】
□ 顶部 "Buddy" 衬线体 28px Bold
□ 两大可折叠分组：Buddy AI（展开）+ 企业管理（收起）
□ Buddy AI 里有 Chats/Projects/Artifacts/Code 导航 + 对话列表
□ 企业管理里有仪表盘/图谱/项目/任务/团队
□ 底部：头像 + 用户名 + 橙色新建按钮

【删除确认】
□ 没有 ✕ 关闭按钮
□ 没有主题切换条
□ 没有 (Owner) 标签
□ 没有橙色/绿色高亮背景条
□ 没有红色方块图标

【交互】
□ 分组可展开/收起，有折叠动画
□ 从左边缘右滑可打开侧边栏
□ 在侧边栏左滑可关闭
□ 拖拉过程侧边栏跟随手指
□ 松手有弹性动画
□ 长按对话项弹出菜单
□ 点击头像弹出设置面板

【样式】
□ 对话分组标题是橙色 #C4703F
□ 选中项背景 rgba(255,255,255,0.08)
□ 菜单背景 #3C3B37，圆角 14px
□ 删除项为红色 #E5534B
□ 字号够大（标题28px，导航16.5px，对话15.5px）
```