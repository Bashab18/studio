import { cn } from '@/lib/utils';
import { Bot, User } from 'lucide-react';
import type { Message } from './chat-page';
import DOMPurify from 'isomorphic-dompurify';
import { marked } from 'marked';

type ChatMessageProps = {
  message: Message;
};

// Parse markdown safely using marked + DOMPurify
const parseMarkdown = (text: string): { __html: string } => {
  try {
    // Use marked to parse markdown
    let html = marked.parse(text, {
      async: false,
      breaks: true,
      gfm: true,
    }) as string;

    // Sanitize the HTML to remove any potentially dangerous content
    const sanitized = DOMPurify.sanitize(html, {
      ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 'code', 'pre', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'blockquote'],
      ALLOWED_ATTR: []
    });

    return { __html: sanitized };
  } catch (error) {
    console.error('Error parsing markdown:', error);
    // Fallback: escape HTML and return as plain text
    const escaped = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, '<br />');
    return { __html: escaped };
  }
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
      </div>
       {isUser && (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
          <User size={20} />
        </div>
      )}
    </div>
  );
}
