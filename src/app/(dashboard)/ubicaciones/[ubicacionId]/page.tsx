'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import type { Ubicacion } from '@/types';
import { useAuth } from '@/contexts/auth-context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Cpu, Edit, MapPin, Layers } from 'lucide-react';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';

// Placeholder for UbicacionForm if editing is done on this page directly
// import { UbicacionForm } from '../components/location-form'; 
// import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';


export default function UbicacionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const ubicacionId = params.ubicacionId as string;
  const [ubicacion, setUbicacion] = useState<Ubicacion | null>(null);
  const [parentUbicacion, setParentUbicacion] = useState<Ubicacion | null>(null);
  const [loading, setLoading] = useState(true);
  const { userProfile } = useAuth();
  const { toast } = useToast();
  // const [isFormOpen, setIsFormOpen] = useState(false); // For editing modal

  useEffect(() => {
    if (!userProfile?.organizationId || !ubicacionId) return;

    setLoading(true);
    const docRef = doc(db, 'ubicaciones', ubicacionId);
    
    const unsubscribe = onSnapshot(docRef, async (docSnap) => {
      if (docSnap.exists() && docSnap.data().organizationId === userProfile.organizationId) {
        const data = { id: docSnap.id, ...docSnap.data() } as Ubicacion;
        setUbicacion(data);
        if (data.parentId) {
          const parentDocRef = doc(db, 'ubicaciones', data.parentId);
          const parentDocSnap = await getDoc(parentDocRef);
          if (parentDocSnap.exists()) {
            setParentUbicacion({ id: parentDocSnap.id, ...parentDocSnap.data() } as Ubicacion);
          } else {
            setParentUbicacion(null);
          }
        } else {
          setParentUbicacion(null);
        }
      } else {
        toast({ title: "Error", description: "Ubicación no encontrada o no tienes acceso.", variant: "destructive" });
        router.push('/dashboard/ubicaciones');
      }
      setLoading(false);
    }, (error) => {
      console.error("Error fetching ubicacion:", error);
      toast({ title: "Error", description: "No se pudo cargar la ubicación.", variant: "destructive"});
      setLoading(false);
      router.push('/dashboard/ubicaciones');
    });

    return () => unsubscribe();

  }, [ubicacionId, userProfile?.organizationId, router, toast]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[calc(100vh-theme(spacing.24))]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!ubicacion) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-theme(spacing.24))]">
        <MapPin className="w-16 h-16 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold text-foreground">Ubicación no encontrada</h2>
        <p className="text-muted-foreground">La ubicación que buscas no existe o ha sido eliminada.</p>
        <Button variant="outline" className="mt-4" asChild>
          <Link href="/dashboard/ubicaciones">
            <ArrowLeft className="mr-2 h-4 w-4" /> Volver a Ubicaciones
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <Button variant="outline" size="sm" className="mb-6" onClick={() => router.back()}>
        <ArrowLeft className="mr-2 h-4 w-4" /> Volver
      </Button>

      <Card className="shadow-lg">
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <div className="flex items-center gap-2">
                <MapPin className="h-8 w-8 text-primary" />
                <CardTitle className="text-3xl font-bold font-headline">{ubicacion.nombre}</CardTitle>
              </div>
              <CardDescription className="mt-1">
                Detalles de la ubicación y opciones de gestión.
              </CardDescription>
            </div>
            {/* 
            <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Edit className="mr-2 h-4 w-4" /> Editar Ubicación
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[525px]">
                <DialogHeader>
                  <DialogTitle className="font-headline">Editar Ubicación</DialogTitle>
                </DialogHeader>
                <UbicacionForm
                  ubicacion={ubicacion}
                  allUbicaciones={[]} // Needs to fetch all ubicaciones for parent selection
                  onSuccess={() => setIsFormOpen(false)}
                />
              </DialogContent>
            </Dialog>
            */}
          </div>
        </CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-2">
          <div>
            <h3 className="text-lg font-semibold mb-2 text-foreground font-headline">Información General</h3>
            <div className="space-y-2 text-sm">
              <p><strong>ID:</strong> <Badge variant="secondary" className="font-mono">{ubicacion.id}</Badge></p>
              <p><strong>Tipo:</strong> <Badge>{ubicacion.tipo}</Badge></p>
              {parentUbicacion && (
                <p><strong>Principal:</strong> 
                  <Link href={`/dashboard/ubicaciones/${parentUbicacion.id}`} className="text-primary hover:underline ml-1">
                    {parentUbicacion.nombre}
                  </Link>
                  <Badge variant="outline" className="ml-2">{parentUbicacion.tipo}</Badge>
                </p>
              )}
              {!parentUbicacion && ubicacion.parentId && (
                 <p><strong>Principal ID:</strong> <span className="text-muted-foreground">{ubicacion.parentId} (No encontrado)</span></p>
              )}
               <p><strong>Creado:</strong> {ubicacion.createdAt ? format(ubicacion.createdAt.toDate(), 'dd/MM/yyyy HH:mm:ss') : 'N/A'}</p>
              <p><strong>Actualizado:</strong> {ubicacion.updatedAt ? format(ubicacion.updatedAt.toDate(), 'dd/MM/yyyy HH:mm:ss') : 'N/A'}</p>
            </div>
          </div>
          
          <div className="space-y-4">
            <Card className="bg-secondary/50">
              <CardHeader>
                <CardTitle className="text-xl flex items-center font-headline">
                  <Cpu className="mr-2 h-5 w-5 text-accent" /> Equipos
                </CardTitle>
                <CardDescription>
                  Gestiona los equipos de red instalados en esta ubicación.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild className="w-full md:w-auto bg-accent hover:bg-accent/90 text-accent-foreground">
                  <Link href={`/dashboard/ubicaciones/${ubicacion.id}/equipos`}>
                    Ver Equipos en {ubicacion.nombre}
                  </Link>
                </Button>
              </CardContent>
            </Card>

             {/* Placeholder for sub-locations if any */}
            {/* <Card className="bg-secondary/50">
              <CardHeader>
                <CardTitle className="text-xl flex items-center font-headline">
                  <Layers className="mr-2 h-5 w-5 text-muted-foreground" /> Sub-Ubicaciones
                </CardTitle>
                 <CardDescription>
                  Ubicaciones contenidas dentro de {ubicacion.nombre}.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">Funcionalidad de sub-ubicaciones próximamente.</p>
              </CardContent>
            </Card> */}

          </div>
        </CardContent>
      </Card>
    </div>
  );
}
