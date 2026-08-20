import { useCallback, useEffect, useState } from "react";

const KEY = "vybechat:notification-preferences";

export type NotificationPreferences = { enabled: boolean; quiet: boolean };

function readPreferences(): NotificationPreferences {
  try {
    const stored = localStorage.getItem(KEY);
    if (!stored) return { enabled: false, quiet: false };
    const parsed = JSON.parse(stored) as Partial<NotificationPreferences>;
    return { enabled: Boolean(parsed.enabled), quiet: Boolean(parsed.quiet) };
  } catch { return { enabled: false, quiet: false }; }
}

export function useVybeNotifications() {
  const [preferences, setPreferences] = useState<NotificationPreferences>(() => typeof window === "undefined" ? { enabled: false, quiet: false } : readPreferences());
  useEffect(() => { localStorage.setItem(KEY, JSON.stringify(preferences)); }, [preferences]);
  const requestPermission = useCallback(async () => {
    if (!("Notification" in window)) return false;
    const permission = Notification.permission === "default" ? await Notification.requestPermission() : Notification.permission;
    const enabled = permission === "granted";
    setPreferences(current => ({ ...current, enabled }));
    return enabled;
  }, []);
  const toggleQuiet = useCallback(() => setPreferences(current => ({ ...current, quiet: !current.quiet })), []);
  const notify = useCallback((title: string, body: string) => {
    if (!preferences.enabled || preferences.quiet || document.visibilityState === "visible" || !("Notification" in window) || Notification.permission !== "granted") return;
    new Notification(title, { body, tag: `vybechat:${title}` });
  }, [preferences]);
  return { preferences, requestPermission, toggleQuiet, notify };
}
