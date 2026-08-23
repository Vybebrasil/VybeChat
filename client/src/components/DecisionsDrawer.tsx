import { CheckCircle2, ClipboardCheck, Plus, X } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";

export type TeamDecision = {
  id: string;
  title: string;
  ownerName: string;
  dueDate: string;
  status: "open" | "done";
  createdAt: string;
  createdBy: string;
};
type Props = {
  decisions: TeamDecision[];
  profileName: string;
  onCreate: (data: {
    title: string;
    ownerName: string;
    dueDate: string;
  }) => void;
  onUpdate: (id: string, status: "open" | "done") => void;
  hideTrigger?: boolean;
};

export function DecisionsDrawer({
  decisions,
  profileName,
  onCreate,
  onUpdate,
  hideTrigger = false,
}: Props) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [ownerName, setOwnerName] = useState(profileName);
  const [dueDate, setDueDate] = useState("");
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!title.trim()) return;
    onCreate({
      title: title.trim(),
      ownerName: ownerName.trim() || profileName,
      dueDate,
    });
    setTitle("");
    setDueDate("");
  };
  const openCount = decisions.filter(
    decision => decision.status === "open"
  ).length;
  useEffect(() => {
    const openFromShell = () => setOpen(true);
    window.addEventListener("vybe:open-decisions", openFromShell);
    return () =>
      window.removeEventListener("vybe:open-decisions", openFromShell);
  }, []);
  return (
    <>
      {!hideTrigger && (
        <button
          onClick={() => setOpen(true)}
          className="vybe-decisions-trigger fixed bottom-4 right-[128px] z-20 hidden items-center gap-2 rounded-xl border border-orange-300/20 bg-[#111217]/95 px-3 py-2 text-xs font-semibold text-orange-100 shadow-xl backdrop-blur sm:flex"
          aria-label="Abrir decisões"
        >
          <ClipboardCheck className="size-4 text-orange-400" />
          Decisões
          {openCount > 0 && (
            <span className="grid min-w-5 place-items-center rounded-full bg-orange-400 px-1.5 py-0.5 text-[10px] font-bold text-black">
              {openCount}
            </span>
          )}
        </button>
      )}
      {open && (
        <section className="vybe-decisions-drawer fixed inset-y-0 right-0 z-[72] flex w-full max-w-md flex-col border-l border-orange-300/25 bg-[#0b0c10]/98 p-4 shadow-2xl backdrop-blur sm:p-5">
          <header className="flex items-center justify-between border-b border-orange-300/15 pb-4">
            <div>
              <p className="cyber-label">Central de decisões</p>
              <h3 className="mt-1 font-sans text-lg font-semibold text-orange-50">
                Próximos compromissos
              </h3>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="grid size-9 rounded-xl border border-orange-300/20 text-orange-100"
              aria-label="Fechar decisões"
            >
              <X className="size-4" />
            </button>
          </header>
          <form
            onSubmit={submit}
            className="mt-4 rounded-2xl border border-orange-300/15 bg-white/[.025] p-3"
          >
            <input
              value={title}
              onChange={event => setTitle(event.target.value)}
              placeholder="Qual decisão precisa virar ação?"
              className="h-10 w-full border-b border-orange-300/15 bg-transparent text-sm text-orange-50 outline-none placeholder:text-stone-600"
            />
            <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
              <input
                value={ownerName}
                onChange={event => setOwnerName(event.target.value)}
                placeholder="Responsável"
                className="h-9 min-w-0 rounded-lg border border-orange-300/15 bg-black/25 px-2 text-xs text-orange-50 outline-none"
              />
              <input
                type="date"
                value={dueDate}
                onChange={event => setDueDate(event.target.value)}
                className="h-9 rounded-lg border border-orange-300/15 bg-black/25 px-2 text-xs text-orange-50 outline-none"
              />
            </div>
            <button className="mt-3 flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-orange-500 text-xs font-bold text-black">
              <Plus className="size-4" />
              Registrar decisão
            </button>
          </form>
          <div className="mt-4 flex-1 space-y-2 overflow-y-auto">
            {decisions.length ? (
              decisions.map(decision => (
                <article
                  key={decision.id}
                  className={`rounded-xl border p-3 ${decision.status === "done" ? "border-emerald-400/15 bg-emerald-400/[.04]" : "border-orange-300/15 bg-white/[.025]"}`}
                >
                  <div className="flex gap-3">
                    <button
                      onClick={() =>
                        onUpdate(
                          decision.id,
                          decision.status === "done" ? "open" : "done"
                        )
                      }
                      className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border ${decision.status === "done" ? "border-emerald-400 bg-emerald-400 text-black" : "border-orange-300/35 text-transparent"}`}
                      aria-label="Alterar status"
                    >
                      <CheckCircle2 className="size-3.5" />
                    </button>
                    <div className="min-w-0 flex-1">
                      <p
                        className={`text-sm font-medium ${decision.status === "done" ? "text-stone-500 line-through" : "text-orange-50"}`}
                      >
                        {decision.title}
                      </p>
                      <p className="mt-1 text-[11px] text-stone-500">
                        {decision.ownerName}
                        {decision.dueDate
                          ? ` · ${new Date(`${decision.dueDate}T12:00:00`).toLocaleDateString("pt-BR")}`
                          : " · Sem prazo"}
                      </p>
                    </div>
                  </div>
                </article>
              ))
            ) : (
              <div className="grid h-48 place-items-center text-center">
                <div>
                  <ClipboardCheck className="mx-auto size-7 text-orange-300" />
                  <p className="mt-3 text-sm font-semibold text-orange-50">
                    Nenhuma decisão aberta
                  </p>
                  <p className="mt-1 text-xs text-stone-400">
                    Transforme alinhamentos do chat em compromissos claros.
                  </p>
                </div>
              </div>
            )}
          </div>
        </section>
      )}
    </>
  );
}
