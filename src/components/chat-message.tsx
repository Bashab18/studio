'use client';

import { cn } from '@/lib/utils';
import { Bot, User } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import type { Message } from './chat-page';

type ChatMessageProps = {
  message: Message;
};

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user';

  return (
    <div
      className={cn(
        'flex items-start gap-3 animate-in fade-in-0 slide-in-from-bottom-4 duration-500',
        isUser ? 'justify-end' : 'justify-start'
      )}
    >
      {/* Bot Avatar */}
      {!isUser && (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Bot size={20} />
        </div>
      )}

      {/* Message Bubble */}
      <div
        className={cn(
          'max-w-md rounded-lg px-4 py-3 text-sm shadow-md prose prose-sm dark:prose-invert',
          isUser
            ? 'rounded-br-none bg-primary text-primary-foreground prose-p:text-primary-foreground'
            : 'rounded-bl-none bg-card text-card-foreground'
        )}
      >
        <ReactMarkdown
          remarkPlugins={[remarkGfm]} // Enables GitHub-style markdown (tables, lists, strikethrough, etc.)
          rehypePlugins={[rehypeRaw]}  // Allows safe inline HTML if present
          components={{
            a: ({ node, ...props }) => (
              <a {...props} className="text-blue-500 underline hover:text-blue-600" target="_blank" />
            ),
            code: ({ node, inline, className, children, ...props }) => (
              <code
                className={cn(
                  'rounded bg-muted px-1.5 py-0.5 text-xs font-mono',
                  className,
                  inline ? '' : 'block p-2'
                )}
                {...props}
              >
                {children}
              </code>
            ),
          }}
        >
          {message.content}
        </ReactMarkdown>
      </div>

      {/* User Avatar */}
      {isUser && (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
          <User size={20} />
        </div>
      )}
    </div>
  );
}
