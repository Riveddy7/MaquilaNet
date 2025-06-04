'use client';
import { useAuth } from '@/contexts/auth-context';
import { Network } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  if (loading || (!loading && user)) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-6 bg-background">
        <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-primary"></div>
         <p className="mt-4 text-foreground">Loading...</p>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-background to-secondary p-4 sm:p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center space-x-2 text-primary hover:opacity-80 transition-opacity">
            <Network className="h-10 w-10" />
            <span className="text-3xl font-bold font-headline text-foreground">MaquilaNet Control</span>
          </Link>
        </div>
        <div className="bg-card p-6 sm:p-8 rounded-xl shadow-2xl">
          {children}
        </div>
        <p className="mt-8 text-center text-sm text-muted-foreground">
           © {new Date().getFullYear()} MaquilaNet Control. All rights reserved.
        </p>
      </div>
    </div>
  );
}
