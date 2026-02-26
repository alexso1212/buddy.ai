# Task 03: UX 细节打磨  
  
> 此任务处理体验层的优化，让产品从”能用”提升到”好用”  
  
## 前置条件  
  
Task 01 和 Task 02 已完成并验证通过。  
  
-----  
  
## 修改 1: 消息编辑增加确认提示  
  
**文件**: 用户消息气泡组件（渲染编辑按钮的位置）  
  
**当前行为**: 点击编辑铅笔 → 直接进入编辑模式 → 发送后截断后续历史  
  
**问题**: 用户可能不知道编辑会删除之后所有消息，导致意外丢失重要回复。  
  
**修改**: 在进入编辑模式前，如果该消息后面还有其他消息，显示一个确认提示：  
  
```javascript  
const handleEditClick = () => {  
  // 检查该消息后面是否还有消息  
  const msgIndex = messages.findIndex(m => m.id === message.id);  
  const hasFollowingMessages = msgIndex < messages.length - 1;  
    
  if (hasFollowingMessages) {  
    // 显示简单的确认 — 不要用原生 confirm()，用你们的组件  
    setShowEditWarning(true);  
    // 确认后才进入编辑模式: setIsEditing(true)  
  } else {  
    // 最后一条消息，直接编辑  
    setIsEditing(true);  
  }  
};  
```  
  
**确认提示 UI**:  
  
- 在消息气泡上方或下方显示一个小型 inline 提示  
- 文案: “编辑此消息将删除之后的回复”  
- 两个按钮: “继续编辑” / “取消”  
- 不要用全屏弹窗，太重了；inline 提示即可  
- 样式参考现有系统消息的灰色小字风格  
  
**编辑完成后**: 在重发的消息上添加一个小标记：  
  
```javascript  
// 编辑后的消息添加 edited flag  
const editedMessage = {  
  ...message,  
  content: newText,  
  edited: true, // ← 新增  
  editedAt: Date.now(),  
};  
```  
  
**渲染**: 消息气泡右下角时间戳旁显示 “(已编辑)”，灰色小字。  
  
-----  
  
## 修改 2: 代码块增加行号  
  
**文件**: Markdown 渲染组件中处理代码块的部分  
  
**当前**: 代码块只有语法高亮 + 顶部语言名 + Copy 按钮，无行号。  
  
**添加行号**:  
  
```css  
/* 代码块容器 */  
.code-block pre {  
  display: flex;  
}  
  
.code-block .line-numbers {  
  user-select: none;         /* 复制代码时不选中行号 */  
  text-align: right;  
  padding-right: 12px;  
  margin-right: 12px;  
  border-right: 1px solid rgba(255, 255, 255, 0.1);  
  color: rgba(255, 255, 255, 0.3);  
  min-width: 2em;  
  flex-shrink: 0;  
}  
  
.code-block .code-content {  
  flex: 1;  
  overflow-x: auto;  
}  
```  
  
**渲染逻辑**: 将高亮后的代码按 `\n` 分割，生成行号列和代码列：  
  
```javascript  
const lines = highlightedCode.split('\n');  
return (  
  <div className="code-block">  
    <div className="code-header">  
      <span>{language}</span>  
      <button onClick={handleCopy}>Copy</button>  
    </div>  
    <pre>  
      <div className="line-numbers">  
        {lines.map((_, i) => <div key={i}>{i + 1}</div>)}  
      </div>  
      <div className="code-content">  
        <code dangerouslySetInnerHTML={{ __html: highlightedCode }} />  
      </div>  
    </pre>  
  </div>  
);  
```  
  
**重要**: `user-select: none` 确保用户复制代码时不会把行号也复制进去。  
  
**条件**: 仅当代码超过 1 行时显示行号，单行代码（inline code）不显示。  
  
-----  
  
## 修改 3: 代码块超长时支持折叠  
  
**文件**: 同上  
  
**规则**: 代码超过 20 行时，默认只显示前 15 行 + 折叠指示器。  
  
```javascript  
const CODE_COLLAPSE_THRESHOLD = 20;  
const CODE_VISIBLE_LINES = 15;  
  
const CodeBlock = ({ code, language }) => {  
  const [isExpanded, setIsExpanded] = useState(false);  
  const lines = code.split('\n');  
  const shouldCollapse = lines.length > CODE_COLLAPSE_THRESHOLD;  
    
  const displayCode = shouldCollapse && !isExpanded  
    ? lines.slice(0, CODE_VISIBLE_LINES).join('\n')  
    : code;  
    
  return (  
    <div className="code-block">  
      <div className="code-header">  
        <span>{language}</span>  
        <button onClick={handleCopy}>Copy</button>  
      </div>  
      <pre>  
        {/* 行号 + 代码渲染 */}  
      </pre>  
      {shouldCollapse && (  
        <button   
          className="code-expand-btn"  
          onClick={() => setIsExpanded(!isExpanded)}  
        >  
          {isExpanded   
            ? '收起'   
            : `展开全部 (${lines.length} 行)`  
          }  
        </button>  
      )}  
    </div>  
  );  
};  
```  
  
**折叠指示器样式**:  
  
```css  
.code-expand-btn {  
  width: 100%;  
  padding: 8px;  
  background: rgba(255, 255, 255, 0.05);  
  border: none;  
  border-top: 1px solid rgba(255, 255, 255, 0.1);  
  color: rgba(255, 255, 255, 0.5);  
  cursor: pointer;  
  font-size: 12px;  
  border-radius: 0 0 8px 8px;  
}  
  
.code-expand-btn:hover {  
  background: rgba(255, 255, 255, 0.1);  
  color: rgba(255, 255, 255, 0.8);  
}  
```  
  
**注意**: Copy 按钮始终复制完整代码（不管是否折叠），这很重要。  
  
-----  
  
## 修改 4: Token 用量显示优化  
  
**文件**: AI 消息气泡组件中显示 token 用量的部分  
  
**当前**: 默认显示 “X.XK tokens”，hover 显示详细分解。  
  
**修改为费用优先显示**:  
  
```javascript  
const TokenBadge = ({ usage }) => {  
  if (!usage) return null;  
    
  // 计算估算费用（基于 tokenCost.ts 中的定价）  
  const cost = calculateCost(usage);  
    
  // 主显示：费用；hover 显示 token 详情  
  return (  
    <span   
      className="token-badge"   
      title={`输入: ${usage.promptTokens} | 输出: ${usage.completionTokens} | 共: ${usage.totalTokens} tokens`}  
    >  
      {cost < 0.01 ? '<¥0.01' : `¥${cost.toFixed(2)}`}  
    </span>  
  );  
};  
```  
  
**费用换算**: 使用人民币显示（你们的用户在中国），参考当前模型定价换算。如果定价在 `tokenCost.ts` 中是美元，乘以汇率常量（如 7.2）。  
  
**如果不想显示费用**，备选方案：默认隐藏 token 徽章，只在 hover 消息操作按钮区域时才显示。  
  
-----  
  
## 修改 5: 模型选择和 Web Search 开关持久化  
  
**文件**:  
  
- 模型选择器组件  
- AiInputBar 组件（Web Search 开关部分）  
  
### 5a: Web Search 状态持久化到 localStorage  
  
**当前**: React state，刷新丢失。  
  
```javascript  
// 初始化时读取  
const [webSearchEnabled, setWebSearchEnabled] = useState(() => {  
  return localStorage.getItem('buddy_web_search') === 'true';  
});  
  
// 切换时保存  
const toggleWebSearch = () => {  
  const newValue = !webSearchEnabled;  
  setWebSearchEnabled(newValue);  
  localStorage.setItem('buddy_web_search', String(newValue));  
};  
```  
  
### 5b: 模型选择同步到用户配置（如果有用户设置 API）  
  
如果后端已有用户偏好设置的 API（如 `PATCH /api/user/preferences`），将模型选择同步上去：  
  
```javascript  
const handleModelChange = async (model: string) => {  
  localStorage.setItem('buddy_model', model);  
  setSelectedModel(model);  
    
  // 异步同步到服务端，不阻塞 UI  
  try {  
    await fetch('/api/user/preferences', {  
      method: 'PATCH',  
      headers: { 'Content-Type': 'application/json' },  
      body: JSON.stringify({ preferredModel: model }),  
    });  
  } catch {  
    // 同步失败不影响使用，localStorage 已保存  
  }  
};  
```  
  
如果后端暂时没有这个 API，此步跳过，先保持 localStorage 方案。  
  
-----  
  
## 修改 6: 欢迎页智能建议增加时间上下文  
  
**文件**: 欢迎页/空对话的智能建议卡片组件  
  
**当前**: “你有 3 个任务已逾期”  
  
**增加时间维度**:  
  
```javascript  
const generateSuggestions = (tasks) => {  
  const now = new Date();  
  const todayEnd = endOfDay(now);  
  const suggestions = [];  
    
  // 逾期任务（最高优先级）  
  const overdue = tasks.filter(t => t.dueDate && new Date(t.dueDate) < now && t.status !== 'done');  
  if (overdue.length > 0) {  
    suggestions.push({  
      icon: '🔴',  
      text: `你有 ${overdue.length} 个任务已逾期，需要处理`,  
      prompt: '帮我查看逾期任务并制定补救计划',  
    });  
  }  
    
  // 今天到期的任务  
  const dueToday = tasks.filter(t =>   
    t.dueDate && new Date(t.dueDate) <= todayEnd && new Date(t.dueDate) >= now && t.status !== 'done'  
  );  
  if (dueToday.length > 0) {  
    suggestions.push({  
      icon: '⏰',  
      text: `今天有 ${dueToday.length} 个任务到期`,  
      prompt: '帮我安排今天需要完成的任务',  
    });  
  }  
    
  // 本周到期的任务  
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });  
  const dueThisWeek = tasks.filter(t =>  
    t.dueDate && new Date(t.dueDate) <= weekEnd && new Date(t.dueDate) > todayEnd && t.status !== 'done'  
  );  
  if (dueThisWeek.length > 0) {  
    suggestions.push({  
      icon: '📅',  
      text: `本周还有 ${dueThisWeek.length} 个任务待完成`,  
      prompt: '帮我规划本周的任务安排',  
    });  
  }  
    
  // 进行中的任务  
  const inProgress = tasks.filter(t => t.status === 'in_progress');  
  if (inProgress.length > 0) {  
    suggestions.push({  
      icon: '🔄',  
      text: `${inProgress.length} 个任务正在进行中`,  
      prompt: '帮我检查进行中任务的进展',  
    });  
  }  
    
  // 填充到 4 个卡片  
  while (suggestions.length < 4) {  
    suggestions.push(DEFAULT_SUGGESTIONS[suggestions.length]);  
  }  
    
  return suggestions.slice(0, 4);  
};  
```  
  
-----  
  
## 验证步骤  
  
1. **编辑确认**: 编辑一条后面有 AI 回复的消息 → 应出现”编辑此消息将删除之后的回复”提示 → 确认后才进入编辑模式 → 编辑后的消息显示”(已编辑)“标记  
1. **编辑最后一条**: 编辑最后一条用户消息（后面没有回复）→ 不应出现提示，直接编辑  
1. **代码行号**: 让 AI 生成一段多行代码 → 应显示行号 → 复制代码时行号不被选中  
1. **代码折叠**: 让 AI 生成超过 20 行的代码 → 应默认折叠，显示”展开全部 (X 行)” → 点击展开 → Copy 始终复制完整代码  
1. **Token 显示**: 发送消息后查看 AI 回复底部 → 应显示费用而非 token 数  
1. **Web Search 持久化**: 开启 Web Search → 刷新页面 → 开关应仍然开启  
1. **智能建议**: 新建对话 → 如果有今天到期的任务，建议卡片应体现”今天”；如果有逾期任务，应显示逾期提示  
