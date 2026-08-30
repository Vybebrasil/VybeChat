const fs = require('fs');
let c = fs.readFileSync('client/src/pages/CloudflareHome.tsx', 'utf8');

const profileCheck = `  if (!profile) {
    return (
      <TeamLogin
        workerUrl={String(import.meta.env.VITE_REALTIME_WORKER_URL ?? "")}
        codigoInicial={workspaceCode}
        erroExterno={authError}
        onEntrar={entrarComoMembro}
        onEntrarPorNome={entrarPorNome}
      />
    );
  }`;

const newProfileCheck = `  if (!profile) {
    if (!appMode) {
      return (
        <ModeSelection
          onSelect={mode => {
            setAppMode(mode);
            localStorage.setItem("vybe_app_mode", mode);
          }}
        />
      );
    }
    
    if (appMode === "vybegaming") {
      return (
        <GamingLogin
          codigoInicial={workspaceCode}
          erroExterno={authError}
          onBack={() => {
            setAppMode(null);
            localStorage.removeItem("vybe_app_mode");
          }}
          onEntrar={(nome, avatar, codigo) => {
            guardarPerfil(
              {
                id: crypto.randomUUID(),
                name: nome,
                photo: avatar,
              },
              codigo
            );
          }}
        />
      );
    }

    return (
      <TeamLogin
        workerUrl={String(import.meta.env.VITE_REALTIME_WORKER_URL ?? "")}
        codigoInicial={workspaceCode}
        erroExterno={authError}
        onEntrar={entrarComoMembro}
        onEntrarPorNome={entrarPorNome}
      />
    );
  }`;

if (c.includes(profileCheck)) {
  c = c.replace(profileCheck, newProfileCheck);
} else {
  console.log("Could not find profile check block");
}

fs.writeFileSync('client/src/pages/CloudflareHome.tsx', c);
