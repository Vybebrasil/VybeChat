import {
  ClipboardCheck,
  MessageCircleMore,
  PanelRightOpen,
  Search,
} from "lucide-react";

type WorkspaceUtilitiesProps = {
  unreadDirectCount: number;
  openDecisionCount: number;
  onOpenCommands: () => void;
  onOpenDirects: () => void;
  onOpenDecisions: () => void;
  onOpenDetails: () => void;
};

function CountBadge({ value }: { value: number }) {
  if (value <= 0) return null;
  return (
    <strong className="ml-auto grid min-w-4 place-items-center rounded-full bg-orange-400 px-1 py-0.5 text-[9px] text-black">
      {value > 99 ? "99+" : value}
    </strong>
  );
}

export function WorkspaceUtilities({
  unreadDirectCount,
  openDecisionCount,
  onOpenCommands,
  onOpenDirects,
  onOpenDecisions,
  onOpenDetails,
}: WorkspaceUtilitiesProps) {
  return (
    <nav className="vybe-utility-nav" aria-label="Ferramentas da equipe">
      <button
        onClick={onOpenCommands}
        aria-label="Buscar canais, pessoas e ações"
      >
        <Search />
        <span>Buscar</span>
        <kbd className="ml-auto text-[9px] text-stone-600">⌘K</kbd>
      </button>
      <button onClick={onOpenDirects}>
        <MessageCircleMore />
        <span>Diretas</span>
        <CountBadge value={unreadDirectCount} />
      </button>
      <button onClick={onOpenDecisions}>
        <ClipboardCheck />
        <span>Decisões</span>
        <CountBadge value={openDecisionCount} />
      </button>
      <button onClick={onOpenDetails}>
        <PanelRightOpen />
        <span>Detalhes</span>
      </button>
    </nav>
  );
}
