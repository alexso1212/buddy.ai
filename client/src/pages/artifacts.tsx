import { useState } from "react";
import { useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Search, FileText, BarChart3, ClipboardList, Users } from "lucide-react";

interface ArtifactTool {
  icon: typeof Search;
  title: string;
  description: string;
  systemPrompt?: string;
  comingSoon: boolean;
}

const artifactTools: ArtifactTool[] = [
  {
    icon: Search,
    title: '企业诊断',
    description: 'AI 读取企业资料，生成诊断报告',
    systemPrompt: '你是 Buddy 企业诊断助手。用户会提供企业资料，请全面分析并生成诊断报告，涵盖组织架构、业务流程、风险点和改进建议。',
    comingSoon: false,
  },
  {
    icon: BarChart3,
    title: '项目总结',
    description: '抓取项目和任务数据，AI 总结分析',
    systemPrompt: '你是 Buddy 项目分析助手。基于用户提供的项目和任务数据，生成项目进度总结、风险预警和下一步建议。',
    comingSoon: false,
  },
  {
    icon: ClipboardList,
    title: '任务洞察',
    description: '分析任务分布、瓶颈和建议',
    systemPrompt: '你是 Buddy 任务分析助手。分析团队的任务数据，识别瓶颈、负载不均、逾期风险，并给出优化建议。',
    comingSoon: false,
  },
  {
    icon: Users,
    title: '团队分析',
    description: '分析团队负载和协作效率',
    comingSoon: true,
  },
];

export default function Artifacts() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [creatingTool, setCreatingTool] = useState<string | null>(null);

  const handleToolClick = async (tool: ArtifactTool) => {
    if (tool.comingSoon) {
      toast({ title: '即将推出' });
      return;
    }

    setCreatingTool(tool.title);
    try {
      const res = await apiRequest("POST", "/api/conversations", {
        title: tool.title,
        systemPrompt: tool.systemPrompt,
      });
      const json = await res.json();
      const convId = json.data.id;
      queryClient.invalidateQueries({ queryKey: ['/api/conversations'] });
      navigate(`/agent?conv=${convId}`);
    } catch (err) {
      toast({ title: '创建失败，请重试', variant: 'destructive' });
    } finally {
      setCreatingTool(null);
    }
  };

  return (
    <div className="flex flex-col h-full" data-testid="artifacts-page">
      <div style={{
        height: 54,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '0 16px',
        flexShrink: 0,
        borderBottom: '1px solid var(--border-subtle)',
      }}>
        <button
          onClick={() => navigate('/agent')}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-primary)', display: 'flex', alignItems: 'center',
            padding: 4,
          }}
          data-testid="button-back"
        >
          <ArrowLeft size={20} />
        </button>
        <span style={{
          fontSize: 17, fontWeight: 600,
          color: 'var(--text-primary)',
        }}>AI 工具集</span>
      </div>

      <div style={{
        flex: 1, overflowY: 'auto',
        padding: '20px 16px',
      }}>
        <div style={{ maxWidth: 600, margin: '0 auto' }}>
          {artifactTools.map(tool => {
            const ToolIcon = tool.icon;
            const isCreating = creatingTool === tool.title;
            return (
              <button
                key={tool.title}
                onClick={() => handleToolClick(tool)}
                disabled={isCreating}
                style={{
                  width: '100%',
                  padding: '16px 18px',
                  background: 'var(--bg-composer, #3C3B37)',
                  borderRadius: 14,
                  border: '1px solid var(--border-subtle)',
                  marginBottom: 10,
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 14,
                  cursor: tool.comingSoon ? 'default' : 'pointer',
                  textAlign: 'left' as const,
                  opacity: tool.comingSoon ? 0.5 : isCreating ? 0.7 : 1,
                  transition: 'background 150ms, opacity 150ms',
                }}
                onMouseEnter={e => { if (!tool.comingSoon) e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = ''; }}
                data-testid={`tool-${tool.title}`}
              >
                <div style={{
                  width: 40, height: 40, borderRadius: 10,
                  background: 'rgba(174, 86, 48, 0.12)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <ToolIcon size={20} color="#AE5630" />
                </div>
                <div>
                  <div style={{
                    fontSize: 15.5, fontWeight: 500,
                    color: 'var(--text-primary)',
                    marginBottom: 4,
                  }}>
                    {tool.title}
                    {tool.comingSoon && (
                      <span style={{
                        fontSize: 11, color: 'var(--text-secondary)',
                        marginLeft: 8, fontWeight: 400,
                      }}>即将推出</span>
                    )}
                  </div>
                  <div style={{
                    fontSize: 13.5, color: 'var(--text-secondary)',
                    lineHeight: 1.4,
                  }}>{tool.description}</div>
                </div>
              </button>
            );
          })}

          <div style={{
            textAlign: 'center',
            padding: '20px 0',
            color: 'var(--text-placeholder, #7A7874)',
            fontSize: 13,
          }}>
            更多工具即将推出...
          </div>
        </div>
      </div>
    </div>
  );
}
