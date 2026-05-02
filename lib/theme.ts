export const STORAGE_KEY = "zhibo:state:v1";

export type ThemePref = "system" | "light" | "dark";

export const THEME_VALUES: ThemePref[] = ["system", "light", "dark"];

export function resolveSystem(): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export function applyTheme(theme: ThemePref): void {
  if (typeof document === "undefined") return;
  const isDark = theme === "dark" || (theme === "system" && resolveSystem() === "dark");
  document.documentElement.classList.toggle("dark", isDark);
}

export function subscribeSystem(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

export const INLINE_BOOT_SCRIPT = `(() => {
  try {
    var raw = localStorage.getItem(${JSON.stringify(STORAGE_KEY)});
    var theme = "system";
    if (raw) {
      var env = JSON.parse(raw);
      if (env && env.state && (env.state.theme === "light" || env.state.theme === "dark" || env.state.theme === "system")) {
        theme = env.state.theme;
      }
    }
    var isDark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.classList.toggle("dark", isDark);
  } catch (e) {}
})();`;
