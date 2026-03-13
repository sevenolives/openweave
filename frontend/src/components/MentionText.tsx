import React from 'react';

/**
 * Renders text with @[username] mentions highlighted as styled spans.
 */
export default function MentionText({ text, className = '' }: { text: string; className?: string }) {
  const parts = text.split(/(@\[[^\]]+\])/g);
  return (
    <span className={className}>
      {parts.map((part, i) => {
        const match = part.match(/^@\[([^\]]+)\]$/);
        if (match) {
          return (
            <span
              key={i}
              className="inline-flex items-center px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 text-xs font-medium mx-0.5"
            >
              @{match[1]}
            </span>
          );
        }
        return <React.Fragment key={i}>{part}</React.Fragment>;
      })}
    </span>
  );
}
