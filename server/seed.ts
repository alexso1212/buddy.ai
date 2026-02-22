import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "../shared/schema";
import { organizations, departments, users, activityLogs, taskComments, taskDependencies, tasks, projects } from "../shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required");
}

const client = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(client, { schema });

async function seed() {
  console.log("Seeding database...");

  console.log("Clearing existing data...");
  await db.delete(activityLogs);
  await db.delete(taskComments);
  await db.delete(taskDependencies);
  await db.delete(tasks);
  await db.delete(projects);
  await db.delete(users);
  await db.delete(departments);
  await db.delete(organizations);

  await client.query("ALTER SEQUENCE organizations_id_seq RESTART WITH 1");
  await client.query("ALTER SEQUENCE departments_id_seq RESTART WITH 1");
  await client.query("ALTER SEQUENCE users_id_seq RESTART WITH 1");
  await client.query("ALTER SEQUENCE projects_id_seq RESTART WITH 1");
  await client.query("ALTER SEQUENCE tasks_id_seq RESTART WITH 1");
  await client.query("ALTER SEQUENCE task_dependencies_id_seq RESTART WITH 1");
  await client.query("ALTER SEQUENCE activity_logs_id_seq RESTART WITH 1");
  await client.query("ALTER SEQUENCE task_comments_id_seq RESTART WITH 1");

  const [org] = await db
    .insert(organizations)
    .values({
      name: "Deltapex Education",
      description: "金融教育公司",
    })
    .returning();
  console.log(`Created organization: ${org.name} (id: ${org.id})`);

  const deptData = [
    { name: "管理层", orgId: org.id },
    { name: "课程研发", orgId: org.id },
    { name: "市场运营", orgId: org.id },
    { name: "技术开发", orgId: org.id },
    { name: "交易策略", orgId: org.id },
  ];

  const createdDepts = await db
    .insert(departments)
    .values(deptData)
    .returning();
  console.log(`Created ${createdDepts.length} departments:`);
  for (const d of createdDepts) {
    console.log(`  - ${d.name} (id: ${d.id})`);
  }

  const mgmtDept = createdDepts.find((d) => d.name === "管理层")!;

  const [ceo] = await db
    .insert(users)
    .values({
      orgId: org.id,
      deptId: mgmtDept.id,
      email: "alex@deltapex.com",
      displayName: "Alexso",
      role: "owner",
    })
    .returning();
  console.log(`Created CEO user: ${ceo.displayName} (id: ${ceo.id})`);

  console.log("\nSeed completed successfully!");
  await client.end();
  process.exit(0);
}

seed().catch(async (err) => {
  console.error("Seed failed:", err);
  await client.end();
  process.exit(1);
});
