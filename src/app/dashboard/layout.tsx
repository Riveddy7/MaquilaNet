'use client';

import { AppSidebar } from '@/components/layout/sidebar';
import { AppNavbar } from '@/components/layout/navbar';
import { useAuth } from '@/contexts/auth-context';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { ThemeProvider } from "next-themes";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading, userProfile } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/login');
    }
  }, [user, loading, router]);

  if (loading || !user || !userProfile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-primary"></div>
        <p className="mt-4 text-foreground">Loading Dashboard...</p>
      </div>
    );
  }

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <div className="flex min-h-screen w-full bg-muted/40">
        <AppSidebar />
        <div className="flex flex-col flex-1 sm:gap-4 sm:py-4 sm:pl-0 md:pl-[var(--sidebar-width-icon)] group-data-[collapsible=icon]:sm:pl-[var(--sidebar-width-icon)] group-data-[state=expanded]:sm:pl-[var(--sidebar-width)] transition-[padding-left] duration-200 ease-linear">
          <AppNavbar />
          <main className="flex-1 gap-4 p-4 sm:px-6 sm:py-0 md:gap-8 bg-background shadow-sm sm:rounded-tl-xl">
            {children}
          </main>
        </div>
      </div>
    </ThemeProvider>
  );
}
