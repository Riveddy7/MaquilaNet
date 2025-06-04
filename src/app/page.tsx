'use client';

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldCheck, Network, Smartphone } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/contexts/auth-context";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function HomePage() {
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
        <p className="mt-4 text-foreground">Loading MaquilaNet Control...</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 max-w-screen-2xl items-center">
          <Link href="/" className="mr-6 flex items-center space-x-2">
            <Network className="h-6 w-6 text-primary" />
            <span className="font-bold sm:inline-block">MaquilaNet Control</span>
          </Link>
          <nav className="flex flex-1 items-center justify-end space-x-4">
            <Button variant="ghost" asChild>
              <Link href="/auth/login">Login</Link>
            </Button>
            <Button asChild className="bg-primary hover:bg-primary/90 text-primary-foreground">
              <Link href="/auth/signup">Sign Up</Link>
            </Button>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <section className="container grid items-center gap-6 pb-8 pt-6 md:py-10">
          <div className="flex max-w-[980px] flex-col items-start gap-2">
            <h1 className="text-3xl font-extrabold leading-tight tracking-tighter sm:text-3xl md:text-5xl lg:text-6xl font-headline">
              Smart IDF/MDF Management <br className="hidden sm:inline" />
              for Modern Manufacturing.
            </h1>
            <p className="max-w-[700px] text-lg text-muted-foreground sm:text-xl">
              Take control of your network infrastructure with MaquilaNet Control. Streamline inventory, manage ports, and conduct RFID-powered physical censuses with ease.
            </p>
          </div>
          <div className="flex gap-4">
            <Button asChild size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground">
              <Link href="/auth/signup">Get Started</Link>
            </Button>
            <Button variant="outline" size="lg" asChild>
              <Link href="#features">Learn More</Link>
            </Button>
          </div>
        </section>
        
        <section id="features" className="container space-y-6 bg-slate-50 dark:bg-slate-900 py-8 md:py-12 lg:py-24 rounded-lg shadow-sm">
          <div className="mx-auto flex max-w-[58rem] flex-col items-center space-y-4 text-center">
            <h2 className="font-bold text-3xl leading-[1.1] sm:text-3xl md:text-5xl font-headline">Features</h2>
            <p className="max-w-[85%] leading-normal text-muted-foreground sm:text-lg sm:leading-7">
              MaquilaNet Control offers a comprehensive suite of tools to manage your network assets efficiently.
            </p>
          </div>
          <div className="mx-auto grid justify-center gap-4 sm:grid-cols-2 md:max-w-[64rem] md:grid-cols-3">
            <Card className="shadow-lg hover:shadow-xl transition-shadow">
              <CardHeader className="items-center">
                <Network className="h-12 w-12 text-primary mb-2" />
                <CardTitle className="font-headline">Centralized Inventory</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">Manage all your network equipment (switches, routers, etc.) and their port configurations in one place.</p>
              </CardContent>
            </Card>
            <Card className="shadow-lg hover:shadow-xl transition-shadow">
              <CardHeader className="items-center">
                <Smartphone className="h-12 w-12 text-primary mb-2" />
                <CardTitle className="font-headline">RFID Census</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">Perform quick physical audits using RFID technology and instantly identify discrepancies with your digital inventory.</p>
              </CardContent>
            </Card>
            <Card className="shadow-lg hover:shadow-xl transition-shadow">
              <CardHeader className="items-center">
                <ShieldCheck className="h-12 w-12 text-primary mb-2" />
                <CardTitle className="font-headline">Secure & Scalable</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">Built on Firebase, ensuring robust security, multi-tenant capabilities, and scalability for your organization.</p>
              </CardContent>
            </Card>
          </div>
        </section>

        <section className="container py-8 md:py-12 lg:py-24">
          <div className="mx-auto flex max-w-[58rem] flex-col items-center text-center">
             <Image src="https://placehold.co/800x400.png" alt="Dashboard Preview" width={800} height={400} className="rounded-lg shadow-2xl mb-8" data-ai-hint="dashboard interface" />
            <h2 className="font-bold text-3xl leading-[1.1] sm:text-3xl md:text-5xl font-headline">Ready to Transform Your Network Management?</h2>
            <p className="max-w-[85%] leading-normal text-muted-foreground sm:text-lg sm:leading-7 mt-4 mb-8">
              Sign up today and experience the future of IDF/MDF control.
            </p>
            <Button asChild size="lg" className="bg-accent hover:bg-accent/90 text-accent-foreground">
              <Link href="/auth/signup">Register Your Maquiladora</Link>
            </Button>
          </div>
        </section>
      </main>

      <footer className="py-6 md:px-8 md:py-0 border-t border-border/40">
        <div className="container flex flex-col items-center justify-between gap-4 md:h-24 md:flex-row">
          <p className="text-balance text-center text-sm leading-loose text-muted-foreground md:text-left">
            © {new Date().getFullYear()} MaquilaNet Control. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
