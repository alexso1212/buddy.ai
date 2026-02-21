import { useMemo, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Department, OrgChange } from "@shared/schema";
import type { DeptTreeNode, SafeUser, DeptStatsMap, UserStatsMap } from "./types";

export function useOrgData() {
  const { data: departments, isLoading: deptsLoading } = useQuery<Department[]>({ queryKey: ["/api/departments"] });
  const { data: usersData } = useQuery<SafeUser[]>({ queryKey: ["/api/users"] });
  const { data: orgChanges, isLoading: changesLoading } = useQuery<OrgChange[]>({ queryKey: ["/api/org-changes"] });
  const { data: deptStats } = useQuery<DeptStatsMap>({ queryKey: ["/api/departments/stats"] });
  const { data: userStats } = useQuery<UserStatsMap>({ queryKey: ["/api/users/stats"] });

  const allUsers = usersData || [];
  const allDepts = departments || [];
  const allChanges = orgChanges || [];

  const deptTree = useMemo(() => {
    const nodes: DeptTreeNode[] = allDepts.map((d) => ({
      dept: d,
      members: allUsers.filter((u) => u.dept_id === d.id),
      children: [],
    }));
    const rootNodes: DeptTreeNode[] = [];
    for (const node of nodes) {
      if (node.dept.parent_id) {
        const parent = nodes.find((n) => n.dept.id === node.dept.parent_id);
        if (parent) { parent.children.push(node); continue; }
      }
      rootNodes.push(node);
    }
    const ceoNode = rootNodes.find((n) => n.dept.id === "ceo_office");
    if (ceoNode) {
      const otherRoots = rootNodes.filter((n) => n.dept.id !== "ceo_office");
      ceoNode.children = [...otherRoots, ...ceoNode.children];
      return [ceoNode];
    }
    return rootNodes;
  }, [allDepts, allUsers]);

  const pendingChanges = useMemo(() => allChanges.filter((c) => c.status === "pending"), [allChanges]);

  return {
    deptTree,
    allUsers,
    allDepts,
    allChanges,
    pendingChanges,
    deptStats: deptStats || {},
    userStats: userStats || {},
    deptsLoading,
    changesLoading,
  };
}

export function useIsMobile() {
  const [isMobile, setIsMobile] = useState(typeof window !== "undefined" ? window.innerWidth < 768 : false);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);
  return isMobile;
}
