'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import NextLink from 'next/link'; // Corrected import and kept alias for clarity
import { doc, onSnapshot, collection, query, orderBy, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import type { Equipo, Puerto, Ubicacion } from '@/types';
import { useAuth } from '@/contexts/auth-context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Cpu, Edit, HardDrive, LinkIcon, MapPin, Package, Tag, Wifi } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { PortList } from './components/port-list'; 
import { format } from 'date-fns';
// For editing the equipment itself
// import { EquipoForm } from '../components/equipment-form'; 
// import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';


export default function EquipoDetailPage() {
  const params = useParams();
  const router = useRouter();
  const ubicacionId = params.ubicacionId as string;
  const equipoId = params.equipoId as string;

  const [equipo, setEquipo] = useState<Equipo | null>(null);
  const [ubicacion, setUbicacion] = useState<Ubicacion | null>(null);
  const [loading, setLoading] = useState(true);
  const { userProfile } = useAuth();
  const { toast } = useToast();
  // const [isFormOpen, setIsFormOpen] = useState(false); // For editing modal

  useEffect(() => {
    if (!userProfile?.organizationId || !equipoId || !ubicacionId) return;

    setLoading(true);
    // Fetch ubicacion details (optional, but good for context)
    const ubicacionDocRef = doc(db, 'ubicaciones', ubicacionId);
    const unsubUbicacion = onSnapshot(ubicacionDocRef, (docSnap) => {
      if (docSnap.exists() && docSnap.data().organizationId === userProfile.organizationId) {
        setUbicacion({ id: docSnap.id, ...docSnap.data() } as Ubicacion);
      }
    });
    
    // Fetch equipo details
    const equipoDocRef = doc(db, 'equipos', equipoId);
    const unsubscribeEquipo = onSnapshot(equipoDocRef, (docSnap) => {
      if (docSnap.exists() && docSnap.data().organizationId === userProfile.organizationId && docSnap.data().ubicacionId === ubicacionId) {
        setEquipo({ id: docSnap.id, ...docSnap.data() } as Equipo);
      } else {
        toast({ title: "Error", description: "Equipo no encontrado o no tienes acceso.", variant: "destructive" });
        router.push(`/dashboard/ubicaciones/${ubicacionId}/equipos`);
      }
      setLoading(false);
    }, (error) => {
      console.error("Error fetching equipo:", error);
      toast({ title: "Error", description: "No se pudo cargar el equipo.", variant: "destructive"});
      setLoading(false);
      router.push(`/dashboard/ubicaciones/${ubicacionId}/equipos`);
    });

    return () => {
      unsubUbicacion();
      unsubscribeEquipo();
    };

  }, [equipoId, ubicacionId, userProfile?.organizationId, router, toast]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[calc(100vh-theme(spacing.24))]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!equipo) {
     return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-theme(spacing.24))]">
        <Cpu className="w-16 h-16 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold text-foreground">Equipo no encontrado</h2>
        <p className="text-muted-foreground">El equipo que buscas no existe o ha sido eliminado.</p>
        <Button variant="outline" className="mt-4" asChild>
          <NextLink href={`/dashboard/ubicaciones/${ubicacionId}/equipos`}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Volver a Equipos
          </NextLink>
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
       <Button variant="outline" size="sm" className="mb-6" asChild>
        <NextLink href={`/dashboard/ubicaciones/${ubicacionId}/equipos`}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Volver a Equipos en {ubicacion?.nombre || 'Ubicación'}
        </NextLink>
      </Button>

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <Card className="shadow-lg">
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-2">
                    <Cpu className="h-8 w-8 text-primary" />
                    <CardTitle className="text-2xl font-bold font-headline">{equipo.nombre}</CardTitle>
                  </div>
                  <CardDescription className="mt-1">
                    <Badge variant="secondary">{equipo.tipo}</Badge> en <NextLink href={`/dashboard/ubicaciones/${ubicacionId}`} className="text-primary hover:underline">{ubicacion?.nombre || ubicacionId}</NextLink>
                  </CardDescription>
                </div>
                 {/* 
                <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Edit className="mr-2 h-4 w-4" /> Editar
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-2xl">
                    <DialogHeader>
                      <DialogTitle className="font-headline">Editar Equipo</DialogTitle>
                    </DialogHeader>
                    <EquipoForm
                      ubicacionId={ubicacionId}
                      equipo={equipo}
                      onSuccess={() => setIsFormOpen(false)}
                    />
                  </DialogContent>
                </Dialog>
                */}
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p><strong>Marca:</strong> {equipo.marca || 'N/A'}</p>
              <p><strong>Modelo:</strong> {equipo.modelo || 'N/A'}</p>
              <p><strong>S/N:</strong> {equipo.serialNumber || 'N/A'}</p>
              <p><strong>Asset Tag:</strong> {equipo.assetTag || 'N/A'}</p>
              <p><strong>IP Gestión:</strong> {equipo.ipGestion || 'N/A'}</p>
              <p><strong>Tag RFID:</strong> {equipo.rfidTagId ? <Badge variant="outline"><Wifi className="w-3 h-3 mr-1"/>{equipo.rfidTagId}</Badge> : 'N/A'}</p>
              <p><strong>Posición Rack (U):</strong> {equipo.rackPositionU || 'N/A'}</p>
              <p><strong>Estado:</strong> <Badge variant={equipo.estado === 'Activo' ? 'default' : equipo.estado === 'Inactivo' ? 'destructive' : 'secondary'} className={equipo.estado === 'Activo' ? 'bg-green-500 text-white' : ''}>{equipo.estado}</Badge></p>
              <p><strong>Total Puertos:</strong> {equipo.numeroDePuertos}</p>
              <p className="text-xs text-muted-foreground pt-2">
                Creado: {equipo.createdAt ? format(equipo.createdAt.toDate(), 'dd/MM/yyyy HH:mm') : 'N/A'} <br/>
                Actualizado: {equipo.updatedAt ? format(equipo.updatedAt.toDate(), 'dd/MM/yyyy HH:mm') : 'N/A'}
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2">
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="text-xl font-semibold flex items-center font-headline">
                <LinkIcon className="mr-2 h-5 w-5 text-primary"/> Gestión de Puertos ({equipo.numeroDePuertos} disponibles)
              </CardTitle>
              <CardDescription>
                Visualiza y administra el estado y conexiones de cada puerto del equipo.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <PortList equipoId={equipo.id} numeroDePuertos={equipo.numeroDePuertos} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
