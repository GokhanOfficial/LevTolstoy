import React, { useRef, useImperativeHandle, forwardRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus, vs } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface PreviewPaneProps {
  content: string;
  isDark: boolean;
}

export interface PreviewPaneRef {
  getHtml: () => string;
}

const sanitizeSchema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    code: [...(defaultSchema.attributes?.code ?? []), 'className'],
    '*': [...(defaultSchema.attributes?.['*'] ?? []), 'className', 'style'],
  },
};

export const PreviewPane = forwardRef<PreviewPaneRef, PreviewPaneProps>(
  function PreviewPane({ content, isDark }, ref) {
    const containerRef = useRef<HTMLDivElement>(null);

    useImperativeHandle(ref, () => ({
      getHtml: () => containerRef.current?.innerHTML ?? '',
    }));

    return (
      <div
        ref={containerRef}
        aria-label="Markdown preview"
        aria-live="polite"
        className="h-full overflow-y-auto p-6"
        style={{ background: 'var(--preview-bg)', color: 'var(--foreground)' }}
      >
        <div className="max-w-3xl mx-auto">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeRaw, [rehypeSanitize, sanitizeSchema]]}
            components={{
              code({ node, className, children, ...props }: any) {
                const match = /language-(\w+)/.exec(className || '');
                const isInline = !match && !className;
                if (isInline) {
                  return (
                    <code
                      className="px-1.5 py-0.5 rounded"
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '0.875em',
                        background: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)',
                        color: isDark ? '#CE9178' : '#C7254E',
                      }}
                      {...props}
                    >
                      {children}
                    </code>
                  );
                }
                return (
                  <SyntaxHighlighter
                    style={isDark ? vscDarkPlus : vs}
                    language={match?.[1] ?? 'text'}
                    PreTag="div"
                    customStyle={{
                      margin: '1em 0',
                      borderRadius: '6px',
                      fontSize: '0.875em',
                      lineHeight: '1.6',
                    }}
                  >
                    {String(children).replace(/\n$/, '')}
                  </SyntaxHighlighter>
                );
              },
              h1: ({ children }) => (
                <h1 className="mt-6 mb-4 pb-2" style={{ borderBottom: '2px solid var(--primary)', color: 'var(--foreground)' }}>
                  {children}
                </h1>
              ),
              h2: ({ children }) => (
                <h2 className="mt-5 mb-3 pb-1" style={{ borderBottom: '1px solid var(--border)', color: 'var(--foreground)' }}>
                  {children}
                </h2>
              ),
              h3: ({ children }) => <h3 className="mt-4 mb-2" style={{ color: 'var(--foreground)' }}>{children}</h3>,
              h4: ({ children }) => <h4 className="mt-3 mb-2" style={{ color: 'var(--foreground)' }}>{children}</h4>,
              h5: ({ children }) => <h5 className="mt-3 mb-1" style={{ color: 'var(--foreground)' }}>{children}</h5>,
              h6: ({ children }) => <h6 className="mt-3 mb-1" style={{ color: 'var(--muted-foreground)' }}>{children}</h6>,
              p: ({ children }) => <p className="my-3" style={{ lineHeight: '1.75', color: 'var(--foreground)' }}>{children}</p>,
              a: ({ href, children }) => (
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: 'var(--primary)', textDecoration: 'underline' }}
                >
                  {children}
                </a>
              ),
              blockquote: ({ children }) => (
                <blockquote
                  className="pl-4 py-1 my-3 rounded-r"
                  style={{
                    borderLeft: `4px solid var(--primary)`,
                    background: 'var(--accent)',
                    color: 'var(--accent-foreground)',
                  }}
                >
                  {children}
                </blockquote>
              ),
              ul: ({ children }) => <ul className="my-3 pl-6 list-disc" style={{ color: 'var(--foreground)' }}>{children}</ul>,
              ol: ({ children }) => <ol className="my-3 pl-6 list-decimal" style={{ color: 'var(--foreground)' }}>{children}</ol>,
              li: ({ children }) => <li className="my-1" style={{ lineHeight: '1.7' }}>{children}</li>,
              table: ({ children }) => (
                <div className="overflow-x-auto my-4">
                  <table className="w-full border-collapse" style={{ borderRadius: '6px', overflow: 'hidden' }}>
                    {children}
                  </table>
                </div>
              ),
              thead: ({ children }) => (
                <thead style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}>
                  {children}
                </thead>
              ),
              th: ({ children }) => (
                <th className="px-4 py-2 text-left" style={{ fontWeight: 600 }}>
                  {children}
                </th>
              ),
              td: ({ children }) => (
                <td className="px-4 py-2" style={{ borderBottom: '1px solid var(--border)', color: 'var(--foreground)' }}>
                  {children}
                </td>
              ),
              tr: ({ children }) => (
                <tr className="even:bg-muted/30" style={{}}>
                  {children}
                </tr>
              ),
              hr: () => <hr className="my-6" style={{ borderColor: 'var(--border)' }} />,
              img: ({ src, alt }) => (
                <img
                  src={src}
                  alt={alt ?? ''}
                  className="max-w-full rounded my-3"
                  style={{ height: 'auto' }}
                />
              ),
              input: ({ type, checked, ...props }: any) =>
                type === 'checkbox' ? (
                  <input
                    type="checkbox"
                    checked={checked}
                    readOnly
                    aria-label="Task item"
                    className="mr-2 align-middle"
                    style={{ accentColor: 'var(--primary)' }}
                  />
                ) : (
                  <input type={type} {...props} />
                ),
            }}
          >
            {content}
          </ReactMarkdown>
        </div>
      </div>
    );
  }
);
