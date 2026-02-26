# Task 01: 流式中断修复（最高优先级）

> ⚠️ 此任务修复的是真金白银的 bug — 用户离开页面后服务端仍在消耗 token 生成无人接收的回复

## 背景

当前 Agent 页和 GraphChatFloat 存在流式请求不中断的问题：

- 切换对话时旧流不中断，且新对话被 guard 阻止加载
- 导航离开 `/agent` 页时流在后台继续
- 关闭 GraphChatFloat 面板时流不中断
- 页面刷新/关闭时流不中断

## 修改 1: Agent 页 — 切换对话时 abort 旧流并加载新对话

**文件**: Agent 聊天页的主组件（包含 `useEffect` 监听 `conv` 参数变化的文件）

**当前代码逻辑**:

```javascript
// 当 conv 参数变化时
useEffect(() => {
  if (isStreamingRef.current) return; // ← 问题：直接跳过，不加载新对话
  // ... 加载对话消息
}, [convId]);
```

**修改为**:

```javascript
useEffect(() => {
  // 如果有正在进行的流，先中断它
  if (isStreamingRef.current) {
    abortControllerRef.current?.abort();
    isStreamingRef.current = false;
    setIsLoading(false); // 重置 loading 状态
  }

  // 然后正常加载新对话
  if (convId) {
    loadConversationMessages(convId);
  } else {
    // 新对话，清空消息
    setMessages([]);
  }
}, [convId]);
```

**关键点**: 删除 `if (isStreamingRef.current) return` 这个 guard，改为先 abort 再加载。

## 修改 2: Agent 页 — 导航离开时 abort

**文件**: 同上，Agent 聊天页主组件

**在组件中添加 cleanup useEffect**:

```javascript
// 组件卸载时中断流
useEffect(() => {
  return () => {
    abortControllerRef.current?.abort();
  };
}, []);
```

**额外添加 beforeunload 监听**（防止刷新/关闭标签页时浪费 token）:

```javascript
useEffect(() => {
  const handleBeforeUnload = () => {
    abortControllerRef.current?.abort();
  };
  window.addEventListener('beforeunload', handleBeforeUnload);
  return () => {
    window.removeEventListener('beforeunload', handleBeforeUnload);
    abortControllerRef.current?.abort(); // 卸载时也 abort
  };
}, []);
```

## 修改 3: GraphChatFloat — 关闭面板时 abort

**文件**: GraphChatFloat 组件

**在关闭/隐藏面板的 handler 中添加**:

```javascript
const handleClose = () => {
  // 中断正在进行的流
  abortControllerRef.current?.abort();
  isStreamingRef.current = false;
  setIsLoading(false);

  // 原有的关闭逻辑
  setIsOpen(false);
  // ...
};
```

## 修改 4: 服务端配合 — 检测客户端断开

**文件**: `/api/ai/chat/stream` 的路由 handler

在 SSE 流式推送循环中，添加对客户端断开的检测：

```javascript
// 监听客户端断开
req.on('close', () => {
  // 如果 AI 调用支持 abort，在这里中断
  // 例如 Anthropic SDK 的 AbortController
  if (aiAbortController) {
    aiAbortController.abort();
  }
  console.log(`Client disconnected, stream aborted for conv ${conversationId}`);
});
```

这样当前端 abort fetch 后，服务端也能感知到并停止调用 AI API，真正节省 token。

## 验证步骤

完成后请逐一验证：

1. **切换对话**: 发送一条消息，AI 正在回复时点击侧边栏切换到另一个对话 → 旧流应立即中断，新对话正常加载
1. **导航离开**: AI 正在回复时点击导航到其他页面（如 `/tasks`）→ 检查 Network 面板，fetch 请求应变为 cancelled
1. **关闭 GraphChatFloat**: 在图谱页发送消息，AI 回复中关闭面板 → 再次打开面板，不应有残留的 loading 状态
1. **页面刷新**: AI 回复中刷新页面 → 检查服务端日志，应看到 “Client disconnected” 日志
1. **正常停止**: 点击停止按钮仍然正常工作
1. **正常完成**: 不中断的情况下 AI 正常回复完成，功能无回归

## 不要改动的部分

- `handleSend` 开头的 abort 旧流逻辑（已经正确）
- `handleRegenerate` / `handleEditMessage` 的 abort 逻辑（已经正确）
- 50ms token buffer 逻辑（下个任务处理）
- 错误分类逻辑（下个任务处理）