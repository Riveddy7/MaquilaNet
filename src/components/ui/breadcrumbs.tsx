'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight, Home } from 'lucide-react';

export function Breadcrumbs() {
  const pathname = usePathname();
  const segments = pathname.split('/').filter(segment => segment);

  // Don't show breadcrumbs on the dashboard's root page or auth pages
  if (pathname === '/dashboard' || pathname.startsWith('/auth') || pathname === '/') {
    return null;
  }

  const breadcrumbItems = segments.map((segment, index) => {
    const href = '/' + segments.slice(0, index + 1).join('/');
    const isLast = index === segments.length - 1;
    
    // Capitalize segment and replace hyphens with spaces
    const label = segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, ' ');

    return (
      <li key={href} className="inline-flex items-center">
        <ChevronRight className="h-4 w-4 text-muted-foreground mx-1" />
        {isLast ? (
          <span className="font-medium text-foreground">{label}</span>
        ) : (
          <Link href={href} className="text-muted-foreground hover:text-primary transition-colors">
            {label}
          </Link>
        )}
      </li>
    );
  });

  return (
    <nav aria-label="Breadcrumb" className="hidden md:flex">
      <ol className="inline-flex items-center space-x-1 md:space-x-2 rtl:space-x-reverse">
        <li className="inline-flex items-center">
          <Link href="/dashboard" className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-primary">
            <Home className="w-4 h-4 me-1.5" />
            Dashboard
          </Link>
        </li>
        {breadcrumbItems}
      </ol>
    </nav>
  );
}
