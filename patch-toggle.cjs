const fs = require('fs');
let c = fs.readFileSync('client/src/pages/CloudflareHome.tsx', 'utf8');

if (!c.includes('Gamepad2')) {
  c = c.replace('import {\n  Bell,', 'import { Gamepad2, Briefcase, Bell,');
}

const toggleButton = `
        <button
          onClick={() => {
            const nextMode = appMode === "vybegaming" ? "vybechat" : "vybegaming";
            setAppMode(nextMode);
            localStorage.setItem("vybe_app_mode", nextMode);
          }}
          className="grid size-8 place-items-center rounded-lg text-stone-500 hover:bg-white/5 hover:text-white"
          aria-label="Trocar modo"
          title={appMode === "vybegaming" ? "Mudar para Trabalho" : "Mudar para Gaming"}
        >
          {appMode === "vybegaming" ? <Briefcase className="size-4" /> : <Gamepad2 className="size-4" />}
        </button>
        <button
          onClick={() => {`;

c = c.replace(
  '<button\n          onClick={() => {\n            leaveVoice();',
  toggleButton
);

fs.writeFileSync('client/src/pages/CloudflareHome.tsx', c);
