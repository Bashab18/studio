import { Home, BrainCircuit, MessageSquare, Users, Settings } from 'lucide-react';

export const adminNavItems = [
  { href: '/admin', icon: Home, label: 'Dashboard' },
  { href: '/admin/knowledge', icon: BrainCircuit, label: 'Knowledge Base' },
  { href: '/admin/history', icon: MessageSquare, label: 'Chat History' },
  { href: '/admin/users', icon: Users, label: 'User Profiles' },
  { href: '/admin/settings', icon: Settings, label: 'Settings' },
];
