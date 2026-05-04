import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";

const components: Components = {
  h1: ({ children, ...props }) => (
    <h1 className="text-xl font-bold mb-3 mt-4 text-slate-900 dark:text-slate-100" {...props}>{children}</h1>
  ),
  h2: ({ children, ...props }) => (
    <h2 className="text-lg font-bold mb-2 mt-3 text-slate-900 dark:text-slate-100" {...props}>{children}</h2>
  ),
  h3: ({ children, ...props }) => (
    <h3 className="text-base font-semibold mb-2 mt-3 text-slate-900 dark:text-slate-100" {...props}>{children}</h3>
  ),
  h4: ({ children, ...props }) => (
    <h4 className="text-sm font-semibold mb-1 mt-2 text-slate-900 dark:text-slate-100" {...props}>{children}</h4>
  ),
  h5: ({ children, ...props }) => (
    <h5 className="text-sm font-medium mb-1 mt-2 text-slate-900 dark:text-slate-100" {...props}>{children}</h5>
  ),
  h6: ({ children, ...props }) => (
    <h6 className="text-sm font-medium mb-1 mt-2 text-slate-700 dark:text-slate-300" {...props}>{children}</h6>
  ),
  p: ({ children, ...props }) => (
    <p className="mb-2 leading-relaxed" {...props}>{children}</p>
  ),
  a: ({ children, href, ...props }) => (
    <a
      href={href}
      className="text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 underline"
      target="_blank"
      rel="noopener noreferrer"
      {...props}
    >
      {children}
    </a>
  ),
  ul: ({ children, ...props }) => (
    <ul className="list-disc list-inside mb-2 space-y-1" {...props}>{children}</ul>
  ),
  ol: ({ children, ...props }) => (
    <ol className="list-decimal list-inside mb-2 space-y-1" {...props}>{children}</ol>
  ),
  li: ({ children, ...props }) => (
    <li className="text-sm" {...props}>{children}</li>
  ),
  blockquote: ({ children, ...props }) => (
    <blockquote className="border-l-4 border-slate-300 dark:border-slate-600 pl-4 italic text-slate-600 dark:text-slate-400 mb-2" {...props}>{children}</blockquote>
  ),
  hr: (props) => (
    <hr className="my-4 border-slate-300 dark:border-slate-600" {...props} />
  ),
  table: ({ children, ...props }) => (
    <div className="overflow-x-auto mb-2">
      <table className="min-w-full border-collapse border border-slate-300 dark:border-slate-600 text-sm" {...props}>{children}</table>
    </div>
  ),
  thead: ({ children, ...props }) => (
    <thead className="bg-slate-100 dark:bg-slate-800" {...props}>{children}</thead>
  ),
  tbody: ({ children, ...props }) => <tbody {...props}>{children}</tbody>,
  tr: ({ children, ...props }) => (
    <tr className="border-b border-slate-200 dark:border-slate-700 even:bg-slate-50 dark:even:bg-slate-800/50" {...props}>{children}</tr>
  ),
  th: ({ children, ...props }) => (
    <th className="border border-slate-300 dark:border-slate-600 px-3 py-1.5 text-left font-semibold" {...props}>{children}</th>
  ),
  td: ({ children, ...props }) => (
    <td className="border border-slate-300 dark:border-slate-600 px-3 py-1.5" {...props}>{children}</td>
  ),
  strong: ({ children, ...props }) => (
    <strong className="font-bold" {...props}>{children}</strong>
  ),
  em: ({ children, ...props }) => (
    <em className="italic" {...props}>{children}</em>
  ),
  del: ({ children, ...props }) => (
    <del className="line-through" {...props}>{children}</del>
  ),
  img: ({ src, alt, ...props }) => (
    <img src={src} alt={alt} className="max-w-full h-auto rounded my-2" {...props} />
  ),
  pre: ({ children, ...props }) => (
    <pre className="bg-slate-800 dark:bg-slate-900 text-slate-100 rounded-lg p-3 overflow-x-auto text-sm font-mono leading-relaxed mb-2" {...props}>{children}</pre>
  ),
  code: ({ children, className, ...props }) => {
    const isInline = !className;
    if (isInline) {
      return (
        <code className="px-1.5 py-0.5 rounded text-sm font-mono bg-slate-500/20 text-[0.9em]" {...props}>{children}</code>
      );
    }
    return (
      <code className={`text-sm font-mono ${className || ""}`} {...props}>{children}</code>
    );
  },
};

interface MarkdownRendererProps {
  content: string;
}

export function MarkdownRenderer({ content }: MarkdownRendererProps) {
  if (!content || !content.trim()) {
    return null;
  }

  return (
    <div className="markdown-content">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={components}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
