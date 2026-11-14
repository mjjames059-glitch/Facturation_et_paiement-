export const themePreferences = ["facturo", "light", "dark", "green", "violet"] as const;

export type ThemePreference = (typeof themePreferences)[number];

export function isThemePreference(value: string): value is ThemePreference {
  return themePreferences.some((theme) => theme === value);
}

export function normalizeThemePreference(value: unknown): ThemePreference {
  if (value === "system") return "facturo";
  return themePreferences.find((theme) => theme === value) ?? "facturo";
}
