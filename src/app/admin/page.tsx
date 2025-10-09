'use client';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Users, BrainCircuit, BarChart3, Clock, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useEffect, useState } from "react";
import { collection, getDocs, limit, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { formatDistanceToNow } from 'date-fns';
import { getKnowledgeDocuments, type KnowledgeDocument } from "@/ai/flows/admin-uploads-pdf-knowledge-base";
import { getCountFromServer } from "firebase/firestore";


type DashboardStats = {
  totalUsers: number;
  knowledgeBaseDocs: number;
  avgLogins: number;
  lastLogin: string | null;
  recentUser: { name: string; email: string; createdAt: string } | null;
  lastKnowledgeUpdate: string | null;
};

function StatCard({ title, value, icon: Icon, description }: { title: string, value: string | number, icon: React.ElementType, description: string }) {
    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{title}</CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">{value}</div>
                <p className="text-xs text-muted-foreground">{description}</p>
            </CardContent>
        </Card>
    );
}

export default function AdminDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        //gets all users as once
        //calculates everything from a single snapshot instead of 3 queries

        const usersSnapshot = await getDocs(collection(db, "users")); //gets users from firebase
        const users = usersSnapshot.docs.map((d) => d.data());

        const totalUsers = users.length; 

        const totalLogins = users.reduce((acc, u) => acc + (u.loginCount || 0), 0);

        const avgLogins = totalUsers > 0 ? parseFloat((totalLogins / totalUsers).toFixed(1)) :0;

        //gets most recent user client side
        const recentUserData = [...users].sort(
        (a, b) => b.createdAt?.toMillis() - a.createdAt?.toMillis())[0];
        const recentUser = recentUserData ? {
            name: recentUserData.name,
            email: recentUserData.email,
            createdAt: formatDistanceToNow(
            recentUserData.createdAt.toDate(),
            {addSuffix: true}
            ),
          }
        : null;
        //gets last login client side
        const lastLoginUser = [...users].sort(
            (a, b) => b.lastLogin?.toMillis() - a.lastLogin?.toMillis()
        )[0];
        const lastLogin = lastLoginUser?.lastLogin
            ? formatDistanceToNow(lastLoginUser.lastLogin.toDate(), {
            addSuffix: true,
          })
        : null;

        //database querying not longer gathers all documents at once - used a lot of bandwidth
        //just gets most recent uploaded doc
        const kbQuery = query(
            collection(db, "knowledge_base"),
            orderBy("uploadedAt", "desc"),
            limit(1)
            );
            const kbSnapshot = await getDocs(kbQuery);

        // gets only the total count using Firestore aggregation (lightweight)
        const countSnapshot = await getCountFromServer(collection(db, "knowledge_base"));
        const knowledgeBaseDocs = countSnapshot.data().count;

        let lastKnowledgeUpdate: string | null = null;
        if (!kbSnapshot.empty) {
        const mostRecentDoc = kbSnapshot.docs[0].data();
        if (mostRecentDoc.uploadedAt) {
            lastKnowledgeUpdate = formatDistanceToNow(
            mostRecentDoc.uploadedAt.toDate(),
            { addSuffix: true }
            );
        }
    }

        
        setStats({ totalUsers, knowledgeBaseDocs, avgLogins, lastLogin, recentUser, lastKnowledgeUpdate });
      } catch (error) {
        console.error("Error fetching dashboard stats:", error);
      } finally {
        setIsLoading(false);
      }
    }
    fetchStats();
  }, []);

  return (
    <div className="flex flex-col gap-8">
        <div>
            <h1 className="text-3xl font-bold tracking-tight font-headline">Welcome, {user?.name}!</h1>
            <p className="text-muted-foreground">Here&apos;s a quick overview of your M-Health platform.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {isLoading ? (
                <>
                    {[...Array(4)].map((_, i) => (
                      <Card key={i}><CardHeader className="pb-2"></CardHeader><CardContent><Loader2 className="h-8 w-8 animate-spin text-primary" /></CardContent></Card>
                    ))}
                </>
            ) : (
                <>
                    <StatCard title="Total Users" value={stats?.totalUsers ?? 0} icon={Users} description="All registered users" />
                    <StatCard title="Knowledge Base" value={`${stats?.knowledgeBaseDocs ?? 0} Docs`} icon={BrainCircuit} description="Documents powering the chatbot" />
                    <StatCard title="Avg. Logins" value={stats?.avgLogins ?? 0} icon={BarChart3} description="Average logins per user" />
                    <StatCard title="Last Active" value={stats?.lastLogin ?? 'N/A'} icon={Clock} description="Most recent user login" />
                </>
            )}
        </div>

        <Card>
            <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
                <CardDescription>A log of recent user activities and system events.</CardDescription>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <div className="flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
                ) : (
                <div className="space-y-4">
                    {stats?.recentUser ? (
                        <div className="flex items-center gap-4">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/50">
                                <Users className="h-4 w-4 text-green-600 dark:text-green-400"/>
                            </div>
                            <p className="text-sm text-muted-foreground">New user registered: <span className="font-medium text-foreground">{stats.recentUser.name}</span></p>
                            <p className="ml-auto text-xs text-muted-foreground">{stats.recentUser.createdAt}</p>
                        </div>
                    ) : (
                         <p className="text-sm text-muted-foreground">No new user registrations yet.</p>
                    )}
                    {stats?.lastKnowledgeUpdate ? (
                     <div className="flex items-center gap-4">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/50">
                            <BrainCircuit className="h-4 w-4 text-blue-600 dark:text-blue-400"/>
                        </div>
                        <p className="text-sm text-muted-foreground">Knowledge base updated.</p>
                        <p className="ml-auto text-xs text-muted-foreground">{stats.lastKnowledgeUpdate}</p>
                    </div>
                    ) : (
                        <p className="text-sm text-muted-foreground">No knowledge base updates yet.</p>
                    )}
                </div>
                )}
            </CardContent>
        </Card>
    </div>
  );
}
