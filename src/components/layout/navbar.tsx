'use client';

import Link from 'next/link';
import {
  PanelLeft,
  Search,
  Settings,
  UserCircle,
  LogOut,
  Moon,
  Sun,
  Network,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { AppSidebar } from './sidebar'; // For mobile view
import { useAuth } from '@/contexts/auth-context';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useTheme } from "next-themes"; // Assuming next-themes is or will be installed
import { useEffect, useState } from 'react';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';


export function AppNavbar() {
  const { userProfile, logout } = useAuth();
  const { setTheme, theme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const getInitials = (name?: string | null) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6">
      <Sheet>
        <SheetTrigger asChild>
          <Button size="icon" variant="outline" className="sm:hidden">
            <PanelLeft className="h-5 w-5" />
            <span className="sr-only">Toggle Menu</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="sm:max-w-xs p-0">
          {/* Using the same sidebar component for mobile consistency */}
          <AppSidebar />
        </SheetContent>
      </Sheet>
      
      <Breadcrumbs />

      <div className="relative ml-auto flex-1 md:grow-0">
        {/* Search input can be added later if needed 
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Search..."
          className="w-full rounded-lg bg-secondary pl-8 md:w-[200px] lg:w-[320px]"
        />
        */}
      </div>

      {mounted && (
         <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === "light" ? "dark" : "light")}
            className="ml-2"
          >
            {theme === "light" ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
            <span className="sr-only">Toggle theme</span>
          </Button>
      )}
     

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            className="overflow-hidden rounded-full"
          >
            <Avatar className="h-8 w-8">
              <AvatarImage src={userProfile?.id /* Placeholder */} data-ai-hint="user avatar" />
              <AvatarFallback className="bg-primary text-primary-foreground">
                {getInitials(userProfile?.displayName)}
              </AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>{userProfile?.displayName || 'User Profile'}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem disabled>
            <Settings className="mr-2 h-4 w-4" />
            Settings
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={logout} className="text-destructive focus:text-destructive focus:bg-destructive/10">
            <LogOut className="mr-2 h-4 w-4" />
            Logout
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}

// Add next-themes if not already present: npm install next-themes
// Update src/app/layout.tsx to wrap children with ThemeProvider from next-themes
// Example for layout.tsx:
// import { ThemeProvider } from "next-themes"
// <ThemeProvider attribute="class" defaultTheme="system" enableSystem> {children} </ThemeProvider>
