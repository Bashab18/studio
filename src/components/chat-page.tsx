'use client';

import { useState, useRef, useEffect, type FormEvent } from 'react';
import {
  collection,
  addDoc,
  serverTimestamp,
  query,
  orderBy,
  onSnapshot,
  where,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
  Bot,
  Loader2,
  Send,
  Trash2,
  LogOut,
  MessageSquare,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/hooks/use-auth';
import { ChatMessage } from './chat-message';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { chatbotAnswersQuestions } from '@/ai/flows/chatbot-answers-questions-from-knowledge-base';
import { useToast } from '@/hooks/use-toast';

export type Message = {
  id?: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt?: any;
};

export default function ChatPage() {
  const { user, logout } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      const q = query(
        collection(db, 'chats', user.id, 'messages'),
        orderBy('createdAt', 'asc')
      );
      const unsubscribe = onSnapshot(
        q,
        (querySnapshot) => {
          const newMessages: Message[] = [];
          querySnapshot.forEach((doc) => {
            newMessages.push({ id: doc.id, ...doc.data() } as Message);
          });
          setMessages(newMessages);
        },
        (error) => {
          toast({
            variant: 'destructive',
            title: 'Error',
            description: 'Could not load chat history.',
          });
        }
      );

      return () => unsubscribe();
    }
  }, [user, toast]);

  useEffect(() => {
    // Scroll to bottom when messages change
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTo({
        top: scrollAreaRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [messages]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading || !user) return;

    const userMessageContent = input;
    setInput('');

    const userMessage: Message = {
      role: 'user',
      content: userMessageContent,
      createdAt: serverTimestamp(),
    };
    await addDoc(collection(db, 'chats', user.id, 'messages'), userMessage);
    
    setIsLoading(true);

    try {
      const { answer } = await chatbotAnswersQuestions({ question: userMessageContent });
      const assistantMessage: Message = {
        role: 'assistant',
        content: answer,
        createdAt: serverTimestamp(),
      };
      await addDoc(collection(db, 'chats', user.id, 'messages'), assistantMessage);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to get a response from the AI.',
      });
      const assistantMessage: Message = {
        role: 'assistant',
        content: "Sorry, I couldn't process your request.",
        createdAt: serverTimestamp(),
      };
      await addDoc(collection(db, 'chats', user.id, 'messages'), assistantMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const clearChat = async () => {
    if (!user) return;

    // This is a more complex operation, for now we will just clear the local state
    // and show a toast. For a real implementation, a Cloud Function would be better
    // to delete all subcollection documents.
    setMessages([]);
    toast({
        title: 'Chat Cleared (Locally)',
        description: 'Your conversation view has been cleared. Note: History is still saved.',
    });
  };

  return (
    <div className="flex h-screen w-full flex-col bg-background">
      <header className="flex h-16 shrink-0 items-center justify-between border-b bg-card px-4 md:px-6">
        <div className="flex items-center gap-2 font-semibold">
          <Bot className="h-6 w-6 text-primary" />
          <span className="font-headline text-lg">M-Health Assistant</span>
        </div>
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={clearChat}
            aria-label="Clear conversation"
          >
            <Trash2 className="h-5 w-5" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="relative h-8 w-8 rounded-full"
              >
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-primary text-primary-foreground">
                    {user?.name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">
                    {user?.name}
                  </p>
                  <p className="text-xs leading-none text-muted-foreground">
                    {user?.email}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={logout}>
                <LogOut className="mr-2 h-4 w-4" />
                <span>Log out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>
      <main className="flex-1 overflow-hidden">
        <ScrollArea className="h-full" ref={scrollAreaRef}>
          <div className="p-4 md:p-6">
            {messages.length === 0 && !isLoading ? (
              <div className="flex h-[calc(100vh-12rem)] flex-col items-center justify-center text-center">
                <MessageSquare className="mb-4 h-16 w-16 text-muted-foreground/30" />
                <h3 className="text-xl font-semibold text-muted-foreground">
                  Welcome to M-Health
                </h3>
                <p className="text-muted-foreground">
                  Start a conversation by typing your health question below.
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {messages.map((msg) => (
                  <ChatMessage key={msg.id} message={msg} />
                ))}
                {isLoading && (
                  <div className="flex items-start gap-3 justify-start">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                      <Bot size={20} />
                    </div>
                    <div className="max-w-md rounded-lg rounded-bl-none bg-card px-4 py-3 text-sm shadow-md">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </ScrollArea>
      </main>
      <footer className="border-t bg-card p-4 md:p-6">
        <form
          onSubmit={handleSubmit}
          className="mx-auto flex w-full max-w-3xl items-center gap-4"
        >
          <Input
            type="text"
            placeholder="Ask anything about your health..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isLoading}
            className="flex-1"
          />
          <Button
            type="submit"
            size="icon"
            disabled={isLoading || !input.trim()}
          >
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Send className="h-5 w-5" />
            )}
            <span className="sr-only">Send</span>
          </Button>
        </form>
      </footer>
    </div>
  );
}
