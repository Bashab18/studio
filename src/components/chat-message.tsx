import { cn } from '@/lib/utils';
import { Bot, User } from 'lucide-react';
import type { Message } from './chat-page';

type ChatMessageProps = {
  message: Message;
};

// Simple markdown parser for bold and italics
const parseMarkdown = (text: string) => {
  // Add a non-breaking space if the text is empty to prevent the div from collapsing
  if (!text.trim()) {
    return { __html: '&nbsp;' };
  }
  const boldRegex = /\*\*(.*?)\*\*/g;
  const italicRegex = /\*(.*?)\*/g;
  
  let html = text.replace(boldRegex, '<strong>$1</strong>');
  html = html.replace(italicRegex, '<em>$1</em>');
  
  return { __html: html };
};


export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user';

  // Add a blinking cursor for the last streaming message
  const isStreaming = message.content === '' && message.role === 'assistant';

  return (
    <div
      className={cn(
        'flex items-start gap-3 animate-in fade-in-0 slide-in-from-bottom-4 duration-500',
        isUser ? 'justify-end' : 'justify-start'
      )}
    >
      {!isUser && (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Bot size={20} />
        </div>
      )}
      <div
        className={cn(
          'max-w-md rounded-lg px-4 py-3 text-sm shadow-md',
          isUser
            ? 'rounded-br-none bg-primary text-primary-foreground'
            : 'rounded-bl-none bg-card text-card-foreground'
        )}
      >
        <p className="leading-relaxed" dangerouslySetInnerHTML={parseMarkdown(message.content)} />
        {isStreaming && <span className="animate-pulse">|</span>}
      </div>
       {isUser && (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
          <User size={20} />
        </div>
      )}
    </div>
  );
}
