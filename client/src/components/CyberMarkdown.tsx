import React from "react";

export function CyberMarkdown({ content }: { content: string }) {
  // Simple regex parser for markdown
  const parseLines = (text: string) => {
    // Check for code blocks
    const parts = text.split(/(```[\s\S]*?```)/g);
    
    return parts.map((part, index) => {
      if (part.startsWith('```') && part.endsWith('```')) {
        const code = part.slice(3, -3);
        const firstLineBreak = code.indexOf('\n');
        let language = "";
        let actualCode = code;
        if (firstLineBreak > -1 && firstLineBreak < 15) {
          language = code.slice(0, firstLineBreak).trim();
          actualCode = code.slice(firstLineBreak + 1);
        }
        return (
          <div key={index} className="my-2 rounded-xl border border-white/10 bg-[#060608]/80 shadow-inner overflow-hidden">
            {language && (
              <div className="bg-white/5 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-orange-400/80 border-b border-white/5">
                {language}
              </div>
            )}
            <pre className="p-3 text-[12px] font-mono text-emerald-300 overflow-x-auto">
              <code>{actualCode}</code>
            </pre>
          </div>
        );
      }

      // Parse inline elements (bold, italic, inline code, images)
      let parsed = part;
      const inlineParts = parsed.split(/(!\[.*?\]\(.*?\)|\*\*.*?\*\*|\*.*?\*|`.*?`)/g);
      
      return (
        <span key={index}>
          {inlineParts.map((inlinePart, i) => {
            if (inlinePart.startsWith('![') && inlinePart.includes('](') && inlinePart.endsWith(')')) {
              const altMatch = inlinePart.match(/!\[(.*?)\]/);
              const urlMatch = inlinePart.match(/\((.*?)\)/);
              if (altMatch && urlMatch) {
                return <span key={i} className="block mt-2 mb-1"><img src={urlMatch[1]} alt={altMatch[1]} className="max-w-[280px] rounded-xl border border-white/10 shadow-lg object-cover" /></span>;
              }
            }
            if (inlinePart.startsWith('**') && inlinePart.endsWith('**')) {
              return <strong key={i} className="font-bold text-white">{inlinePart.slice(2, -2)}</strong>;
            }
            if (inlinePart.startsWith('*') && inlinePart.endsWith('*')) {
              return <em key={i} className="italic text-white/80">{inlinePart.slice(1, -1)}</em>;
            }
            if (inlinePart.startsWith('`') && inlinePart.endsWith('`')) {
              return <code key={i} className="px-1.5 py-0.5 rounded-md bg-white/10 text-orange-200 font-mono text-[11px]">{inlinePart.slice(1, -1)}</code>;
            }
            return <React.Fragment key={i}>{inlinePart}</React.Fragment>;
          })}
        </span>
      );
    });
  };

  return <div className="whitespace-pre-wrap break-words">{parseLines(content)}</div>;
}
