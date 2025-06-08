
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  MapPin,
  Cpu,
  Network as NetworkIcon,
  FileText, // Changed from ScanLine
  Users,
  ChevronDown,
  Settings,
  HelpCircle,
} from 'lucide-react';
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarSeparator,
} from '@/components/ui/sidebar';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/contexts/auth-context';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useState } from 'react';
import { SheetTitle } from '../ui/sheet'; // For accessibility

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/dashboard/ubicaciones', label: 'Ubicaciones', icon: MapPin },
  { href: '/dashboard/equipos', label: 'Equipos', icon: Cpu },
  { href: '/dashboard/nodos', label: 'Nodos Finales', icon: NetworkIcon },
  { href: '/dashboard/planos-planta', label: 'Planos de Planta', icon: FileText }, // Updated item
  // { href: '/dashboard/usuarios', label: 'Usuarios', icon: Users }, 
];

export function AppSidebar() {
  const pathname = usePathname();
  const { userProfile, logout } = useAuth();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const getInitials = (name?: string | null) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  return (
    <Sidebar collapsible="icon" className="border-r">
      <SidebarHeader className="p-4">
         <SheetTitle className="sr-only">Menú Principal</SheetTitle> {/* Added for mobile accessibility */}
        <div className="flex items-center gap-3 group-data-[collapsible=icon]:justify-center">
           <Link href="/dashboard" className="flex items-center gap-2">
            <NetworkIcon className="h-8 w-8 text-sidebar-primary" />
            <span className="text-xl font-semibold text-sidebar-foreground group-data-[collapsible=icon]:hidden">MaquilaNet</span>
          </Link>
        </div>
      </SidebarHeader>

      <SidebarContent className="flex-grow p-2">
        <SidebarMenu>
          {navItems.map((item) => (
            <SidebarMenuItem key={item.href}>
              <Link href={item.href} passHref>
                <SidebarMenuButton
                  asChild
                  isActive={pathname.startsWith(item.href)}
                  tooltip={item.label}
                  className="justify-start"
                >
                  <a>
                    <item.icon className="h-5 w-5" />
                    <span>{item.label}</span>
                  </a>
                </SidebarMenuButton>
              </Link>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>

      <SidebarFooter className="p-2 mt-auto">
        <SidebarSeparator className="my-2" />
         <DropdownMenu open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="w-full justify-start group-data-[collapsible=icon]:justify-center p-2 h-auto">
              <div className="flex items-center gap-3 w-full">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={userProfile?.id /* Placeholder for actual image if available */} />
                  <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground">
                    {getInitials(userProfile?.displayName)}
                  </AvatarFallback>
                </Avatar>
                <div className="group-data-[collapsible=icon]:hidden text-left">
                  <p className="text-sm font-medium text-sidebar-foreground truncate">
                    {userProfile?.displayName || 'Usuario'}
                  </p>
                  <p className="text-xs text-sidebar-foreground/70 truncate">
                    {userProfile?.email}
                  </p>
                </div>
                 <ChevronDown className="ml-auto h-4 w-4 text-sidebar-foreground/70 group-data-[collapsible=icon]:hidden transition-transform duration-200 group-data-[state=open]:rotate-180" />
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" className="w-56 mb-1 ml-1 bg-popover text-popover-foreground group-data-[collapsible=icon]:ml-[40px] group-data-[collapsible=icon]:mb-[-30px]">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">{userProfile?.displayName}</p>
                <p className="text-xs leading-none text-muted-foreground">
                  {userProfile?.email}
                </p>
                 <p className="text-xs leading-none text-muted-foreground pt-1">
                  Org: {userProfile?.organizationId.substring(0,8)}... ({userProfile?.role})
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled> 
              <Settings className="mr-2 h-4 w-4" />
              <span>Settings</span>
            </DropdownMenuItem>
            <DropdownMenuItem disabled>
              <HelpCircle className="mr-2 h-4 w-4" />
              <span>Support</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={logout} className="text-destructive focus:bg-destructive/10 focus:text-destructive">
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
