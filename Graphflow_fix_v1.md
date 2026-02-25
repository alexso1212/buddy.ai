## 紧急修复：节点抖动 + 飞出屏幕导致卡顿闪退

有两个严重问题需要修复：

### 问题1：节点之间剧烈抖动

原因：排斥力在近距离时数值爆炸，导致节点每帧被弹开很远，下一帧又被吸引力拉回，来回震荡。

修复方案：

1. 排斥力必须设上限（force clamping）
```js
// 修改前（力会无限大）：
let repulsion = strength / (distance * distance);

// 修改后（钳制最大力）：
let repulsion = strength / (distance * distance);
repulsion = Math.min(repulsion, MAX_FORCE); // MAX_FORCE = 5.0
2.	距离计算要设最小值，防止除以零或极小数
// 两个节点位置差
let dx = nodeB.x - nodeA.x;
let dy = nodeB.y - nodeA.y;
let distance = Math.sqrt(dx * dx + dy * dy);

// 关键：设置最小距离，永远不让 distance 接近 0
distance = Math.max(distance, 30); // 最小30px
3.	添加速度死区（velocity dead zone），微小速度直接归零
// 每帧更新速度后：
if (Math.abs(node.vx) < 0.1) node.vx = 0;
if (Math.abs(node.vy) < 0.1) node.vy = 0;
4.	降低力的强度参数，当前值太大了，请按以下值调整：
	∙	repulsionStrength: 降低到 200-400（之前可能设了 500-1000）
	∙	springConstant: 降低到 0.02-0.04（之前可能设了 0.05-0.08）
	∙	dampingFactor: 提高到 0.8-0.85（之前可能设了 0.88-0.92，越低阻尼越大，减速越快）
	5.	如果仍然抖动，使用 Verlet 积分替代 Euler 积分
  // Euler（容易震荡）：
node.vx += ax;
node.x += node.vx;

// Verlet（更稳定）：
let newX = node.x + (node.x - node.prevX) * damping + ax;
node.prevX = node.x;
node.x = newX;

问题2：节点飞出屏幕导致卡顿闪退
原因：没有速度上限和位置边界，节点坐标变成极大数值后，Canvas/DOM 渲染崩溃。
修复方案：
	1.	硬性速度上限

  const MAX_SPEED = 6; // 每帧最大移动 6px
node.vx = Math.max(-MAX_SPEED, Math.min(MAX_SPEED, node.vx));
node.vy = Math.max(-MAX_SPEED, Math.min(MAX_SPEED, node.vy));

2.	硬性位置边界（基于画布逻辑尺寸，不是屏幕像素）
// 定义一个安全活动区域，比可视区域大一些但不能无限大
const BOUNDS = {
  minX: -2000,
  maxX: 2000,
  minY: -2000,
  maxY: 2000
};

// 每帧更新位置后强制钳制
node.x = Math.max(BOUNDS.minX, Math.min(BOUNDS.maxX, node.x));
node.y = Math.max(BOUNDS.minY, Math.min(BOUNDS.maxY, node.y));

// 如果撞到边界，速度反转并大幅衰减（模拟撞墙）
if (node.x <= BOUNDS.minX || node.x >= BOUNDS.maxX) {
  node.vx *= -0.3; // 反弹但损失70%能量
}
if (node.y <= BOUNDS.minY || node.y >= BOUNDS.maxY) {
  node.vy *= -0.3;
}

3.	甩出惯性要额外衰减
// 在 touchend / mouseup 时拿到释放速度
let releaseVx = node.vx;
let releaseVy = node.vy;

// 如果释放速度太大，直接砍掉
let releaseSpeed = Math.sqrt(releaseVx * releaseVx + releaseVy * releaseVy);
if (releaseSpeed > MAX_SPEED) {
  let scale = MAX_SPEED / releaseSpeed;
  node.vx *= scale;
  node.vy *= scale;
}

// 释放后的阻尼比平时更大，快速停下来
// 正常阻尼 0.85，释放后前 30 帧用 0.7
let postReleaseDamping = 0.7;
let postReleaseFrames = 30;

4.	防止 NaN / Infinity 污染整个物理系统
// 每帧开始时检查，一旦出现异常直接重置该节点
if (!isFinite(node.x) || !isFinite(node.y) || 
    !isFinite(node.vx) || !isFinite(node.vy)) {
  node.x = node.defaultX || 0;
  node.y = node.defaultY || 0;
  node.vx = 0;
  node.vy = 0;
}

5.	被牵引的同部门节点要额外限制
// 同部门节点跟随移动时，限制跟随速度不能超过主拖拽节点速度的 60%
let followerMaxSpeed = MAX_SPEED * 0.6;
followerNode.vx = Math.max(-followerMaxSpeed, Math.min(followerMaxSpeed, followerNode.vx));
followerNode.vy = Math.max(-followerMaxSpeed, Math.min(followerMaxSpeed, followerNode.vy));

完整的每帧更新顺序（确保按这个顺序执行）

function physicsTick() {
  for (each node) {
    // Step 1: NaN 检查
    sanitize(node);
    
    // Step 2: 计算所有力（排斥 + 吸引 + 漂浮）
    let fx = 0, fy = 0;
    fx += calcRepulsion(node);   // 排斥力
    fx += calcSpring(node);      // 弹簧吸引力
    fx += calcDrift(node);       // 空闲漂浮
    
    // Step 3: 力 → 加速度（力也要 clamp）
    fx = clamp(fx, -MAX_FORCE, MAX_FORCE);
    fy = clamp(fy, -MAX_FORCE, MAX_FORCE);
    
    // Step 4: 更新速度
    node.vx += fx;
    node.vy += fy;
    
    // Step 5: 速度阻尼
    node.vx *= damping;
    node.vy *= damping;
    
    // Step 6: 速度 clamp
    node.vx = clamp(node.vx, -MAX_SPEED, MAX_SPEED);
    node.vy = clamp(node.vy, -MAX_SPEED, MAX_SPEED);
    
    // Step 7: 速度死区
    if (Math.abs(node.vx) < 0.1) node.vx = 0;
    if (Math.abs(node.vy) < 0.1) node.vy = 0;
    
    // Step 8: 更新位置
    node.x += node.vx;
    node.y += node.vy;
    
    // Step 9: 位置 clamp + 边界反弹
    boundaryCheck(node);
  }
  render();
  requestAnimationFrame(physicsTick);
}

请严格按照以上方案修复，特别注意所有 clamp 和 sanitize 步骤不能省略，这些是防止崩溃的安全网。
---

简单来说两个根本原因：**抖动是因为力太大且没有上限**，节点每帧被弹出去又拉回来形成震荡；**闪退是因为没有速度和位置的硬边界**，节点坐标飙到几十万，渲染引擎扛不住就崩了。修复核心就是到处加 clamp — 力要 clamp、速度要 clamp、位置要 clamp、释放惯性要 clamp，宁可多限制也不能让任何数值失控。​​​​​​​​​​​​​​​​
