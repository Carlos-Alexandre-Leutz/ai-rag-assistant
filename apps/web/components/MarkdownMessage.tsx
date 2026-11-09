import ReactMarkdown, { Components } from 'react-markdown';

const components: Components = {
  p: ({ children }) => <p className="mb-3 last:mb-0">{children}</p>,
  strong: ({ children }) => <strong className="font-semibold text-white">{children}</strong>,
  ul: ({ children }) => <ul className="mb-3 last:mb-0 list-disc pl-5 space-y-1">{children}</ul>,
  ol: ({ children }) => <ol className="mb-3 last:mb-0 list-decimal pl-5 space-y-1">{children}</ol>,
  h1: ({ children }) => <h1 className="mb-2 mt-4 first:mt-0 text-lg font-bold">{children}</h1>,
  h2: ({ children }) => <h2 className="mb-2 mt-4 first:mt-0 text-base font-bold">{children}</h2>,
  h3: ({ children }) => <h3 className="mb-2 mt-3 first:mt-0 font-semibold">{children}</h3>,
  blockquote: ({ children }) => (
    <blockquote className="mb-3 border-l-2 border-[#ffb3b6] pl-3 italic text-[#e5bdbe]">
      {children}
    </blockquote>
  ),
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-[#ffb3b6] underline underline-offset-2"
    >
      {children}
    </a>
  ),
  pre: ({ children }) => (
    <pre className="mb-3 last:mb-0 overflow-x-auto rounded-lg bg-[#131b2e] border border-[#5c3f40] p-3 font-mono text-xs">
      {children}
    </pre>
  ),
  code: ({ className, children }) =>
    className ? (
      <code className={className}>{children}</code>
    ) : (
      <code className="rounded bg-[#131b2e] px-1 py-0.5 font-mono text-[0.85em]">{children}</code>
    ),
  table: ({ children }) => (
    <div className="mb-3 overflow-x-auto">
      <table className="w-full border-collapse text-xs">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border border-[#5c3f40] px-2 py-1 text-left font-semibold">{children}</th>
  ),
  td: ({ children }) => <td className="border border-[#5c3f40] px-2 py-1">{children}</td>,
};

export default function MarkdownMessage({ content }: { content: string }) {
  return (
    <div className="text-sm break-words">
      <ReactMarkdown components={components}>{content}</ReactMarkdown>
    </div>
  );
}
