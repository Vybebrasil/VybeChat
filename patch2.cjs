const fs = require('fs');
let c = fs.readFileSync('client/src/pages/CloudflareHome.tsx', 'utf8');

const effectCode = `
  useEffect(() => {
    if (activeCallChannelId) playJoin();
    else playLeave();
  }, [activeCallChannelId]);
`;

const target = 'const [activeCallChannelId, setActiveCallChannelId] = useState<number | null>(';
const insertIdx = c.indexOf(target);
if (insertIdx > -1) {
  const insertEndIdx = c.indexOf(';', insertIdx) + 1;
  c = c.slice(0, insertEndIdx) + effectCode + c.slice(insertEndIdx);
}

fs.writeFileSync('client/src/pages/CloudflareHome.tsx', c);
console.log('done2');
