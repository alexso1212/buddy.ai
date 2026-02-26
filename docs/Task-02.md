# Task 02: 流式性能优化 + 错误处理增强  
  
> 此任务提升 AI 回复的流畅度和错误恢复体验，对标 Claude Chat 级别的”打字机”手感  
  
## 前置条件  
  
Task 01（流式中断修复）已完成并验证通过。  
  
-----  
  
## 修改 1: Token 缓冲从 50ms setTimeout 改为 requestAnimationFrame  
  
**文件**: Agent 页和 GraphChatFloat 中处理 SSE `token` 事件的位置  
  
**当前逻辑**:  
  
```javascript  
// 收到 token → 追加到 buffer  
// 50ms setTimeout → flush buffer 到 state  
tokenBuffer += event.content;  
if (!flushTimer) {  
  flushTimer = setTimeout(() => {  
    // flush buffer to message state  
    flushTimer = null;  
  }, 50);  
}  
```  
  
**修改为 requestAnimationFrame 方案**:  
  
```javascript  
// 在 handleSend 或流处理函数的作用域内声明  
let tokenBuffer = '';  
let rafId: number | null = null;  
  
// 收到 token 事件时  
case 'token':  
  tokenBuffer += event.content;  
  if (!rafId) {  
    rafId = requestAnimationFrame(() => {  
      // 将累积的 buffer 一次性 flush 到消息 state  
      setMessages(prev => {  
        const updated = [...prev];  
        const lastMsg = updated[updated.length - 1];  
        if (lastMsg && lastMsg.role === 'assistant') {  
          lastMsg.content += tokenBuffer;  
        }  
        return updated;  
      });  
      tokenBuffer = '';  
      rafId = null;  
    });  
  }  
  break;  
```  
  
**流结束时清理**（在 `finally` 块中）:  
  
```javascript  
finally {  
  if (rafId) {  
    cancelAnimationFrame(rafId);  
    // flush 剩余 buffer  
    if (tokenBuffer) {  
      setMessages(prev => {  
        const updated = [...prev];  
        const lastMsg = updated[updated.length - 1];  
        if (lastMsg && lastMsg.role === 'assistant') {  
          lastMsg.content += tokenBuffer;  
        }  
        return updated;  
      });  
      tokenBuffer = '';  
    }  
    rafId = null;  
  }  
}  
```  
  
**为什么这样做**: requestAnimationFrame 每帧（~16ms）最多 flush 一次，比 50ms 快 3 倍，但不会过度 re-render，因为浏览器保证每帧只执行一次。视觉效果从”一块一块跳”变成”平滑打字”。  
  
**Agent 页和 GraphChatFloat 都要改**，保持一致。  
  
-----  
  
## 修改 2: 分阶段超时检测  
  
**文件**: Agent 页和 GraphChatFloat 中的超时检测逻辑  
  
**当前逻辑**:  
  
```javascript  
// 单一 45 秒超时  
const timeoutInterval = setInterval(() => {  
  if (Date.now() - lastEventTime > 45000) {  
    isTimeoutAbort = true;  
    abortController.abort();  
  }  
}, 5000);  
```  
  
**修改为两阶段检测**:  
  
```javascript  
let hasReceivedFirstToken = false;  
let lastEventTime = Date.now();  
  
const timeoutInterval = setInterval(() => {  
  const elapsed = Date.now() - lastEventTime;  
    
  if (!hasReceivedFirstToken) {  
    // 阶段1: 等待首个 token — 20秒超时  
    // 首次连接、路由、AI 开始生成，不应超过 20 秒  
    if (elapsed > 20000) {  
      isTimeoutAbort = true;  
      abortController.abort();  
    }  
  } else {  
    // 阶段2: 已开始生成 — 30秒无新 token 超时  
    // Extended Thinking 模式下 thinking 事件也算活跃  
    if (elapsed > 30000) {  
      isTimeoutAbort = true;  
      abortController.abort();  
    }  
  }  
}, 3000); // 检查频率从 5 秒改为 3 秒，更及时  
  
// 在处理 token / thinking / search_results 等事件时更新:  
lastEventTime = Date.now();  
if (event.type === 'token' || event.type === 'thinking') {  
  hasReceivedFirstToken = true;  
}  
```  
  
**清理不变**: `finally` 块中 `clearInterval(timeoutInterval)`。  
  
-----  
  
## 修改 3: 错误分类扩展  
  
**文件**: Agent 页和 GraphChatFloat 中 catch 块的错误分类逻辑  
  
**当前逻辑** (4 种):  
  
```javascript  
if (err.name === 'AbortError' && isTimeoutAbort) → 'timeout'  
else if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) → 'network'    
else if (msg.includes('rate') || msg.includes('429')) → 'rate_limit'  
else → 'unknown'  
```  
  
**扩展为 7 种**:  
  
```javascript  
function classifyError(err: Error, isTimeoutAbort: boolean, response?: Response): {  
  type: string;  
  message: string;  
  canRetry: boolean;  
} {  
  const msg = err.message?.toLowerCase() || '';  
    
  // 用户主动停止 — 不是错误，不显示错误消息  
  if (err.name === 'AbortError' && !isTimeoutAbort) {  
    return { type: 'user_abort', message: '', canRetry: false };  
  }  
    
  // 超时  
  if (err.name === 'AbortError' && isTimeoutAbort) {  
    return { type: 'timeout', message: 'AI 响应超时，请重试', canRetry: true };  
  }  
    
  // 网络错误  
  if (msg.includes('failed to fetch') || msg.includes('networkerror') || msg.includes('net::')) {  
    return { type: 'network', message: '网络连接失败，请检查网络后重试', canRetry: true };  
  }  
    
  // 频率限制  
  if (msg.includes('rate') || msg.includes('429') || msg.includes('too many')) {  
    return { type: 'rate_limit', message: 'AI 服务繁忙，请稍等 30 秒后重试', canRetry: true };  
  }  
    
  // 认证失败 (来自服务端响应)  
  if (msg.includes('401') || msg.includes('unauthorized') || msg.includes('authentication')) {  
    return { type: 'auth', message: '登录已过期，请刷新页面重新登录', canRetry: false };  
  }  
    
  // 上下文过长  
  if (msg.includes('context') || msg.includes('token limit') || msg.includes('too long')) {  
    return { type: 'context_limit', message: '对话太长了，请开始新对话继续', canRetry: false };  
  }  
    
  // 服务端错误  
  if (msg.includes('500') || msg.includes('internal server') || msg.includes('502') || msg.includes('503')) {  
    return { type: 'server', message: '服务器暂时出错，请稍后重试', canRetry: true };  
  }  
    
  // 未知错误  
  return { type: 'unknown', message: `出现未知错误: ${err.message}`, canRetry: true };  
}  
```  
  
**使用方式**:  
  
```javascript  
catch (err) {  
  const error = classifyError(err, isTimeoutAbort);  
    
  // 用户主动停止，不追加错误消息  
  if (error.type === 'user_abort') {  
    // 保留已接收的部分回复  
    return;  
  }  
    
  // 移除未完成的 assistant 消息  
  // ...  
    
  // 追加系统错误消息  
  appendSystemMessage({  
    content: error.message,  
    retryPayload: error.canRetry ? { text, attachments } : undefined,  
    errorType: error.type,  
  });  
}  
```  
  
**UI 侧的区分**:  
  
- `canRetry: true` → 显示重试按钮  
- `canRetry: false` → 不显示重试按钮，改为显示对应操作引导（如”刷新页面”或”开始新对话”按钮）  
  
**服务端也需要配合**: 在 `/api/ai/chat/stream` 中，当捕获到 AI API 错误时，通过 SSE 发送结构化 error 事件：  
  
```javascript  
// 服务端 catch 块  
catch (err) {  
  let errorMessage = err.message;  
    
  // 如果是 Anthropic API 的 context length 错误  
  if (err.message?.includes('max_tokens') || err.status === 400) {  
    errorMessage = 'context_limit: 对话上下文超出模型限制';  
  }  
    
  res.write(`data: ${JSON.stringify({ type: 'error', content: errorMessage })}\n\n`);  
  res.end();  
}  
```  
  
-----  
  
## 修改 4: 自动滚动优化  
  
**文件**: Agent 页中处理消息区域滚动的逻辑  
  
**当前逻辑**:  
  
```javascript  
// 120px 阈值判断 isNearBottom  
const isNearBottom = scrollTop + clientHeight >= scrollHeight - 120;  
```  
  
**增加 userHasScrolledUp 标记**:  
  
```javascript  
const userHasScrolledUpRef = useRef(false);  
  
// 在 onScroll handler 中  
const handleScroll = () => {  
  const { scrollTop, clientHeight, scrollHeight } = messagesContainerRef.current;  
  const distanceFromBottom = scrollHeight - scrollTop - clientHeight;  
    
  // 用户主动上滚超过一屏高度 → 停止自动跟随  
  if (distanceFromBottom > clientHeight) {  
    userHasScrolledUpRef.current = true;  
  }  
    
  // 用户滚回底部附近 → 恢复自动跟随  
  if (distanceFromBottom < 120) {  
    userHasScrolledUpRef.current = false;  
  }  
    
  // 更新"滚到底部"按钮的显示状态  
  setShowScrollButton(distanceFromBottom > 120);  
};  
  
// 在 token flush / messages 更新的 useEffect 中  
useEffect(() => {  
  if (!userHasScrolledUpRef.current) {  
    scrollToBottom();  
  }  
}, [messages]);  
  
// 用户发送新消息时强制滚到底  
const handleSend = async (text, attachments) => {  
  userHasScrolledUpRef.current = false; // ← 重置  
  scrollToBottom();  
  // ... 发送逻辑  
};  
  
// 点击"滚到底部"按钮时也重置  
const handleScrollToBottomClick = () => {  
  userHasScrolledUpRef.current = false;  
  scrollToBottom({ behavior: 'smooth' });  
};  
```  
  
-----  
  
## 验证步骤  
  
1. **流畅度**: 发送一个会产生长回复的问题（如”详细解释量子计算”），观察文字是否像打字机一样平滑流出，而非一块一块跳动  
1. **超时**:  
- 断开网络后发送消息 → 应在约 20 秒内显示超时错误（而非 45 秒）  
- Extended Thinking 开启时发送消息 → thinking 阶段不应触发超时  
1. **错误分类**:  
- 断网 → 显示”网络连接失败” + 重试按钮  
- 发一个超长对话 → 显示”对话太长了” + “开始新对话”按钮（无重试按钮）  
1. **自动滚动**:  
- AI 回复中不动 → 自动跟随到底  
- AI 回复中向上滚动浏览之前的消息 → 停止跟随，底部出现”滚到底部”按钮  
- 点击”滚到底部”按钮 → 恢复跟随  
- 发送新消息 → 强制滚到底  
  
## 不要改动的部分  
  
- SSE 事件类型定义和解析逻辑  
- 消息持久化逻辑  
- 确认卡片的交互流程  
- ThinkingBlock 的展开/折叠逻辑  
