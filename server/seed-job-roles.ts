import { db } from './storage';
import { jobRoles, users } from '@shared/schema';
import { eq } from 'drizzle-orm';

const jobRolesData = [
  {
    orgId: 1,
    deptId: 1,
    title: 'CEO / 总经理',
    description: '公司最高管理者，负责战略决策和全局管理',
    responsibilities: JSON.stringify([
      '制定公司战略方向和年度目标',
      '审批重大财务支出和人事决策',
      '管理核心团队和组织架构',
      '对外商务合作和关系维护',
      'IP内容方向把控和课程质量审核',
    ]),
    boundaries: JSON.stringify([
      '不负责日常行政事务执行',
      '不负责具体技术开发实现',
      '不负责日常客服和售后',
    ]),
    requiredSkills: JSON.stringify([
      '战略规划', '团队管理', '金融知识', '商务谈判',
    ]),
  },
  {
    orgId: 1,
    deptId: 1,
    title: 'HR/行政主管',
    description: '负责人力资源和行政管理',
    responsibilities: JSON.stringify([
      '员工合同和协议管理',
      'KPI绩效考核制度制定和执行',
      '员工手册和制度文件编写',
      '薪酬核算和社保管理',
      '办公行政事务管理',
    ]),
    boundaries: JSON.stringify([
      '不负责业务拓展和销售',
      '不负责课程内容创作',
      '不负责技术开发',
    ]),
    requiredSkills: JSON.stringify([
      '人力资源管理', '劳动法', '行政管理', '文书写作',
    ]),
  },
  {
    orgId: 1,
    deptId: 1,
    title: 'VP/运营总监',
    description: '负责业务运营和团队管理',
    responsibilities: JSON.stringify([
      '销售团队管理和KPI制定',
      '业务拓展和渠道开发',
      '客户转化流程优化',
      '销售数据分析和复盘',
      '商务合作谈判和执行',
    ]),
    boundaries: JSON.stringify([
      '不负责IP内容创作和课程开发',
      '不负责技术系统开发',
      '不负责财务审批（需CEO审批）',
    ]),
    requiredSkills: JSON.stringify([
      '销售管理', '数据分析', '团队管理', '商务谈判',
    ]),
  },
  {
    orgId: 1,
    deptId: 4,
    title: '技术开发工程师',
    description: '负责公司技术产品和系统开发',
    responsibilities: JSON.stringify([
      '负责AI知识库技术开发和维护',
      '系统架构设计和技术方案评审',
      'API开发和第三方服务集成',
      '系统运维和bug修复',
      '技术文档编写和维护',
    ]),
    boundaries: JSON.stringify([
      '不负责内容创作和课程设计',
      '不负责客户销售和商务谈判',
      '不负责视觉设计和UI美化',
      '不负责市场推广和运营活动',
    ]),
    requiredSkills: JSON.stringify([
      'TypeScript', 'Python', 'AI/ML', 'API开发', '数据库',
    ]),
  },
  {
    orgId: 1,
    deptId: 3,
    title: '市场运营专员',
    description: '负责市场推广、直播运营和内容分发',
    responsibilities: JSON.stringify([
      '直播活动策划和执行',
      '短视频内容策划和拍摄协调',
      '社交媒体账号矩阵运营',
      '用户增长和流量获取',
      '数据分析和运营复盘',
      '活动物料设计协调',
    ]),
    boundaries: JSON.stringify([
      '不负责核心课程内容创作',
      '不负责技术系统开发',
      '不负责财务和人事管理',
    ]),
    requiredSkills: JSON.stringify([
      '新媒体运营', '直播运营', '数据分析', '活动策划', '基础设计',
    ]),
  },
  {
    orgId: 1,
    deptId: 5,
    title: '交易策略分析师',
    description: '负责交易策略研究和课程内容支撑',
    responsibilities: JSON.stringify([
      '订单流交易策略研究和开发',
      '交易数据分析和回测',
      '课程技术内容审核和校对',
      '学员交易问题解答和指导',
      '市场分析报告撰写',
    ]),
    boundaries: JSON.stringify([
      '不负责技术系统开发',
      '不负责市场推广和运营',
      '不负责行政和人事管理',
    ]),
    requiredSkills: JSON.stringify([
      '订单流分析', '期货交易', '数据分析', '金融市场', '技术分析',
    ]),
  },
];

const userRoleMap: Record<string, string> = {
  'Alexso': 'CEO / 总经理',
  'Tina': 'HR/行政主管',
  '安洲': 'VP/运营总监',
  'Michael': '技术开发工程师',
  'Apple': '市场运营专员',
  '刘建烨': '交易策略分析师',
  '唐张世涵': '市场运营专员',
};

async function seedJobRoles() {
  console.log('Seeding job roles...');
  
  const existing = await db.select().from(jobRoles);
  if (existing.length > 0) {
    console.log(`Found ${existing.length} existing job roles, skipping insert.`);
  } else {
    for (const roleData of jobRolesData) {
      const [role] = await db.insert(jobRoles).values(roleData).returning();
      console.log(`Created job role: ${role.title} (id: ${role.id})`);
    }
  }
  
  const allRoles = await db.select().from(jobRoles);
  const roleByTitle = new Map(allRoles.map(r => [r.title, r.id]));
  
  const allUsers = await db.select().from(users);
  for (const user of allUsers) {
    const roleTitle = userRoleMap[user.displayName];
    if (roleTitle) {
      const roleId = roleByTitle.get(roleTitle);
      if (roleId) {
        await db.update(users).set({ jobRoleId: roleId }).where(eq(users.id, user.id));
        console.log(`Assigned ${user.displayName} -> ${roleTitle} (roleId: ${roleId})`);
      } else {
        console.log(`WARNING: Role "${roleTitle}" not found for user ${user.displayName}`);
      }
    }
  }
  
  console.log('Job roles seeding complete!');
  process.exit(0);
}

seedJobRoles().catch(e => {
  console.error('Seed error:', e);
  process.exit(1);
});
