const fs = require('fs');
let c = fs.readFileSync('client/src/pages/CloudflareHome.tsx', 'utf8');

const injection = `
export default function CloudflareHome() {
  const [appMode, setAppMode] = useState<AppMode | null>(() => {
    return (localStorage.getItem("vybe_app_mode") as AppMode) || null;
  });
`;

c = c.replace('export default function CloudflareHome() {', injection);

fs.writeFileSync('client/src/pages/CloudflareHome.tsx', c);
