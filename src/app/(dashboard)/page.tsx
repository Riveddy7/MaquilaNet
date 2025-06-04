'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Cpu, LayoutDashboard, MapPin, Network, ScanLine, Users, ArrowRight } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/contexts/auth-context";
import Image from "next/image";

export default function DashboardPage() {
  const { userProfile } = useAuth();

  return (
    <div className="flex flex-col min-h-full">
      <header className="py-6">
        <h1 className="text-3xl font-bold tracking-tight text-foreground font-headline">
          Welcome, {userProfile?.displayName || 'User'}!
        </h1>
        <p className="text-muted-foreground">
          Here&apos;s an overview of your MaquilaNet Control dashboard.
        </p>
      </header>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-8">
        <Card className="shadow-md hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium font-headline">Total Ubicaciones</CardTitle>
            <MapPin className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">N/A</div>
            <p className="text-xs text-muted-foreground">
              Manage physical locations like IDFs, MDFs, and Racks.
            </p>
            <Button variant="outline" size="sm" className="mt-4" asChild>
              <Link href="/dashboard/ubicaciones">Go to Ubicaciones <ArrowRight className="ml-2 h-4 w-4" /></Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="shadow-md hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium font-headline">Total Equipos</CardTitle>
            <Cpu className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">N/A</div>
            <p className="text-xs text-muted-foreground">
              Track switches, routers, servers, and other network gear.
            </p>
             <Button variant="outline" size="sm" className="mt-4" asChild>
              <Link href="/dashboard/equipos">Go to Equipos <ArrowRight className="ml-2 h-4 w-4" /></Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="shadow-md hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium font-headline">Nodos Finales</CardTitle>
            <Network className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">N/A</div>
            <p className="text-xs text-muted-foreground">
              Manage end-user devices connected to your network.
            </p>
             <Button variant="outline" size="sm" className="mt-4" asChild>
              <Link href="/dashboard/nodos">Go to Nodos <ArrowRight className="ml-2 h-4 w-4" /></Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-1">
         <Card className="shadow-md hover:shadow-lg transition-shadow col-span-1 lg:col-span-2">
          <CardHeader>
            <div className="flex items-center gap-2">
              <ScanLine className="h-6 w-6 text-primary" />
              <CardTitle className="font-headline">Inventario RFID</CardTitle>
            </div>
            <CardDescription>
              Conduct physical censuses of your equipment using RFID technology.
              Identify discrepancies and keep your inventory accurate.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-start gap-4 md:flex-row md:items-center">
            <Image src="https://placehold.co/300x200.png" alt="RFID Scanner" width={300} height={200} className="rounded-lg object-cover" data-ai-hint="RFID scanner inventory" />
            <div className="flex-1">
              <p className="mb-4 text-sm text-muted-foreground">
                Streamline your asset tracking by initiating RFID scans for selected IDF/MDF locations.
                The system will compare scanned tags against the registered inventory, highlighting any missing
                equipment or newly discovered (unregistered) tags.
              </p>
              <Button className="bg-accent hover:bg-accent/90 text-accent-foreground" asChild>
                <Link href="/dashboard/inventario-rfid">Iniciar Nuevo Censo RFID <ArrowRight className="ml-2 h-4 w-4" /></Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Placeholder for potential charts or activity feeds */}
      <div className="mt-8">
        {/* <h2 className="text-xl font-semibold mb-4 font-headline">Recent Activity</h2> */}
        {/* <Card> <CardContent><p className="p-6 text-muted-foreground">Activity feed coming soon.</p></CardContent> </Card> */}
      </div>

    </div>
  );
}
