'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Cpu, LayoutDashboard, MapPin, Network, Users, ArrowRight, Building, Construction } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/contexts/auth-context";
import Image from "next/image";
import { useEffect, useState } from "react";
import { collection, query, where, getCountFromServer, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase/client";

interface Counts {
  plantas: number;
  idfsMdFs: number;
  equipos: number;
  nodos: number;
}

export default function DashboardPage() {
  const { userProfile } = useAuth();
  const [counts, setCounts] = useState<Counts>({ plantas: 0, idfsMdFs: 0, equipos: 0, nodos: 0 });
  const [loadingCounts, setLoadingCounts] = useState(true);

  useEffect(() => {
    if (!userProfile?.organizationId) return;

    const fetchCounts = async () => {
      setLoadingCounts(true);
      try {
        const plantasQuery = query(collection(db, 'ubicaciones'), where('organizationId', '==', userProfile.organizationId), where('tipo', '==', 'Planta'));
        const idfMdfQuery = query(collection(db, 'ubicaciones'), where('organizationId', '==', userProfile.organizationId), where('tipo', 'in', ['IDF', 'MDF']));
        const equiposQuery = query(collection(db, 'equipos'), where('organizationId', '==', userProfile.organizationId));
        const nodosQuery = query(collection(db, 'nodos'), where('organizationId', '==', userProfile.organizationId));

        const [plantasSnap, idfMdfSnap, equiposSnap, nodosSnap] = await Promise.all([
          getCountFromServer(plantasQuery),
          getCountFromServer(idfMdfQuery),
          getCountFromServer(equiposQuery),
          getCountFromServer(nodosQuery),
        ]);

        setCounts({
          plantas: plantasSnap.data().count,
          idfsMdFs: idfMdfSnap.data().count,
          equipos: equiposSnap.data().count,
          nodos: nodosSnap.data().count,
        });
      } catch (error) {
        console.error("Error fetching counts:", error);
        // Optionally set counts to N/A or error state
      }
      setLoadingCounts(false);
    };

    fetchCounts();

    // Setup listeners for real-time updates (optional, can be heavy)
    const unsubPlantas = onSnapshot(query(collection(db, 'ubicaciones'), where('organizationId', '==', userProfile.organizationId), where('tipo', '==', 'Planta')), (snap) => {
      setCounts(prev => ({ ...prev, plantas: snap.size }));
    });
    const unsubIdfMdf = onSnapshot(query(collection(db, 'ubicaciones'), where('organizationId', '==', userProfile.organizationId), where('tipo', 'in', ['IDF', 'MDF'])), (snap) => {
      setCounts(prev => ({ ...prev, idfsMdFs: snap.size }));
    });
    const unsubEquipos = onSnapshot(query(collection(db, 'equipos'), where('organizationId', '==', userProfile.organizationId)), (snap) => {
      setCounts(prev => ({ ...prev, equipos: snap.size }));
    });
    const unsubNodos = onSnapshot(query(collection(db, 'nodos'), where('organizationId', '==', userProfile.organizationId)), (snap) => {
      setCounts(prev => ({ ...prev, nodos: snap.size }));
    });

    return () => {
      unsubPlantas();
      unsubIdfMdf();
      unsubEquipos();
      unsubNodos();
    };

  }, [userProfile?.organizationId]);

  const displayCount = (count: number) => loadingCounts ? "..." : count;

  return (
    <div className="flex flex-col min-h-full">
      <header className="py-6">
        <h1 className="text-3xl font-bold tracking-tight text-foreground font-headline">
          Bienvenido, {userProfile?.displayName || 'Usuario'}!
        </h1>
        <p className="text-muted-foreground">
          Resumen general de tu sistema MaquilaNet Control.
        </p>
      </header>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
        <Card className="shadow-md hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium font-headline">Total Plantas</CardTitle>
            <Building className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{displayCount(counts.plantas)}</div>
            <p className="text-xs text-muted-foreground">
              Administra tus plantas de producción.
            </p>
            <Button variant="outline" size="sm" className="mt-4" asChild>
              <Link href="/dashboard/ubicaciones">Ver Plantas <ArrowRight className="ml-2 h-4 w-4" /></Link>
            </Button>
          </CardContent>
        </Card>
        
        <Card className="shadow-md hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium font-headline">Total IDF/MDF</CardTitle>
            <MapPin className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{displayCount(counts.idfsMdFs)}</div>
            <p className="text-xs text-muted-foreground">
              Cuartos de telecomunicaciones en tus plantas.
            </p>
             <Button variant="outline" size="sm" className="mt-4" asChild>
              <Link href="/dashboard/ubicaciones">Ver IDF/MDFs <ArrowRight className="ml-2 h-4 w-4" /></Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="shadow-md hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium font-headline">Total Equipos</CardTitle>
            <Cpu className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{displayCount(counts.equipos)}</div>
            <p className="text-xs text-muted-foreground">
              Switches, routers, y más, en tus IDF/MDFs.
            </p>
             <Button variant="outline" size="sm" className="mt-4" asChild>
              <Link href="/dashboard/equipos">Ver Equipos <ArrowRight className="ml-2 h-4 w-4" /></Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="shadow-md hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium font-headline">Nodos Finales</CardTitle>
            <Network className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{displayCount(counts.nodos)}</div>
            <p className="text-xs text-muted-foreground">
              PCs, impresoras y otros dispositivos conectados.
            </p>
             <Button variant="outline" size="sm" className="mt-4" asChild>
              <Link href="/dashboard/nodos">Ver Nodos <ArrowRight className="ml-2 h-4 w-4" /></Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-1">
         <Card className="shadow-md hover:shadow-lg transition-shadow col-span-1 lg:col-span-2">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Construction className="h-6 w-6 text-primary" />
              <CardTitle className="font-headline">Planos de Planta</CardTitle>
            </div>
            <CardDescription>
              Carga los planos de tus plantas, marca la ubicación de IDFs/MDFs y activa escaneos.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-start gap-4 md:flex-row md:items-center">
            <Image src="https://placehold.co/300x200.png" alt="Planos de Planta" width={300} height={200} className="rounded-lg object-cover" data-ai-hint="floor plan blueprint" />
            <div className="flex-1">
              <p className="mb-4 text-sm text-muted-foreground">
                Visualiza tus IDFs y MDFs directamente sobre los planos de tus instalaciones.
                Inicia procesos de escaneo para validar tu inventario físico contra el digital.
              </p>
              <Button className="bg-accent hover:bg-accent/90 text-accent-foreground" asChild>
                <Link href="/dashboard/planos-planta">Gestionar Planos <ArrowRight className="ml-2 h-4 w-4" /></Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
      
    </div>
  );
}
