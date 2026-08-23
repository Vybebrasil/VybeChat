import { Bell, BellOff, VolumeX } from "lucide-react";
import type { NotificationPreferences } from "@/lib/use-vybe-notifications";

type Props = {
  preferences: NotificationPreferences;
  onRequestPermission: () => void;
  onToggleQuiet: () => void;
};

export function NotificationControl({
  preferences,
  onRequestPermission,
  onToggleQuiet,
}: Props) {
  return (
    <div className="flex items-center gap-0.5">
      <button
        onClick={onRequestPermission}
        className={`grid size-8 place-items-center rounded-lg ${preferences.enabled ? "bg-orange-400/15 text-orange-200" : "text-stone-500 hover:bg-white/5 hover:text-white"}`}
        aria-label="Ativar notificações"
      >
        {preferences.enabled ? (
          <Bell className="size-3.5" />
        ) : (
          <BellOff className="size-3.5" />
        )}
      </button>
      <button
        onClick={onToggleQuiet}
        className={`grid size-8 place-items-center rounded-lg ${preferences.quiet ? "bg-orange-400 text-black" : "text-stone-500 hover:bg-white/5 hover:text-white"}`}
        aria-label="Alternar modo silencioso"
      >
        <VolumeX className="size-3.5" />
      </button>
    </div>
  );
}
