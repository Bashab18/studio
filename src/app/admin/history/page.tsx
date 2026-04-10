'use client';

import { useState, useEffect, useRef } from 'react';
import { collection, query, orderBy, onSnapshot, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { type User } from '@/lib/auth';
import type { Message } from '@/components/chat-page';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { ScrollArea } from '@/components/ui/scroll-area';
import { ChatMessage } from '@/components/chat-message';
import { Bot, Loader2, MessageSquare, User as UserIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

function UserList({ users, selectedUser, onSelectUser }: { users: User[], selectedUser: User | null, onSelectUser: (user: User) => void }) {
    return (
        <Card className="w-full md:w-1/3">
            <CardHeader>
                <CardTitle>Users</CardTitle>
                <CardDescription>Select a user to view their chat history.</CardDescription>
            </CardHeader>
            <CardContent>
                <ScrollArea className="h-[calc(100vh-16rem)]">
                    <div className="space-y-2">
                        {users.map(user => (
                            <button key={user.id} onClick={() => onSelectUser(user)} className={cn(
                                "w-full text-left p-3 rounded-lg flex items-center gap-3 transition-colors",
                                selectedUser?.id === user.id ? "bg-accent text-accent-foreground" : "hover:bg-accent/50"
                            )}>
                                <Avatar className="h-9 w-9">
                                    <AvatarFallback className={cn(selectedUser?.id === user.id ? 'bg-primary text-primary-foreground' : 'bg-muted')}>
                                        {user.name.charAt(0).toUpperCase()}
                                    </AvatarFallback>
                                </Avatar>
                                <div>
                                    <p className="font-semibold text-sm">{user.name}</p>
                                    <p className="text-xs text-muted-foreground">{user.email}</p>
                                </div>
                            </button>
                        ))}
                    </div>
                </ScrollArea>
            </CardContent>
        </Card>
    );
}

function ChatHistoryDisplay({ user }: { user: User | null }) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const scrollAreaRef = useRef<HTMLDivElement>(null);
    const MAX_MESSAGES = 500; // Limit to prevent performance issues

    useEffect(() => {
        if (user) {
            setIsLoading(true);
            const q = query(
                collection(db, 'chats', user.id, 'messages'),
                orderBy('createdAt', 'asc'),
                limit(MAX_MESSAGES) // Limit for performance
            );
            const unsubscribe = onSnapshot(q, (querySnapshot) => {
                const newMessages: Message[] = [];
                querySnapshot.forEach(doc => {
                    newMessages.push({ id: doc.id, ...doc.data() } as Message);
                });
                setMessages(newMessages);
                setIsLoading(false);
            }, (error) => {
                console.error('Error loading chat history:', error);
                setIsLoading(false);
            });

            return () => unsubscribe();
        } else {
            setMessages([]);
        }
    }, [user]);

    useEffect(() => {
        if (scrollAreaRef.current) {
            scrollAreaRef.current.scrollTo({
                top: scrollAreaRef.current.scrollHeight,
                behavior: 'smooth'
            });
        }
    }, [messages]);

    return (
        <Card className="w-full md:w-2/3">
            <CardHeader>
                <CardTitle>Chat History</CardTitle>
                <CardDescription>
                  {user ? `Viewing conversation for ${user.name}` : 'Select a user to begin'}
                  {user && messages.length > 0 && ` (${messages.length} messages${messages.length >= MAX_MESSAGES ? ' - limited to most recent' : ''})`}
                </CardDescription>
            </CardHeader>
            <CardContent>
                <ScrollArea className="h-[calc(100vh-16rem)] border rounded-lg" ref={scrollAreaRef}>
                     <div className="p-4 md:p-6">
                        {isLoading ? (
                            <div className="flex h-full items-center justify-center">
                                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            </div>
                        ) : messages.length > 0 ? (
                            <div className="space-y-6">
                                {messages.map((msg, index) => (
                                    <ChatMessage key={msg.id || index} message={msg} />
                                ))}
                            </div>
                        ) : (
                             <div className="flex h-full flex-col items-center justify-center text-center text-muted-foreground">
                                <MessageSquare className="mb-4 h-16 w-16" />
                                <h3 className="text-xl font-semibold">
                                    {user ? 'No Messages Yet' : 'No User Selected'}
                                </h3>
                                <p className="text-sm">{user ? 'This user has not started a conversation.' : 'Please select a user from the list to see their chat history.'}</p>
                            </div>
                        )}
                    </div>
                </ScrollArea>
            </CardContent>
        </Card>
    );
}


export default function ChatHistoryPage() {
    const [users, setUsers] = useState<User[]>([]);
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        // Use onSnapshot for real-time user updates, though less critical here than chat.
        const usersQuery = query(collection(db, 'users'), orderBy('name', 'asc'));
        const unsubscribe = onSnapshot(usersQuery, (querySnapshot) => {
            const usersList = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));
            setUsers(usersList.filter(u => u.role === 'user'));
            setIsLoading(false);
        }, (error) => {
            console.error("Error fetching users:", error);
            setIsLoading(false);
        });

        return () => unsubscribe();
    }, []);

    if (isLoading) {
        return <div className="flex justify-center items-center h-full"><Loader2 className="h-8 w-8 animate-spin" /></div>
    }

    return (
        <div className="flex flex-col md:flex-row gap-4 h-full">
            <UserList users={users} selectedUser={selectedUser} onSelectUser={setSelectedUser} />
            <ChatHistoryDisplay user={selectedUser} />
        </div>
    );
}
