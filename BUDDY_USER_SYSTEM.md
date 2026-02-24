# Buddy App — 用户管理系统规格书

# 直接给 Replit Agent 执行，按顺序做，每步完成后确认再继续

-----

## 背景

当前 Bug：用户发送消息时，创建对话报错 500：

```
insert or update on table "conversations" violates foreign key constraint "conversations_org_id_organizations_id_fk"
```

原因：conversations 表要求 org_id 必须关联一个真实存在的 organization 记录，但系统没有用户注册流程，organization 从未被创建过。

解决方案：搭建完整的用户注册/登录系统，注册时自动创建组织。

-----

# STEP 0：紧急修复（先让 App 能用）

在做完整用户系统之前，先做一个临时修复让现有用户不再报错。

### 做法：

1. 检查数据库里 `organizations` 表是否有记录
1. 如果没有，插入一条默认组织：

```sql
INSERT INTO organizations (id, name, created_at, updated_at)
VALUES (gen_random_uuid(), 'Default Organization', NOW(), NOW());
```

1. 把所有现有 users 的 org_id 更新为这个组织的 id
1. 确认 App 能正常发消息、创建对话后，继续 STEP 1

-----

# STEP 1：数据库 Schema 调整

### 1.1 users 表（如果已存在则修改，不存在则创建）

确保 users 表有以下字段：

```
users
├── id             UUID, 主键, 默认 gen_random_uuid()
├── email          TEXT, 唯一, NOT NULL
├── password_hash  TEXT, NOT NULL
├── name           TEXT, NOT NULL（显示名称，比如 "Alexso"）
├── avatar_url     TEXT, 可空
├── org_id         UUID, 外键 → organizations.id, 可空
├── role           TEXT, 默认 'member'（可选值：'owner', 'admin', 'member'）
├── created_at     TIMESTAMP, 默认 NOW()
├── updated_at     TIMESTAMP, 默认 NOW()
└── last_login_at  TIMESTAMP, 可空
```

### 1.2 organizations 表（如果已存在则检查字段）

```
organizations
├── id             UUID, 主键, 默认 gen_random_uuid()
├── name           TEXT, NOT NULL
├── created_at     TIMESTAMP, 默认 NOW()
└── updated_at     TIMESTAMP, 默认 NOW()
```

### 1.3 conversations 表调整

把 `org_id` 的外键约束改为 **可空**（允许 NULL），这样个人用户不属于组织也能创建对话。同时加一个 `user_id` 字段：

```
conversations 新增/修改字段
├── user_id        UUID, 外键 → users.id, NOT NULL
└── org_id         UUID, 外键 → organizations.id, 可空（改为可空）
```

### 1.4 用 Drizzle ORM 执行

用项目现有的 Drizzle ORM 来写 schema 定义和 migration，不要手写 SQL 文件。确保执行 `drizzle-kit push` 或 `drizzle-kit migrate` 让数据库同步。

-----

# STEP 2：后端 API 路由

### 2.1 注册接口 POST /api/auth/register

请求体：

```json
{
  "email": "user@example.com",
  "password": "至少8位",
  "name": "显示名称"
}
```

处理逻辑：

1. 验证 email 格式，检查是否已注册
1. 用 bcrypt 哈希密码（安装 bcryptjs）
1. 创建一条 organization 记录（名称用 “XXX的团队” 格式）
1. 创建一条 user 记录，role 设为 ‘owner’，关联刚创建的 org_id
1. 生成 JWT token（安装 jsonwebtoken），包含 { userId, orgId, role }
1. 返回 { token, user: { id, email, name, role, orgId } }

### 2.2 登录接口 POST /api/auth/login

请求体：

```json
{
  "email": "user@example.com",
  "password": "密码"
}
```

处理逻辑：

1. 查找用户
1. bcrypt.compare 验证密码
1. 更新 last_login_at
1. 生成 JWT token
1. 返回 { token, user: { id, email, name, role, orgId } }

### 2.3 获取当前用户 GET /api/auth/me

请求头：`Authorization: Bearer <token>`

处理逻辑：

1. 验证 JWT token
1. 用 token 中的 userId 查用户信息
1. 返回 { user: { id, email, name, role, orgId, orgName } }

### 2.4 认证中间件

创建一个 `authMiddleware` 函数：

1. 从请求头取 Authorization Bearer token
1. 验证 JWT，提取 userId 和 orgId
1. 把 userId 和 orgId 附加到 request 对象上
1. 所有需要登录的接口（/api/chat, /api/conversations 等）都要经过这个中间件

### 2.5 环境变量

在 Replit Secrets 中添加：

```
JWT_SECRET=随机生成一个32位以上的字符串
```

### 2.6 安装依赖

```bash
npm install bcryptjs jsonwebtoken
npm install -D @types/bcryptjs @types/jsonwebtoken
```

-----

# STEP 3：修改现有对话接口

### 3.1 创建对话时

当前代码创建 conversation 时直接写入 org_id，改成从认证中间件获取：

```typescript
// 改之前（大概是这样硬编码或从某处取值）：
// org_id: someHardcodedOrInvalidValue

// 改之后：
const newConversation = {
  id: crypto.randomUUID(),
  userId: req.userId,          // 从认证中间件来
  orgId: req.orgId || null,    // 从认证中间件来，可以为空
  title: '新对话',
  createdAt: new Date(),
  updatedAt: new Date(),
};
```

### 3.2 查询对话列表时

只返回当前用户的对话：

```typescript
// 改之后：
const conversations = await db
  .select()
  .from(conversationsTable)
  .where(eq(conversationsTable.userId, req.userId))
  .orderBy(desc(conversationsTable.updatedAt));
```

-----

# STEP 4：前端登录/注册页面

### 4.1 创建登录注册页面

文件位置：创建新的页面组件（比如 `AuthPage.tsx` 或在现有路由下添加）

**UI 设计要求：保持 Buddy 现有的深色暖棕风格**

页面布局：

```
┌──────────────────────────────────┐
│                                  │
│         Buddy Logo/标题           │
│                                  │
│  ┌────────────────────────────┐  │
│  │  [登录]  |  [注册]  切换    │  │
│  ├────────────────────────────┤  │
│  │                            │  │
│  │  邮箱输入框                 │  │
│  │                            │  │
│  │  密码输入框                 │  │
│  │                            │  │
│  │  （注册模式多一个）名称输入框│  │
│  │                            │  │
│  │  [登录/注册 按钮]           │  │
│  │                            │  │
│  └────────────────────────────┘  │
│                                  │
└──────────────────────────────────┘
```

样式参数（保持 Buddy 风格）：

- 页面背景：`#2B2A27`
- 卡片背景：`#353430`
- 输入框背景：`#2B2A27`
- 输入框边框：`#4A4A47`
- 输入框聚焦边框：`#AE5630`（Buddy 橙）
- 按钮背景：`#AE5630`
- 按钮文字：`#FFFFFF`
- 标题文字：`#ECECEC`
- 辅助文字：`#9A9893`
- 字体：系统 Sans-serif（登录页不用衬线体）

### 4.2 Token 存储

登录/注册成功后：

```typescript
// 存 token
localStorage.setItem('buddy_token', response.token);
// 存用户信息
localStorage.setItem('buddy_user', JSON.stringify(response.user));
```

### 4.3 路由守卫

在 App 的最外层加登录状态判断：

```typescript
function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 启动时检查是否已登录
    const token = localStorage.getItem('buddy_token');
    if (token) {
      // 调 /api/auth/me 验证 token 是否有效
      fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` }
      })
      .then(res => res.json())
      .then(data => {
        if (data.user) setUser(data.user);
        else localStorage.removeItem('buddy_token');
      })
      .catch(() => localStorage.removeItem('buddy_token'))
      .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  if (loading) return <LoadingScreen />;
  if (!user) return <AuthPage onSuccess={setUser} />;
  return <MainApp user={user} />;
}
```

### 4.4 所有 API 请求带 Token

修改所有 fetch 调用（特别是 /api/chat），在请求头里带上 token：

```typescript
const token = localStorage.getItem('buddy_token');

fetch('/api/chat', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,   // ← 加这行
  },
  body: JSON.stringify({ messages }),
});
```

### 4.5 侧边栏底部用户信息

侧边栏底部已经有用户头像区域（显示 “Alexso”），改成从登录用户信息动态显示：

```typescript
// 之前可能是硬编码的
// <span>Alexso</span>

// 改成：
<span>{user.name}</span>
```

点击头像弹出的菜单里加一个 **退出登录** 按钮：

```typescript
function handleLogout() {
  localStorage.removeItem('buddy_token');
  localStorage.removeItem('buddy_user');
  window.location.reload();  // 刷新回到登录页
}
```

-----

# STEP 5：邀请成员加入组织（基础版）

> 这一步可以先跳过，等前面 4 步全部跑通后再做

### 5.1 邀请接口 POST /api/org/invite

仅 owner 和 admin 可调用。

请求体：

```json
{
  "email": "newmember@example.com",
  "role": "member"
}
```

处理逻辑：

1. 检查当前用户是否是 owner/admin
1. 如果被邀请的 email 已注册 → 直接把他的 org_id 更新为当前组织
1. 如果未注册 → 创建一条邀请记录（需要新建 invitations 表），等他注册时自动加入

### 5.2 invitations 表

```
invitations
├── id             UUID, 主键
├── org_id         UUID, 外键 → organizations.id
├── email          TEXT, NOT NULL
├── role           TEXT, 默认 'member'
├── status         TEXT, 默认 'pending'（pending/accepted/expired）
├── invited_by     UUID, 外键 → users.id
├── created_at     TIMESTAMP
└── expires_at     TIMESTAMP（7天后过期）
```

### 5.3 注册时检查邀请

在注册接口（STEP 2.1）的逻辑里加一步：

1. 注册成功后，查 invitations 表是否有这个 email 的待处理邀请
1. 如果有 → 自动把用户加入对应组织，不创建新组织
1. 如果没有 → 正常创建新组织

-----

# 执行指引

## 给 Replit Agent 的指令：

> 请阅读项目根目录中的 `BUDDY_USER_SYSTEM.md`，这是一份用户管理系统的开发规格书。
> 
> 从 STEP 0 开始执行（紧急修复），每完成一个 STEP 停下来告诉我完成了什么，等我确认后再做下一步。
> 
> 重要原则：
> 
> 1. 用项目现有的技术栈（TypeScript, React, PostgreSQL, Drizzle ORM）
> 1. 不要引入新的框架（不要加 Next-Auth、Passport 等）
> 1. 保持现有 UI 风格不变
> 1. 每一步做完后确保 App 能正常运行，不要一次性改太多导致全部崩溃

## 检查清单

每步完成后检查：

- [ ] STEP 0：App 能正常发消息不再报 500 错误
- [ ] STEP 1：数据库表结构正确，drizzle-kit 同步成功
- [ ] STEP 2：/api/auth/register 和 /api/auth/login 能正常返回 token
- [ ] STEP 3：对话创建使用登录用户的信息，不再硬编码
- [ ] STEP 4：打开 App 看到登录页，注册后自动进入主界面，刷新页面保持登录状态
- [ ] STEP 5：（可选）能邀请成员加入组织