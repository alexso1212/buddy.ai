# Buddy AI — 交互式输入组件（Interactive Input Widget）技术规格  
  
> 本文档是给 Replit Agent 的实现指令。请完整阅读后再开始编码。  
  
-----  
  
## 一、产品背景与设计哲学  
  
### 我们要做什么  
  
在 Buddy AI 的聊天界面中实现一套 **交互式输入组件**，让 AI 在需要用户澄清信息时，不再只是用文字提问，而是在聊天底部弹出可点击的选项卡（chips）、多选列表、或拖拽排序界面，让用户一键选择而非手动打字。  
  
### 为什么要做  
  
这个功能的核心价值：  
  
1. **降低用户输入成本** — 点选比打字快 5-10 倍，尤其在移动端  
1. **结构化信息收集** — AI 得到的是确定性的选择结果，而不是需要再次解析的自然语言  
1. **引导式对话** — 用户不需要思考”该怎么回答”，选项本身就是引导  
1. **提升任务创建效率** — 在 Buddy AI 的核心场景（任务分配、权责判定、依赖设置）中，大部分澄清都是有限选项的  
  
### 设计灵感来源  
  
这个功能参考了 Claude.ai 的 Interactive Inputs 设计。Claude 的实现有以下关键设计决策值得我们学习：  
  
**位置选择 — 底部浮动层，而非消息内嵌**  
  
选项卡不是嵌在 AI 消息气泡里的，而是固定在聊天底部（输入框上方）。这样做的好处是：它在视觉上属于”用户行动区”而不是”AI 内容区”，降低了用户的认知负担 — “我不是在阅读，我是在操作”。  
  
**AI 消息 + Widget 配合使用**  
  
AI 不会只弹选项不说话。它总是先输出一段简短的文字消息提供上下文（比如”我来帮你确认几个细节”），然后紧接着展示 widget。文字提供上下文，widget 提供操作路径。  
  
**永远保留文字输入的退路**  
  
Widget 只是一个快捷方式，不是强制路径。用户随时可以忽略 widget，直接在输入框打字回复。这避免了”被限制在选项里”的受困感。  
  
**渐进式信息收集**  
  
一次最多问 1-3 个问题，每个问题 2-4 个选项。不要一次收集所有信息。这和 Typeform 的设计哲学一致 — 分步收集比表单式收集体验好很多。超过这个量用户就会觉得像在做问卷而不是在聊天。  
  
**选项形态 — Chip/Pill 按钮**  
  
每个选项是一个圆角的 chip 按钮，未选中时是灰白底色，选中后切换为强调色。这个形态在 Material Design 和 Apple HIG 里都有成熟范式，用户零学习成本。  
  
-----  
  
## 二、交互类型定义  
  
### 2.1 Single Select（单选）  
  
用户从 2-4 个选项中选择一个。  
  
**适用场景举例：**  
  
- “这个任务归哪个部门？” → [产品部] [技术部] [运营部] [市场部]  
- “任务优先级是？” → [紧急] [高] [中] [低]  
- “这属于哪种性质？” → [本职工作] [延伸任务] [额外贡献]  
  
**交互规则：**  
  
- 点击某个选项后立即高亮  
- 再次点击同一选项可取消选择  
- 点击另一选项自动切换（单选互斥）  
- 底部出现”确认”按钮，点击后提交  
  
### 2.2 Multi Select（多选）  
  
用户从 2-4 个选项中选择一个或多个。  
  
**适用场景举例：**  
  
- “这个任务涉及哪些部门？” → [产品部] [技术部] [运营部] [市场部]  
- “你对哪些方面感兴趣？” → [数据分析] [用户研究] [竞品分析] [方案设计]  
  
**交互规则：**  
  
- 点击选项切换选中/未选中状态  
- 可以同时选多个  
- 至少选一个才能提交  
- 底部出现”确认”按钮  
  
### 2.3 Rank Priorities（优先级排序）  
  
用户通过拖拽对 2-4 个选项进行优先级排列。  
  
**适用场景举例：**  
  
- “请排列这些目标的优先级” → [成本控制] [交付速度] [质量标准] [团队满意度]  
  
**交互规则：**  
  
- 选项按初始顺序排列，每个选项左侧显示序号（1, 2, 3…）  
- 用户可以拖拽调整顺序  
- 拖拽时其他选项平滑让位  
- 底部出现”确认排序”按钮  
  
-----  
  
## 三、技术架构设计  
  
### 3.1 整体数据流  
  
```  
AI 响应 (streaming)  
    ↓  
前端解析 response  
    ↓  
检测到 interactive_input 类型  
    ↓  
渲染文字消息到对话流 + 渲染 Widget 到输入框上方  
    ↓  
用户交互（点选/拖拽）  
    ↓  
用户点击确认  
    ↓  
将选择结果组装为用户消息发送  
    ↓  
AI 接收结构化结果，继续对话  
```  
  
### 3.2 AI 响应格式  
  
AI 的响应需要同时包含文字消息和 widget 数据。建议在 AI 响应中使用特殊的 JSON 结构：  
  
```typescript  
// AI 响应中的 interactive input 数据结构  
interface InteractiveInputResponse {  
  type: 'interactive_input';  
  // AI 的文字消息（显示在对话流中）  
  message: string;  
  // widget 数据  
  questions: InteractiveQuestion[];  
}  
  
interface InteractiveQuestion {  
  id: string;  
  question: string;  // 问题文本（显示在 widget 顶部）  
  type: 'single_select' | 'multi_select' | 'rank_priorities';  
  options: string[];  // 2-4 个选项  
}  
```  
  
**AI 端实现要点：**  
  
在 Specialist Handler 层，当 AI 判断需要用户澄清时，返回上述结构化数据，而不是纯文本提问。具体的触发逻辑可以这样设计：  
  
```typescript  
// 在 AI system prompt 中定义 tool  
const interactiveInputTool = {  
  name: 'ask_user_input',  
  description: '当需要用户从有限选项中做选择时使用此工具，而非用文字提问',  
  parameters: {  
    type: 'object',  
    properties: {  
      questions: {  
        type: 'array',  
        description: '1-3 个问题',  
        items: {  
          type: 'object',  
          properties: {  
            question: { type: 'string', description: '问题文本' },  
            type: {  
              type: 'string',  
              enum: ['single_select', 'multi_select', 'rank_priorities']  
            },  
            options: {  
              type: 'array',  
              description: '2-4 个选项，用简短标签',  
              items: { type: 'string' },  
              minItems: 2,  
              maxItems: 4  
            }  
          },  
          required: ['question', 'type', 'options']  
        },  
        minItems: 1,  
        maxItems: 3  
      }  
    },  
    required: ['questions']  
  }  
};  
```  
  
### 3.3 前端组件结构  
  
```  
ChatInterface  
├── MessageList（对话消息流）  
│   ├── AIMessage  
│   ├── UserMessage  
│   └── ...  
├── InteractiveInputWidget（交互式输入层 ← 新增）  
│   ├── QuestionCard  
│   │   ├── QuestionTitle  
│   │   └── OptionChips / DraggableList  
│   └── ConfirmButton  
└── ChatInput（文字输入框）  
```  
  
**层级关系：** InteractiveInputWidget 位于 ChatInput 上方，当有 widget 数据时显示，没有时隐藏。它不影响 ChatInput 的正常使用。  
  
### 3.4 用户选择结果回传  
  
用户确认选择后，将结果组装为一条结构化的用户消息：  
  
```typescript  
// 单选结果  
{  
  type: 'interactive_response',  
  answers: [  
    {  
      questionId: 'q1',  
      question: '这个任务归哪个部门？',  
      type: 'single_select',  
      selected: ['技术部']  
    }  
  ]  
}  
  
// 多选结果  
{  
  type: 'interactive_response',  
  answers: [  
    {  
      questionId: 'q2',  
      question: '涉及哪些部门？',  
      type: 'multi_select',  
      selected: ['产品部', '技术部']  
    }  
  ]  
}  
  
// 排序结果  
{  
  type: 'interactive_response',  
  answers: [  
    {  
      questionId: 'q3',  
      question: '请排列优先级',  
      type: 'rank_priorities',  
      ranked: ['交付速度', '质量标准', '成本控制', '团队满意度']  
    }  
  ]  
}  
```  
  
**在对话流中的显示：** 用户消息气泡中显示人类可读的摘要，例如：  
  
- 单选：`部门：技术部`  
- 多选：`涉及部门：产品部、技术部`  
- 排序：`优先级排序：1. 交付速度 2. 质量标准 3. 成本控制 4. 团队满意度`  
  
-----  
  
## 四、UI 设计规格  
  
### 4.1 整体布局  
  
```  
┌─────────────────────────────────┐  
│         对话消息流               │  
│                                 │  
│  AI: 好的，我来帮你创建这个任务，│  
│      先确认几个细节。            │  
│                                 │  
├─────────────────────────────────┤  ← 分隔线（subtle）  
│  ┌─ Interactive Widget ───────┐ │  
│  │ 这个任务归哪个部门？        │ │  
│  │                            │ │  
│  │ [产品部] [技术部]          │ │  
│  │ [运营部] [市场部]          │ │  
│  │                            │ │  
│  │         [确认选择]          │ │  
│  └────────────────────────────┘ │  
├─────────────────────────────────┤  
│  [  输入消息...            📎 ] │  ← 输入框始终可用  
└─────────────────────────────────┘  
```  
  
### 4.2 颜色与样式（遵循现有设计系统）  
  
```css  
/* Widget 容器 */  
.interactive-widget {  
  background: rgba(255, 255, 255, 0.8);        /* 半透明白底 */  
  backdrop-filter: blur(20px);                  /* 磨砂玻璃效果 - 保持与 Buddy AI 一致 */  
  -webkit-backdrop-filter: blur(20px);  
  border-top: 1px solid rgba(0, 0, 0, 0.06);   /* 极淡分隔线 */  
  padding: 16px 20px;  
  border-radius: 16px 16px 0 0;                 /* 顶部圆角 */  
}  
  
/* 问题标题 */  
.question-title {  
  font-size: 14px;  
  font-weight: 500;  
  color: #374151;                               /* gray-700 */  
  margin-bottom: 12px;  
}  
  
/* 选项 Chip — 未选中 */  
.option-chip {  
  display: inline-flex;  
  align-items: center;  
  padding: 8px 16px;  
  border-radius: 20px;                          /* 全圆角 pill 形态 */  
  border: 1px solid rgba(0, 0, 0, 0.1);  
  background: rgba(255, 255, 255, 0.9);  
  color: #374151;  
  font-size: 14px;  
  cursor: pointer;  
  transition: all 150ms ease;  
  user-select: none;  
}  
  
/* 选项 Chip — 悬停 */  
.option-chip:hover {  
  background: rgba(0, 0, 0, 0.04);  
  border-color: rgba(0, 0, 0, 0.15);  
}  
  
/* 选项 Chip — 选中 */  
.option-chip.selected {  
  background: #2563eb;                          /* blue-600，或使用你的主色调 */  
  color: white;  
  border-color: #2563eb;  
}  
  
/* 确认按钮 */  
.confirm-button {  
  margin-top: 12px;  
  padding: 8px 24px;  
  border-radius: 20px;  
  background: #2563eb;  
  color: white;  
  font-size: 14px;  
  font-weight: 500;  
  border: none;  
  cursor: pointer;  
  transition: opacity 150ms ease;  
}  
  
.confirm-button:disabled {  
  opacity: 0.4;  
  cursor: not-allowed;  
}  
```  
  
### 4.3 选项排列规则  
  
- 2 个选项：水平一行排列  
- 3 个选项：水平一行排列（如果空间不够则 2+1 排列）  
- 4 个选项：2×2 网格排列  
- 使用 flexbox wrap，gap 为 8px  
  
```css  
.options-container {  
  display: flex;  
  flex-wrap: wrap;  
  gap: 8px;  
}  
```  
  
### 4.4 拖拽排序的视觉设计  
  
```css  
/* 排序项 */  
.rank-item {  
  display: flex;  
  align-items: center;  
  gap: 12px;  
  padding: 10px 16px;  
  background: white;  
  border: 1px solid rgba(0, 0, 0, 0.08);  
  border-radius: 12px;  
  margin-bottom: 6px;  
  cursor: grab;  
  transition: box-shadow 200ms ease, transform 200ms ease;  
}  
  
/* 排序项 — 拖拽中 */  
.rank-item.dragging {  
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);  
  transform: scale(1.02);  
  cursor: grabbing;  
  z-index: 10;  
}  
  
/* 序号 */  
.rank-number {  
  width: 24px;  
  height: 24px;  
  border-radius: 50%;  
  background: #e5e7eb;  
  color: #374151;  
  font-size: 12px;  
  font-weight: 600;  
  display: flex;  
  align-items: center;  
  justify-content: center;  
  flex-shrink: 0;  
}  
  
/* 拖拽手柄（6 个点的图标） */  
.drag-handle {  
  color: #9ca3af;  
  flex-shrink: 0;  
}  
```  
  
-----  
  
## 五、动画规格  
  
### 5.1 Widget 入场动画  
  
当 AI 响应中包含 interactive_input 时，widget 从底部滑入：  
  
```css  
/* 入场 */  
@keyframes slideUp {  
  from {  
    transform: translateY(20px);  
    opacity: 0;  
  }  
  to {  
    transform: translateY(0);  
    opacity: 1;  
  }  
}  
  
.interactive-widget.entering {  
  animation: slideUp 250ms ease-out forwards;  
}  
```  
  
### 5.2 Widget 退场动画  
  
用户确认选择后，widget 向下滑出消失：  
  
```css  
/* 退场 */  
@keyframes slideDown {  
  from {  
    transform: translateY(0);  
    opacity: 1;  
  }  
  to {  
    transform: translateY(20px);  
    opacity: 0;  
  }  
}  
  
.interactive-widget.exiting {  
  animation: slideDown 200ms ease-in forwards;  
}  
```  
  
### 5.3 选项点击反馈  
  
选中状态切换要即时，追求的是直接的反馈感：  
  
```css  
.option-chip {  
  /* 颜色变化 */  
  transition: background-color 150ms ease,  
              color 150ms ease,  
              border-color 150ms ease,  
              transform 100ms ease;  
}  
  
/* 点击瞬间的微缩放 — 给"按下去了"的触觉感 */  
.option-chip:active {  
  transform: scale(0.97);  
}  
  
/* 选中时的微弹跳 */  
.option-chip.selected {  
  animation: chipSelect 200ms ease;  
}  
  
@keyframes chipSelect {  
  0% { transform: scale(1); }  
  50% { transform: scale(1.03); }  
  100% { transform: scale(1); }  
}  
```  
  
### 5.4 拖拽排序动画  
  
其他选项让位时的平滑过渡：  
  
```css  
/* 非拖拽项的让位动画 */  
.rank-item {  
  transition: transform 200ms ease;  
}  
  
/* 建议使用 framer-motion 的 Reorder 组件或 @dnd-kit/sortable */  
/* 关键参数：letPosition 动画时长 200ms，使用 spring 或 ease-out */  
```  
  
### 5.5 多问题的级联入场  
  
如果有多个问题，不要同时出现，而是依次入场：  
  
```css  
.question-card:nth-child(1) { animation-delay: 0ms; }  
.question-card:nth-child(2) { animation-delay: 100ms; }  
.question-card:nth-child(3) { animation-delay: 200ms; }  
```  
  
-----  
  
## 六、React 组件实现指引  
  
### 6.1 核心组件：InteractiveInputWidget  
  
```tsx  
// components/chat/InteractiveInputWidget.tsx  
  
import React, { useState, useCallback } from 'react';  
import { motion, AnimatePresence, Reorder } from 'framer-motion';  
  
interface InteractiveQuestion {  
  id: string;  
  question: string;  
  type: 'single_select' | 'multi_select' | 'rank_priorities';  
  options: string[];  
}  
  
interface Props {  
  questions: InteractiveQuestion[];  
  onSubmit: (answers: Record<string, string[] | string>) => void;  
  onDismiss: () => void;  
}  
  
export function InteractiveInputWidget({ questions, onSubmit, onDismiss }: Props) {  
  const [answers, setAnswers] = useState<Record<string, string[]>>({});  
  const [isExiting, setIsExiting] = useState(false);  
  
  const handleSelect = (questionId: string, option: string, type: string) => {  
    setAnswers(prev => {  
      const current = prev[questionId] || [];  
      if (type === 'single_select') {  
        // 单选：切换或替换  
        return { ...prev, [questionId]: current[0] === option ? [] : [option] };  
      } else {  
        // 多选：切换  
        return {  
          ...prev,  
          [questionId]: current.includes(option)  
            ? current.filter(o => o !== option)  
            : [...current, option]  
        };  
      }  
    });  
  };  
  
  const handleReorder = (questionId: string, newOrder: string[]) => {  
    setAnswers(prev => ({ ...prev, [questionId]: newOrder }));  
  };  
  
  const canSubmit = questions.every(q => {  
    const answer = answers[q.id];  
    if (q.type === 'rank_priorities') return true; // 排序总是有效的  
    return answer && answer.length > 0;  
  });  
  
  const handleSubmit = () => {  
    setIsExiting(true);  
    setTimeout(() => {  
      onSubmit(answers);  
    }, 200); // 等退场动画结束  
  };  
  
  return (  
    <AnimatePresence>  
      {!isExiting && (  
        <motion.div  
          className="interactive-widget"  
          initial={{ y: 20, opacity: 0 }}  
          animate={{ y: 0, opacity: 1 }}  
          exit={{ y: 20, opacity: 0 }}  
          transition={{ duration: 0.25, ease: 'easeOut' }}  
        >  
          {questions.map((q, index) => (  
            <motion.div  
              key={q.id}  
              className="question-card"  
              initial={{ y: 10, opacity: 0 }}  
              animate={{ y: 0, opacity: 1 }}  
              transition={{ delay: index * 0.1, duration: 0.2 }}  
            >  
              <p className="question-title">{q.question}</p>  
  
              {q.type === 'rank_priorities' ? (  
                <RankPriorities  
                  questionId={q.id}  
                  options={answers[q.id] || q.options}  
                  onReorder={(newOrder) => handleReorder(q.id, newOrder)}  
                />  
              ) : (  
                <div className="options-container">  
                  {q.options.map(option => (  
                    <button  
                      key={option}  
                      className={`option-chip ${  
                        (answers[q.id] || []).includes(option) ? 'selected' : ''  
                      }`}  
                      onClick={() => handleSelect(q.id, option, q.type)}  
                    >  
                      {option}  
                    </button>  
                  ))}  
                </div>  
              )}  
            </motion.div>  
          ))}  
  
          <div className="widget-actions">  
            <button  
              className="confirm-button"  
              disabled={!canSubmit}  
              onClick={handleSubmit}  
            >  
              确认  
            </button>  
          </div>  
        </motion.div>  
      )}  
    </AnimatePresence>  
  );  
}  
```  
  
### 6.2 拖拽排序子组件  
  
```tsx  
// components/chat/RankPriorities.tsx  
  
import { Reorder } from 'framer-motion';  
  
interface Props {  
  questionId: string;  
  options: string[];  
  onReorder: (newOrder: string[]) => void;  
}  
  
export function RankPriorities({ questionId, options, onReorder }: Props) {  
  return (  
    <Reorder.Group  
      axis="y"  
      values={options}  
      onReorder={onReorder}  
      className="rank-list"  
    >  
      {options.map((option, index) => (  
        <Reorder.Item  
          key={option}  
          value={option}  
          className="rank-item"  
          whileDrag={{  
            scale: 1.02,  
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)',  
          }}  
          transition={{ duration: 0.2 }}  
        >  
          <span className="rank-number">{index + 1}</span>  
          <span className="rank-label">{option}</span>  
          <span className="drag-handle">⋮⋮</span>  
        </Reorder.Item>  
      ))}  
    </Reorder.Group>  
  );  
}  
```  
  
### 6.3 在 ChatInterface 中集成  
  
```tsx  
// 在主聊天界面组件中  
  
function ChatInterface() {  
  const [interactiveInput, setInteractiveInput] = useState<InteractiveQuestion[] | null>(null);  
  
  // 处理 AI 响应  
  const handleAIResponse = (response: any) => {  
    if (response.type === 'interactive_input') {  
      // 显示文字消息  
      addMessage({ role: 'assistant', content: response.message });  
      // 显示 widget  
      setInteractiveInput(response.questions);  
    } else {  
      // 普通文字消息  
      addMessage({ role: 'assistant', content: response.content });  
    }  
  };  
  
  // 处理用户通过 widget 提交的选择  
  const handleInteractiveSubmit = (answers: Record<string, string[]>) => {  
    // 1. 清除 widget  
    setInteractiveInput(null);  
  
    // 2. 组装为用户消息显示在对话流中  
    const displayText = formatAnswersForDisplay(answers);  
    addMessage({ role: 'user', content: displayText });  
  
    // 3. 将结构化数据发送给 AI  
    sendToAI({  
      type: 'interactive_response',  
      answers: answers  
    });  
  };  
  
  return (  
    <div className="chat-interface">  
      <MessageList messages={messages} />  
  
      {/* 交互式输入层 — 位于输入框上方 */}  
      <AnimatePresence>  
        {interactiveInput && (  
          <InteractiveInputWidget  
            questions={interactiveInput}  
            onSubmit={handleInteractiveSubmit}  
            onDismiss={() => setInteractiveInput(null)}  
          />  
        )}  
      </AnimatePresence>  
  
      {/* 输入框始终可见 */}  
      <ChatInput onSend={handleSend} />  
    </div>  
  );  
}  
```  
  
-----  
  
## 七、AI Prompt 层适配  
  
在 Buddy AI 的 AI system prompt 中，需要告诉 AI 何时使用交互式输入，何时用普通文字：  
  
### 7.1 使用交互式输入的场景  
  
```  
使用 ask_user_input 工具的条件：  
- 需要用户从 2-4 个明确选项中做选择  
- 选项是预定义的、有限的（部门列表、优先级、任务类型等）  
- 选项可以用简短标签表达（每个选项不超过 10 个字）  
  
不要使用的条件：  
- 开放式问题（"你想怎么做？"）  
- 需要用户输入具体文字（名称、描述、日期等）  
- 选项超过 4 个  
- 选项需要长文本解释  
```  
  
### 7.2 Buddy AI 特定场景映射  
  
|场景      |类型             |示例                     |  
|--------|---------------|-----------------------|  
|任务归属部门  |single_select  |[产品部] [技术部] [运营部] [市场部]|  
|任务优先级   |single_select  |[紧急] [高] [中] [低]       |  
|AI权责判定  |single_select  |[本职工作] [延伸任务] [额外贡献]   |  
|涉及部门（多个）|multi_select   |[产品部] [技术部] [运营部]      |  
|任务依赖    |multi_select   |[任务A] [任务B] [任务C]      |  
|目标优先级排序 |rank_priorities|[成本] [速度] [质量] [满意度]   |  
|审批流程选择  |single_select  |[直接审批] [部门主管审批] [跨部门审批]|  
  
-----  
  
## 八、实现优先级与步骤  
  
### Phase 1：基础单选（先做最小可用版本）  
  
1. 定义 `InteractiveInputResponse` 数据结构  
1. 实现 `InteractiveInputWidget` 组件（仅 single_select）  
1. 在 ChatInterface 中集成 widget 层  
1. 实现入场/退场动画  
1. 实现选择结果回传为用户消息  
1. 在 AI prompt 中添加 `ask_user_input` tool 定义  
  
### Phase 2：完善交互类型  
  
1. 添加 multi_select 支持  
1. 添加 rank_priorities 支持（需要 framer-motion Reorder 或 @dnd-kit）  
1. 支持多问题级联展示  
  
### Phase 3：体验打磨  
  
1. 点击反馈微动画（scale bounce）  
1. 移动端适配与触摸拖拽优化  
1. 用户直接打字时自动收起 widget  
1. 错误处理（AI 返回无效数据时的 fallback）  
  
-----  
  
## 九、注意事项  
  
1. **不要破坏现有聊天功能** — Widget 是额外层，ChatInput 始终保持正常工作  
1. **framer-motion 依赖** — 如果项目中还没有 framer-motion，需要先安装：`npm install framer-motion`  
1. **与 streaming 的配合** — AI 响应如果是 streaming 的，需要在 stream 完成后再渲染 widget（不要在 streaming 过程中就弹出）  
1. **暗色模式** — 如果有暗色模式支持，widget 的配色需要相应适配  
1. **键盘可访问性** — 选项应该可以用 Tab 键导航、Enter/Space 选择  
1. **每次只显示一个 widget** — 新的 interactive_input 响应应该替换旧的，不要同时显示多个  
