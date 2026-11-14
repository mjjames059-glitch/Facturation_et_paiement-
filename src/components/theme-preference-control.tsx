"use client";

import { useActionState, useEffect, useState } from "react";
import { updateThemePreferenceAction, type SettingsActionState } from "@/app/actions/settings";
import type { ThemePreference } from "@/lib/theme";

const initialState: SettingsActionState = {};

const themeLabels: Record<ThemePreference, string> = {
  system: "Selon mon appareil",
  light: "Clair",
  dark: "Sombre",
};

export function ThemeInitializer({ themePreference }: { themePreference: ThemePreference }) {
  useEffect(() => {
    document.documentElement.dataset.theme = themePreference;
  }, [themePreference]);
  return null;
}

export default function ThemePreferenceControl({ themePreference }: { themePreference: ThemePreference }) {
  const [state, formAction, pending] = useActionState(updateThemePreferenceAction, initialState);
  const [selectedTheme, setSelectedTheme] = useState(themePreference);

  useEffect(() => {
    document.documentElement.dataset.theme = selectedTheme;
  }, [selectedTheme]);

  return (
    <form action={formAction} className="theme-preference-form">
      <label htmlFor="theme-preference">Thème de l’application</label>
      <div className="personal-email-row">
        <select id="theme-preference" name="theme_preference" value={selectedTheme} onChange={(event) => {
          const value = event.target.value;
          if (value === "system" || value === "light" || value === "dark") setSelectedTheme(value);
        }}>
          {(Object.keys(themeLabels) as ThemePreference[]).map((theme) => <option key={theme} value={theme}>{themeLabels[theme]}</option>)}
        </select>
        <button className="button" disabled={pending || selectedTheme === themePreference}>{pending ? "Enregistrement…" : "Enregistrer le thème"}</button>
      </div>
      {state.error && <p className="auth-error" role="alert">{state.error}</p>}
      {state.success && <p className="message" role="status">{state.success}</p>}
    </form>
  );
}
