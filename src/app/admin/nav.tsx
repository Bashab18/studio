// src/config/admin-nav.tsx
import { Home, MessageSquare, BrainCircuit, Users, Settings } from "lucide-react";

// Type definition for strong typing across components
export interface NavItem {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}

export const adminNavItems: ReadonlyArray<NavItem> = [
  {
    href: "/admin",
    icon: Home,
    label: "Dashboard",
  },
  {
    href: "/admin/knowledge",
    icon: BrainCircuit,
    label: "Knowledge Base",
  },
  {
    href: "/admin/history",
    icon: MessageSquare,
    label: "Chat History",
  },
  {
    href: "/admin/users",
    icon: Users,
    label: "User Profiles",
  },
  {
    href: "/admin/settings",
    icon: Settings,
    label: "Settings",
  },
];
