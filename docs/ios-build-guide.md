# Buddy iOS 打包指南（TestFlight）

本指南帮助你将 Buddy Web App 通过 Capacitor 封装为 iOS App，并上传到 TestFlight 供团队测试。

---

## 前置准备

### 你需要的东西

| 项目 | 说明 |
|------|------|
| **Mac 电脑** | 运行 Xcode（MacBook Air 即可） |
| **Xcode** | 从 Mac App Store 免费下载（约 12GB） |
| **Apple 开发者账号** | developer.apple.com 注册，年费 $99 |
| **Node.js** | 建议 v20+，从 nodejs.org 下载 |
| **Git** | Mac 自带，或通过 Xcode Command Line Tools 安装 |

### Apple 开发者账号注册

1. 打开 [developer.apple.com](https://developer.apple.com)
2. 点击「Account」→ 用你的 Apple ID 登录
3. 加入 Apple Developer Program（$99/年）
4. 审核通常 1-2 个工作日

---

## 第一次打包

### 1. 克隆项目

```bash
git clone <你的项目 Git 地址> buddy-app
cd buddy-app
npm install
```

### 2. 安装 Capacitor CLI 和 iOS 平台

```bash
npm install @capacitor/core @capacitor/cli @capacitor/ios
npx cap add ios
```

### 3. 配置部署地址

打开 `capacitor.config.ts`，确认 `server.url` 是你的部署地址：

```typescript
server: {
  url: 'https://你的域名.replit.app',
  cleartext: true,
},
```

> 重要：这个地址就是你在 Replit 上部署的线上版本。App 打开后会加载这个网址，所以后续在 Replit 上更新代码并部署后，App 中的内容会自动更新。

### 4. 同步到 iOS 项目

```bash
npx cap sync ios
```

### 5. 打开 Xcode 项目

```bash
npx cap open ios
```

这会自动打开 Xcode，加载 `ios/App/App.xcworkspace`。

### 6. 配置签名

1. 在 Xcode 左侧文件树中，点击顶层的「App」项目
2. 选择「Signing & Capabilities」标签
3. 勾选「Automatically manage signing」
4. 在「Team」下拉菜单中选择你的 Apple 开发者账号
5. 「Bundle Identifier」应该是 `com.deltapex.buddy`

### 7. 设置 App 图标

1. 在 Xcode 左侧找到 `App/Assets.xcassets/AppIcon`
2. 将你的 1024x1024 App 图标拖入（Xcode 会自动生成其他尺寸）

> 注意：当前项目自带的图标是 128x128 的占位图，建议替换为高清版本。

### 8. 构建并运行测试

1. 在 Xcode 顶部选择模拟器（如 iPhone 15）
2. 点击 ▶️ 运行按钮
3. 确认 App 能正常加载和使用

### 9. Archive 并上传

1. 在 Xcode 顶部将设备切换为「Any iOS Device (arm64)」
2. 菜单栏：Product → Archive
3. Archive 完成后会自动弹出 Organizer 窗口
4. 选择刚生成的 Archive → 点击「Distribute App」
5. 选择「App Store Connect」→ 点击「Distribute」
6. 等待上传完成（几分钟）

### 10. 在 App Store Connect 发布到 TestFlight

1. 打开 [appstoreconnect.apple.com](https://appstoreconnect.apple.com)
2. 找到你的 App → 点击「TestFlight」标签
3. 等待 Apple 处理完成（通常 10-30 分钟）
4. 处理完成后，添加内部测试员（最多 100 人）
5. 测试员会收到邮件邀请，下载 TestFlight App 即可安装

---

## 后续更新

### 只改了代码/功能（最常见）

在 Replit 上修改代码 → 重新部署 → **完毕**

用户打开 App 会自动加载最新版本，不需要重新打包。

### 需要重新打包的情况

以下改动需要在 Mac 上重新 Archive 并上传：

| 改动 | 需要重新打包 |
|------|:-:|
| 修改了 App 图标 | ✅ |
| 修改了 App 名称 | ✅ |
| 修改了 Bundle ID | ✅ |
| 添加了原生插件（推送通知等） | ✅ |
| 修改了启动画面 | ✅ |
| 修改了 Web 端功能/页面/样式 | ❌ |
| 修复了 Bug | ❌ |
| 添加了新页面 | ❌ |

重新打包步骤：

```bash
cd buddy-app
git pull                  # 拉取最新代码
npx cap sync ios          # 同步变更到 iOS 项目
npx cap open ios          # 打开 Xcode
# 然后重复 Archive → 上传流程
```

---

## App 信息填写参考

在 App Store Connect 创建 App 时需要填写以下信息：

| 字段 | 建议内容 |
|------|----------|
| App 名称 | Buddy |
| 副标题 | AI 驱动的团队任务协作 |
| Bundle ID | com.deltapex.buddy |
| SKU | buddy-task-center |
| 主要语言 | 简体中文 |
| 类别 | 商务 / 效率 |

---

## 常见问题

**Q: 为什么 App 打开后显示白屏？**
A: 检查 `capacitor.config.ts` 中的 `server.url` 是否正确，以及部署的服务是否正在运行。

**Q: 每次更新代码都要重新打包吗？**
A: 不需要。因为 App 加载的是你的线上网址，在 Replit 上部署后 App 会自动显示最新内容。

**Q: TestFlight 审核要多久？**
A: 内部测试通常 10-30 分钟就能通过。外部测试（公开链接）需要 Apple 审核，通常 1-2 天。

**Q: 可以同时给 Android 用吗？**
A: 可以，运行 `npx cap add android` 添加 Android 平台，用 Android Studio 打包。

**Q: 试用阶段不想花 $99 怎么办？**
A: 你可以用免费的 Apple ID 在 Xcode 中直接安装到自己的 iPhone（有效期 7 天），但无法上传 TestFlight。
