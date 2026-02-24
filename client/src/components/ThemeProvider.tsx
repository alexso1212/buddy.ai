import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";

type Theme = "light" | "dark" | "system";

interface ThemeContextValue {
  theme: Theme;
  resolvedTheme: "light" | "dark";
  setTheme: (theme: Theme) => void;
  orgType: string;
  setOrgType: (type: string) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "dark",
  resolvedTheme: "dark",
  setTheme: () => {},
  orgType: "project",
  setOrgType: () => {},
});

export function useTheme() {
  return useContext(ThemeContext);
}

function getSystemTheme(): "light" | "dark" {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    const saved = localStorage.getItem("theme");
    return (saved as Theme) || "dark";
  });

  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">(() => {
    const saved = localStorage.getItem("theme") as Theme | null;
    if (saved && saved !== "system") return saved;
    if (!saved) return "dark";
    return getSystemTheme();
  });

  const [orgType, setOrgTypeState] = useState<string>(() => {
    return localStorage.getItem("buddy_org_type") || "project";
  });

  const applyTheme = useCallback((resolved: "light" | "dark") => {
    setResolvedTheme(resolved);
    const root = document.documentElement;
    if (resolved === "dark") {
      root.classList.add("dark");
      root.classList.remove("light");
    } else {
      root.classList.add("light");
      root.classList.remove("dark");
    }
  }, []);

  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme);
    localStorage.setItem("theme", newTheme);
    if (newTheme === "system") {
      applyTheme(getSystemTheme());
    } else {
      applyTheme(newTheme);
    }
  }, [applyTheme]);

  const setOrgType = useCallback((type: string) => {
    setOrgTypeState(type);
    localStorage.setItem("buddy_org_type", type);
    const root = document.documentElement;
    if (type === 'enterprise') {
      root.classList.add('theme-enterprise');
    } else {
      root.classList.remove('theme-enterprise');
    }
  }, []);

  useEffect(() => {
    if (theme === "system") {
      applyTheme(getSystemTheme());
    } else {
      applyTheme(theme);
    }
  }, [theme, applyTheme]);

  useEffect(() => {
    if (theme !== "system") return;
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => applyTheme(e.matches ? "dark" : "light");
    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, [theme, applyTheme]);

  useEffect(() => {
    const root = document.documentElement;
    if (orgType === 'enterprise') {
      root.classList.add('theme-enterprise');
    } else {
      root.classList.remove('theme-enterprise');
    }
  }, [orgType]);

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme, orgType, setOrgType }}>
      {children}
    </ThemeContext.Provider>
  );
}
