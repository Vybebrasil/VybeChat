import { Bell, BellOff, VolumeX } from "lucide-react";
import type { NotificationPreferences } from "@/lib/use-vybe-notifications";

type Props = { preferences: NotificationPreferences; onRequestPermission: () => void; onToggleQuiet: () => void; };

export function NotificationControl({ preferences, onRequestPermission, onToggleQuiet }: Props) {
  return <div className="fixed bottom-4 left-[292px] z-20 hidden items-center gap-1 rounded-xl border border-orange-300/20 bg-[#111217]/95 p-1.5 shadow-xl backdrop-blur md:flex"><button onClick={onRequestPermission} className={`grid size-9 place-items-center rounded-lg ${preferences.enabled ? "bg-orange-400/14 text-orange-200" : "text-stone-400 hover:bg-white/5"}`} aria-label="Ativar notificações">{preferences.enabled ? <Bell className="size-4" /> : <BellOff className="size-4" />}</button><button onClick={onToggleQuiet} className={`grid size-9 place-items-center rounded-lg ${preferences.quiet ? "bg-orange-400 text-black" : "text-stone-400 hover:bg-white/5"}`} aria-label="Alternar modo silencioso"><VolumeX className="size-4" /></button></div>;
}
