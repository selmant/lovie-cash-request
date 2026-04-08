export function getTheme(): "dark" | "light" {
  const stored = localStorage.getItem("theme");
  if (stored === "light" || stored === "dark") return stored;
  return "light";
}

export function setTheme(theme: "dark" | "light") {
  localStorage.setItem("theme", theme);
  document.documentElement.classList.toggle("dark", theme === "dark");
}

export function initTheme() {
  setTheme(getTheme());
}
