import fs from 'fs';
import crypto from 'crypto';
import path from 'path';
import { storage } from '../../storage';
import { processZipFile, processMultipleFiles, cleanupTempFiles, ExtractedFile } from './zipProcessor';
import { extractEnterpriseProfile, EnterpriseProfile, ExtractionResult } from './aiExtractor';
import { processDocument } from '../kb/processDocument';

export type { EnterpriseProfile, ExtractionResult } from './aiExtractor';
export type { ExtractedFile } from './zipProcessor';

export async function analyzeUpload(params: {
  zipPath?: string;
  files?: { originalName: string; tempPath: string }[];
}): Promise<{
  profile: ExtractionResult;
  extractedFiles: ExtractedFile[];
}> {
  let extractedFiles: ExtractedFile[];

  if (params.zipPath) {
    extractedFiles = await processZipFile(params.zipPath);
  } else if (params.files) {
    extractedFiles = await processMultipleFiles(params.files);
  } else {
    throw new Error('请上传ZIP文件或多个文件');
  }

  if (extractedFiles.length === 0) {
    throw new Error('没有从上传的文件中提取到有效内容。请确保文件格式为 PDF/DOCX/TXT/MD。');
  }

  const profile = await extractEnterpriseProfile(
    extractedFiles.map(f => ({ fileName: f.fileName, content: f.fullContent, skipped: f.skipped }))
  );

  return { profile, extractedFiles };
}

export async function analyzeKbDocuments(params: {
  orgId: number;
  documentIds: number[];
}): Promise<{
  profile: ExtractionResult;
  extractedFiles: ExtractedFile[];
}> {
  const { orgId, documentIds } = params;
  const extractedFiles: ExtractedFile[] = [];

  for (const docId of documentIds) {
    const doc = await storage.getKbDocumentById(docId);
    if (!doc || doc.orgId !== orgId) continue;
    if (doc.status !== 'ready' && doc.status !== 'completed') continue;

    const chunks = await storage.getKbChunksByDocument(docId);
    if (chunks.length === 0) continue;

    const content = chunks
      .sort((a, b) => a.chunkIndex - b.chunkIndex)
      .map(c => c.content)
      .join('\n\n');

    extractedFiles.push({
      fileName: doc.fileName,
      filePath: doc.fileUrl,
      fileType: doc.fileType,
      fileSize: doc.fileSize,
      content: content.slice(0, 10000),
      fullContent: content,
    });
  }

  if (extractedFiles.length === 0) {
    throw new Error('所选文档没有可用的文本内容。请确保文档已完成处理。');
  }

  const profile = await extractEnterpriseProfile(
    extractedFiles.map(f => ({ fileName: f.fileName, content: f.fullContent }))
  );

  return { profile, extractedFiles };
}

export async function confirmAndSetup(params: {
  orgId: number;
  userId: number;
  profile: EnterpriseProfile;
  extractedFiles: ExtractedFile[];
}): Promise<{
  updatedOrg: boolean;
  departmentsCreated: number;
  jobRolesCreated: number;
  membersCreated: number;
  documentsCreated: number;
}> {
  const { orgId, userId, profile, extractedFiles } = params;
  let departmentsCreated = 0;
  let jobRolesCreated = 0;
  let membersCreated = 0;
  let documentsCreated = 0;
  let updatedOrg = false;

  if (profile.companyName) {
    try {
      await storage.updateOrganization(orgId, {
        name: profile.companyName,
        description: profile.companyDescription || undefined,
      });
      updatedOrg = true;
      console.log(`[Setup] Updated org name: ${profile.companyName}`);
    } catch (err: any) {
      console.warn(`[Setup] Failed to update org:`, err.message);
    }
  }

  const deptNameToId: Record<string, number> = {};

  for (const dept of profile.departments) {
    try {
      const created = await storage.createDepartment({
        orgId,
        name: dept.name,
        description: dept.description || null,
      });
      deptNameToId[dept.name] = created.id;
      departmentsCreated++;

      if (dept.children && dept.children.length > 0) {
        for (const child of dept.children) {
          try {
            const childCreated = await storage.createDepartment({
              orgId,
              name: child.name,
              description: child.description || null,
              parentDeptId: created.id,
            });
            deptNameToId[child.name] = childCreated.id;
            departmentsCreated++;
          } catch (err: any) {
            console.warn(`[Setup] Failed to create child dept ${child.name}:`, err.message);
          }
        }
      }
    } catch (err: any) {
      console.warn(`[Setup] Failed to create dept ${dept.name}:`, err.message);
    }
  }

  console.log(`[Setup] Created ${departmentsCreated} departments`);

  for (const role of profile.jobRoles) {
    try {
      const deptId = deptNameToId[role.departmentName] || null;
      await storage.createJobRole({
        orgId,
        deptId,
        title: role.title,
        responsibilities: role.responsibilities || '',
        boundaries: role.boundaries || null,
        requiredSkills: role.requiredSkills || null,
        description: null,
      });
      jobRolesCreated++;
    } catch (err: any) {
      console.warn(`[Setup] Failed to create role ${role.title}:`, err.message);
    }
  }

  console.log(`[Setup] Created ${jobRolesCreated} job roles`);

  const roleNameToId: Record<string, number> = {};
  const allJobRoles = await storage.getJobRolesByOrg(orgId);
  for (const jr of allJobRoles) {
    roleNameToId[jr.title] = jr.id;
  }

  if (profile.members && profile.members.length > 0) {
    for (const member of profile.members) {
      if (!member.fullName) continue;
      try {
        const deptId = deptNameToId[member.departmentName] || null;
        const jobRoleId = roleNameToId[member.jobRoleTitle] || null;
        await storage.createMemberProfile({
          orgId,
          fullName: member.fullName,
          aliases: member.aliases && member.aliases.length > 0 ? JSON.stringify(member.aliases) : null,
          deptId,
          jobRoleId,
          employeeId: member.employeeId || null,
          phone: member.phone || null,
          email: member.email || null,
          title: member.title || null,
          hireDate: member.hireDate || null,
          contractInfo: member.contractHighlights || null,
          status: 'pending',
          sourceDocument: null,
        });
        membersCreated++;
      } catch (err: any) {
        console.warn(`[Setup] Failed to create member profile ${member.fullName}:`, err.message);
      }
    }
    console.log(`[Setup] Created ${membersCreated} member profiles`);
  }

  let duplicatesSkipped = 0;
  for (const file of extractedFiles) {
    try {
      const fileBuffer = fs.readFileSync(file.filePath);
      const contentHash = crypto.createHash('md5').update(fileBuffer).digest('hex');

      const existingByHash = await storage.findKbDocByHash(orgId, contentHash);
      if (existingByHash) {
        console.log(`[Setup] Skipping duplicate file ${file.fileName} (hash matches ${existingByHash.fileName})`);
        duplicatesSkipped++;
        continue;
      }

      const classification = profile.fileClassifications.find(
        fc => fc.fileName === file.fileName
      );

      const kbDir = 'uploads/kb/';
      if (!fs.existsSync(kbDir)) fs.mkdirSync(kbDir, { recursive: true });

      const newFileName = `${Date.now()}_${Math.round(Math.random() * 1e9)}_${file.fileName}`;
      const kbPath = path.join(kbDir, newFileName);

      fs.copyFileSync(file.filePath, kbPath);

      let visibleDeptIds: string | null = null;
      if (classification?.suggestedVisibility === 'department' && classification?.suggestedDepartment) {
        const deptId = deptNameToId[classification.suggestedDepartment];
        if (deptId) {
          visibleDeptIds = JSON.stringify([deptId]);
        }
      }

      const visibility = classification?.sensitivity === 'high' ? 'admin'
        : classification?.suggestedVisibility || 'org';

      const doc = await storage.createKbDocument({
        orgId,
        uploadedBy: userId,
        title: file.fileName.replace(/\.[^/.]+$/, ''),
        fileName: file.fileName,
        fileType: file.fileType,
        fileSize: file.fileSize,
        fileUrl: `/uploads/kb/${newFileName}`,
        category: classification?.category || 'general',
        visibility,
        visibleDeptIds,
        status: 'pending',
        chunkCount: 0,
        contentHash,
      });

      documentsCreated++;

      setImmediate(() => {
        processDocument(doc.id).catch(err => {
          console.error(`[Setup] KB processing failed for ${file.fileName}:`, err);
        });
      });

    } catch (err: any) {
      console.warn(`[Setup] Failed to create KB doc ${file.fileName}:`, err.message);
    }
  }

  console.log(`[Setup] Created ${documentsCreated} KB documents, skipped ${duplicatesSkipped} duplicates`);

  cleanupTempFiles(extractedFiles);

  await storage.createActivityLog({
    orgId,
    userId,
    entityType: 'organization',
    entityId: orgId,
    action: 'smart_setup',
    changes: JSON.stringify({
      departmentsCreated,
      jobRolesCreated,
      membersCreated,
      documentsCreated,
      companyName: profile.companyName,
    }),
    source: 'ai',
  });

  return { updatedOrg, departmentsCreated, jobRolesCreated, membersCreated, documentsCreated };
}
