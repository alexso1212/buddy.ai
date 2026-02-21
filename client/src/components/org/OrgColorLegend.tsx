import { Lock } from "lucide-react";

export function OrgColorLegend() {
  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-40 border-t bg-background/95 backdrop-blur-sm px-4 py-2"
      data-testid="org-color-legend"
    >
      <div className="max-w-5xl mx-auto flex flex-wrap items-center gap-x-5 gap-y-1 text-[11px] text-muted-foreground">
        <div className="flex items-center gap-3">
          <span className="font-medium text-foreground">边框:</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-[#10B981]" />≥80%</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-[#3B82F6]" />60-79%</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-[#F59E0B]" />40-59%</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-[#EF4444]" />&lt;40%</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-[#9CA3AF]" />无任务</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-medium text-foreground">标记:</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#EF4444]" />逾期</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#F59E0B]" />即将到期</span>
          <span className="flex items-center gap-1"><Lock className="w-2.5 h-2.5" />被阻塞</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-medium text-foreground">连线:</span>
          <span className="flex items-center gap-1"><span className="w-4 h-0.5 bg-[#D1D5DB]" />正常</span>
          <span className="flex items-center gap-1"><span className="w-4 h-0.5 bg-[#F59E0B]" />临期</span>
          <span className="flex items-center gap-1"><span className="w-4 h-0.5 bg-[#EF4444]" />逾期</span>
          <span className="flex items-center gap-1"><span className="w-4 h-0 border-t border-dashed border-[#D1D5DB]" style={{ width: 16 }} />待招</span>
        </div>
      </div>
    </div>
  );
}
