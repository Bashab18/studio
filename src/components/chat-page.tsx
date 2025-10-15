'use client';

import { useState, useRef, useEffect, type FormEvent } from 'react';
import {
  collection,
  addDoc,
  serverTimestamp,
  query,
  orderBy,
  onSnapshot,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
  Bot,
  Loader2,
  Send,
  Trash2,
  LogOut,
  MessageSquare,
  User as UserIcon,
  Volume2,
  VolumeX,
  Mic,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { updateUserProfileInfo } from '@/ai/flows/user-manages-own-profile';
import { clearChatHistory } from '@/ai/flows/user-clears-chat-history';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { v4 as uuidv4 } from 'uuid';
import { textToSpeech } from '@/ai/flows/text-to-speech';
import { cn } from '@/lib/utils';


export type Message = {
  id?: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt?: any;
};

// SpeechRecognition type declaration for window
declare global {
  interface Window {
    SpeechRecognition: typeof SpeechRecognition;
    webkitSpeechRecognition: typeof SpeechRecognition;
  }
}

function UserProfileDialog() {
  const { user, refreshUserProfile } = useAuth();
  const [profileInfo, setProfileInfo] = useState(user?.profileInfo || '');
  const [isSaving, setIsSaving] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      setProfileInfo(user.profileInfo || '');
    }
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    setIsSaving(true);
    try {
      const result = await updateUserProfileInfo({ userId: user.id, profileInfo });
      if (result.success) {
        toast({
          title: 'Success',
          description: 'Your profile information has been updated.',
        });
        await refreshUserProfile();
        setIsOpen(false);
      } else {
        throw new Error(result.message);
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error updating profile',
        description: (error as Error).message,
      });
    } finally {
      setIsSaving(false);
    }
  };
  
  return (
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
            <Button variant="ghost" size="icon">
                <UserIcon className="h-5 w-5" />
                <span className="sr-only">My Profile</span>
            </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
                <DialogTitle>My Profile</DialogTitle>
                <DialogDescription>
                    This information will be used by the chatbot to provide more personalized responses.
                </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
                <div className="grid w-full gap-1.5">
                    <Label htmlFor="profile-info">Your Profile Details</Label>
                    <Textarea
                        id="profile-info"
                        placeholder="e.g., I am a 30-year-old male with a history of anxiety..."
                        value={profileInfo}
                        onChange={(e) => setProfileInfo(e.target.value)}
                        className="min-h-[150px]"
                    />
                </div>
            </div>
            <DialogFooter>
                <DialogClose asChild>
                    <Button variant="outline">Cancel</Button>
                </DialogClose>
                <Button onClick={handleSave} disabled={isSaving}>
                    {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Save
                </Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
  )

}


export default function ChatPage() {
  const { user, logout } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [isAudioEnabled, setIsAudioEnabled] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
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
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onresult = (event) => {
        const transcript = Array.from(event.results)
          .map(result => result[0])
          .map(result => result.transcript)
          .join('');
        setInput(transcript);

        if (event.results[0].isFinal) {
            handleVoiceSubmit(transcript);
        }
      };

      recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        toast({ variant: 'destructive', title: 'Voice Error', description: `Could not recognize speech: ${event.error}` });
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    } else {
      console.warn('Speech Recognition not supported in this browser.');
    }
  }, [toast]);

  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTo({
        top: scrollAreaRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [messages]);

  const playAudio = (audioData: string) => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    const audio = new Audio(audioData);
    audio.play();
    audioRef.current = audio;
  };

  const handleMessageSubmit = async (messageContent: string) => {
    if (!messageContent.trim() || isLoading || !user) return;
  
    const userMessage: Message = {
      role: 'user',
      content: messageContent,
      createdAt: serverTimestamp(),
    };
    await addDoc(collection(db, 'chats', user.id, 'messages'), userMessage);
    
    setIsLoading(true);
  
    const assistantMessageId = uuidv4();
    const tempAssistantMessage: Message = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
    };
    setMessages(currentMessages => [...currentMessages, tempAssistantMessage]);
  
    let finalAnswer = '';
  
    try {
      const stream = chatbotAnswersQuestions({ 
        question: messageContent,
        userProfileInfo: user.profileInfo || '',
      });
  
      for await (const chunk of stream) {
        if (chunk.text) {
          finalAnswer += chunk.text;
          setMessages(currentMessages => 
            currentMessages.map(msg => 
              msg.id === assistantMessageId ? { ...msg, content: finalAnswer } : msg
            )
          );
        }
      }
  
      const assistantMessage: Message = {
        role: 'assistant',
        content: finalAnswer,
        createdAt: serverTimestamp(),
      };
      await addDoc(collection(db, 'chats', user.id, 'messages'), assistantMessage);
  
      setMessages(currentMessages => currentMessages.filter(msg => msg.id !== assistantMessageId));
      
      if (isAudioEnabled && finalAnswer) {
          try {
              const { audio } = await textToSpeech(finalAnswer);
              playAudio(audio);
          } catch(audioError) {
              console.error("Audio generation failed:", audioError);
              toast({
                  variant: "destructive",
                  title: "Audio Error",
                  description: "Could not generate audio for the response.",
              });
          }
      }
  
    } catch (error) {
      console.error("Error getting response:", error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to get a response from the AI.',
      });
      const errorMessage: Message = {
        role: 'assistant',
        content: "Sorry, I couldn't process your request. An error occurred.",
        createdAt: serverTimestamp(),
      };
      await addDoc(collection(db, 'chats', user.id, 'messages'), errorMessage);
      setMessages(currentMessages => currentMessages.filter(msg => msg.id !== assistantMessageId));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    handleMessageSubmit(input);
    setInput('');
  };
  
  const handleVoiceSubmit = async (transcribedText: string) => {
    if (transcribedText.trim()) {
        handleMessageSubmit(transcribedText);
    }
    setInput('');
  };

  const startListening = () => {
    if (recognitionRef.current && !isListening) {
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

  const stopListening = () => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  };

  const handleClearChat = async () => {
    if (!user) return;
    setIsClearing(true);
    try {
        await clearChatHistory(user.id);
        toast({
            title: 'Chat History Cleared',
            description: 'Your conversation has been permanently deleted.',
        });
    } catch (error) {
         toast({
            variant: 'destructive',
            title: 'Error',
            description: (error as Error).message || 'Could not clear chat history.',
        });
    } finally {
        setIsClearing(false);
    }
  };

  const toggleAudio = () => {
    setIsAudioEnabled(prev => {
        if (prev && audioRef.current) {
            audioRef.current.pause();
            audioRef.current = null;
        }
        return !prev;
    });
  }

  return (
    <div className="flex h-screen w-full flex-col bg-background">
      <header className="flex h-16 shrink-0 items-center justify-between border-b bg-card px-4 md:px-6">
        <div className="flex items-center gap-2 font-semibold">
          <Bot className="h-6 w-6 text-primary" />
          <span className="font-headline text-lg">M-Health Assistant</span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={toggleAudio}>
            {isAudioEnabled ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
            <span className="sr-only">{isAudioEnabled ? 'Disable Audio' : 'Enable Audio'}</span>
          </Button>
          <UserProfileDialog />
          <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    disabled={isClearing}
                    aria-label="Clear conversation"
                >
                    <Trash2 className="h-5 w-5" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete your entire chat history. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleClearChat} disabled={isClearing}>
                    {isClearing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Clear History
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
          </AlertDialog>
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
                {messages.map((msg, index) => (
                  <ChatMessage key={msg.id || `msg-${index}`} message={msg} />
                ))}
                {isLoading && messages[messages.length - 1]?.role !== 'assistant' && (
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
          className="mx-auto flex w-full max-w-3xl items-center gap-2"
        >
          <Input
            type="text"
            placeholder={isListening ? 'Listening...' : 'Ask anything about your health...'}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isLoading || isListening}
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
           <Button
            type="button"
            size="icon"
            variant={isListening ? 'destructive' : 'outline'}
            onMouseDown={startListening}
            onMouseUp={stopListening}
            onTouchStart={startListening}
            onTouchEnd={stopListening}
            disabled={!recognitionRef.current || isLoading}
          >
            <Mic className="h-5 w-5" />
            <span className="sr-only">Talk to chatbot</span>
          </Button>
        </form>
      </footer>
    </div>
  );
}

    