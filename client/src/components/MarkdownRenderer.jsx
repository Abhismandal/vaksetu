import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Copy, Check, Terminal } from 'lucide-react';

const CodeBlock = ({ inline, className, children, ...props }) => {
  const [copied, setCopied] = useState(false);
  const match = /language-(\w+)/.exec(className || '');
  const language = match ? match[1] : '';
  const codeString = String(children).replace(/\n$/, '');

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(codeString);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy code:', err);
    }
  };

  if (!inline && (match || codeString.includes('\n'))) {
    return (
      <div className="my-3 rounded-2xl overflow-hidden border border-slate-700/60 bg-slate-950 text-slate-100 shadow-md">
        {/* Code Header Bar */}
        <div className="flex items-center justify-between px-3.5 py-1.5 bg-slate-900/90 border-b border-slate-800 text-[11px] font-mono text-slate-400">
          <div className="flex items-center space-x-1.5">
            <Terminal className="w-3.5 h-3.5 text-indigo-400" />
            <span className="capitalize font-semibold text-slate-300">
              {language || 'code'}
            </span>
          </div>

          <button
            onClick={handleCopy}
            className="flex items-center space-x-1 px-2 py-0.5 rounded-md hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
            title="Copy code"
          >
            {copied ? (
              <>
                <Check className="w-3 h-3 text-emerald-400" />
                <span className="text-[10px] text-emerald-400 font-medium">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3 h-3" />
                <span className="text-[10px]">Copy</span>
              </>
            )}
          </button>
        </div>

        {/* Code Content */}
        <pre className="p-3.5 overflow-x-auto text-xs font-mono leading-relaxed text-indigo-100 selection:bg-indigo-700">
          <code>{codeString}</code>
        </pre>
      </div>
    );
  }

  return (
    <code
      className="px-1.5 py-0.5 rounded-md font-mono text-xs bg-slate-100 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 border border-slate-200/60 dark:border-slate-700/60"
      {...props}
    >
      {children}
    </code>
  );
};

export const MarkdownRenderer = ({ content, isStreaming = false }) => {
  return (
    <div className="prose dark:prose-invert max-w-none text-xs sm:text-sm leading-relaxed break-words">
      <ReactMarkdown
        components={{
          code: CodeBlock,
          p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
          ul: ({ children }) => <ul className="list-disc pl-4 mb-2 space-y-1">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal pl-4 mb-2 space-y-1">{children}</ol>,
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
          h1: ({ children }) => <h1 className="text-base font-bold my-2 text-slate-900 dark:text-white">{children}</h1>,
          h2: ({ children }) => <h2 className="text-sm font-bold my-2 text-slate-900 dark:text-white">{children}</h2>,
          h3: ({ children }) => <h3 className="text-xs font-bold my-1.5 text-slate-900 dark:text-white">{children}</h3>,
          blockquote: ({ children }) => (
            <blockquote className="border-l-3 border-indigo-500 pl-3 my-2 italic text-slate-600 dark:text-slate-400">
              {children}
            </blockquote>
          ),
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-indigo-600 dark:text-indigo-400 hover:underline font-medium"
            >
              {children}
            </a>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
      {isStreaming && (
        <span className="inline-block w-1.5 h-3.5 bg-indigo-500 animate-pulse ml-0.5 align-middle rounded-xs" />
      )}
    </div>
  );
};

export default MarkdownRenderer;
