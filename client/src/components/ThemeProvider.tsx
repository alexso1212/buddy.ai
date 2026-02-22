import { useEffect, type ReactNode } from "react";

export function ThemeProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    const applyTheme = (e: MediaQueryList | MediaQueryListEvent) => {
      if (e.matches) {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    };

    applyTheme(mediaQuery);

    const handler = (e: MediaQueryListEvent) => applyTheme(e);
    mediaQuery.addEventListener("change", handler);

    return () => {
      mediaQuery.removeEventListener("change", handler);
    };
  }, []);

  return <>{children}</>;
}
