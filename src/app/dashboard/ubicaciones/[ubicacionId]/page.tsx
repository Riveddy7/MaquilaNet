'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, getDoc, onSnapshot, collection, query, where, getCountFromServer } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import type { Ubicacion, Equipo } from '@/types';
import { useAuth } from '@/contexts/auth-context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Cpu, Edit, MapPin, Layers, Building, PlusCircle } from 'lucide-react';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { UbicacionForm } from '../components/location-form'; 
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface UbicacionConConteos extends Ubicacion {
  equiposCount?: number;
  nodosCount?: number;
}

export default function UbicacionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const ubicacionId = params.ubicacionId as string; // Could be Planta ID or IDF/MDF ID
  const [ubicacion, setUbicacion] = useState<Ubicacion | null>(null);
  const [parentUbicacion, setParentUbicacion] = useState<Ubicacion | null>(null); // For IDF/MDF, this is the Planta
  const [childUbicaciones, setChildUbicaciones] = useState<UbicacionConConteos[]>([]); // For Planta, these are IDF/MDFs
  const [allUbicacionesForForm, setAllUbicacionesForForm] = useState<Ubicacion[]>([]);
  const [loading, setLoading] = useState(true);
  const { userProfile } = useAuth();
  const { toast } = useToast();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingUbicacion, setEditingUbicacion] = useState<Ubicacion | null>(null);


  useEffect(() => {
    if (!userProfile?.organizationId || !ubicacionId) return;

    setLoading(true);
    const docRef = doc(db, 'ubicaciones', ubicacionId);
    
    const unsubscribe = onSnapshot(docRef, async (docSnap) => {
      if (docSnap.exists() && docSnap.data().organizationId === userProfile.organizationId) {
        const data = { id: docSnap.id, ...docSnap.data() } as Ubicacion;
        setUbicacion(data);
        setEditingUbicacion(data); // For editing form

        if (data.tipo === 'Planta') {
          // Fetch child IDF/MDFs for this Planta
          const childQuery = query(
            collection(db, 'ubicaciones'), 
            where('organizationId', '==', userProfile.organizationId),
            where('parentId', '==', ubicacionId),
            where('tipo', 'in', ['IDF', 'MDF'])
          );
          const unsubChildren = onSnapshot(childQuery, async (childrenSnapshot) => {
            const childrenDataPromises = childrenSnapshot.docs.map(async (childDoc) => {
              const childUbicacion = { id: childDoc.id, ...childDoc.data() } as UbicacionConConteos;
              // Count equipos for this IDF/MDF
              const equiposQuery = query(collection(db, 'equipos'), where('ubicacionId', '==', childDoc.id));
              const equiposSnap = await getDocs(equiposQuery);
              childUbicacion.equiposCount = equiposSnap.size;
              
              let nodosCount = 0;
              for (const equipoDoc of equiposSnap.docs) {
                  const puertosQuery = query(collection(db, 'puertos'), where('equipoId', '==', equipoDoc.id), where('estado', '==', 'Ocupado'), where('nodoId', '!=', null));
                  const nodosSnap = await getCountFromServer(puertosQuery);
                  nodosCount += nodosSnap.data().count;
              }
              childUbicacion.nodosCount = nodosCount;
              return childUbicacion;
            });
            const resolvedChildrenData = await Promise.all(childrenDataPromises);
            setChildUbicaciones(resolvedChildrenData);
          });
          // Consider how to manage unsubChildren if parent listener re-runs
        } else if (data.parentId) { // IDF or MDF, fetch its parent Planta
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
    
    // Fetch all ubicaciones (Plantas only) for the parent selection in the form
    const allPlantasQuery = query(collection(db, 'ubicaciones'), where('organizationId', '==', userProfile.organizationId), where('tipo', '==', 'Planta'));
    const unsubAllUbicaciones = onSnapshot(allPlantasQuery, (snapshot) => {
        setAllUbicacionesForForm(snapshot.docs.map(doc => ({id: doc.id, ...doc.data()} as Ubicacion)));
    });


    return () => {
      unsubscribe();
      unsubAllUbicaciones();
      // also unsubscribe children if necessary
    };

  }, [ubicacionId, userProfile?.organizationId, router, toast]);

  const handleEditUbicacion = (ubicacionToEdit: Ubicacion | null) => {
    setEditingUbicacion(ubicacionToEdit); // Could be the current ubicacion, or a child IDF/MDF for creation
    setIsFormOpen(true);
  }

  const handleAddNewIDFOrMDF = () => {
    if (ubicacion?.tipo === 'Planta') {
      // Pre-fill parentId for new IDF/MDF
      setEditingUbicacion({ parentId: ubicacion.id, tipo: 'IDF' } as unknown as Ubicacion); 
      setIsFormOpen(true);
    }
  };


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
            <ArrowLeft className="mr-2 h-4 w-4" /> Volver a Lista de Plantas
          </Link>
        </Button>
      </div>
    );
  }

  const Icon = ubicacion.tipo === 'Planta' ? Building : MapPin;

  return (
    <div className="container mx-auto py-8">
      <Button variant="outline" size="sm" className="mb-6" asChild>
        <Link href={parentUbicacion ? `/dashboard/ubicaciones/${parentUbicacion.id}` : "/dashboard/ubicaciones"}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Volver a {parentUbicacion ? parentUbicacion.nombre : 'Plantas'}
        </Link>
      </Button>

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <Card className="shadow-lg">
          <CardHeader>
            <div className="flex justify-between items-start">
              <div>
                <div className="flex items-center gap-2">
                  <Icon className="h-8 w-8 text-primary" />
                  <CardTitle className="text-3xl font-bold font-headline">{ubicacion.nombre}</CardTitle>
                </div>
                <CardDescription className="mt-1">
                  Detalles de la {ubicacion.tipo.toLowerCase()} y opciones de gestión.
                </CardDescription>
              </div>
              <DialogTrigger asChild>
                <Button variant="outline" onClick={() => handleEditUbicacion(ubicacion)}>
                  <Edit className="mr-2 h-4 w-4" /> Editar {ubicacion.tipo}
                </Button>
              </DialogTrigger>
            </div>
          </CardHeader>
          <CardContent className="grid gap-6 md:grid-cols-2">
            <div>
              <h3 className="text-lg font-semibold mb-2 text-foreground font-headline">Información General</h3>
              <div className="space-y-2 text-sm">
                <p><strong>ID:</strong> <Badge variant="secondary" className="font-mono">{ubicacion.id}</Badge></p>
                <p><strong>Tipo:</strong> <Badge>{ubicacion.tipo}</Badge></p>
                {parentUbicacion && (
                  <p><strong>Planta Principal:</strong> 
                    <Link href={`/dashboard/ubicaciones/${parentUbicacion.id}`} className="text-primary hover:underline ml-1">
                      {parentUbicacion.nombre}
                    </Link>
                    <Badge variant="outline" className="ml-2">{parentUbicacion.tipo}</Badge>
                  </p>
                )}
                <p><strong>Creado:</strong> {ubicacion.createdAt ? format(ubicacion.createdAt.toDate(), 'dd/MM/yyyy HH:mm:ss') : 'N/A'}</p>
                <p><strong>Actualizado:</strong> {ubicacion.updatedAt ? format(ubicacion.updatedAt.toDate(), 'dd/MM/yyyy HH:mm:ss') : 'N/A'}</p>
              </div>
            </div>
            
            {ubicacion.tipo !== 'Planta' && ( // IDF or MDF
                <div className="space-y-4">
                    <Card className="bg-secondary/50">
                    <CardHeader>
                        <CardTitle className="text-xl flex items-center font-headline">
                        <Cpu className="mr-2 h-5 w-5 text-accent" /> Equipos
                        </CardTitle>
                        <CardDescription>
                        Gestiona los equipos de red instalados en este {ubicacion.tipo}.
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
                </div>
            )}
          </CardContent>
        </Card>

        {ubicacion.tipo === 'Planta' && (
          <Card className="mt-8 shadow-lg">
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                    <CardTitle className="text-xl flex items-center font-headline">
                    <Layers className="mr-2 h-5 w-5 text-primary" /> IDF/MDFs en {ubicacion.nombre}
                    </CardTitle>
                    <CardDescription>
                    Lista de IDFs y MDFs dentro de esta planta.
                    </CardDescription>
                </div>
                <DialogTrigger asChild>
                    <Button onClick={handleAddNewIDFOrMDF} className="bg-primary hover:bg-primary/90 text-primary-foreground">
                        <PlusCircle className="mr-2 h-4 w-4"/> Nuevo IDF/MDF
                    </Button>
                </DialogTrigger>
              </div>
            </CardHeader>
            <CardContent>
              {childUbicaciones.length === 0 ? (
                <p className="text-muted-foreground">No hay IDF/MDFs registrados en esta planta.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nombre IDF/MDF</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Equipos</TableHead>
                      <TableHead>Nodos Conectados</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {childUbicaciones.map(child => (
                      <TableRow key={child.id}>
                        <TableCell>
                          <Link href={`/dashboard/ubicaciones/${child.id}`} className="font-medium text-primary hover:underline">
                            {child.nombre}
                          </Link>
                        </TableCell>
                        <TableCell><Badge variant="outline">{child.tipo}</Badge></TableCell>
                        <TableCell>{child.equiposCount ?? '...'}</TableCell>
                        <TableCell>{child.nodosCount ?? '...'}</TableCell>
                        <TableCell className="text-right">
                           <Button variant="ghost" size="sm" asChild>
                             <Link href={`/dashboard/ubicaciones/${child.id}/equipos`}>Ver Equipos</Link>
                           </Button>
                           {/* Edit/Delete for IDF/MDF can be added here using DialogTrigger if needed */}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        )}
        
        <DialogContent className="sm:max-w-[525px]">
            <DialogHeader>
            <DialogTitle className="font-headline">
                {editingUbicacion?.id && editingUbicacion.tipo ? `Editar ${editingUbicacion.tipo}` : `Nuevo IDF/MDF en ${ubicacion.nombre}`}
            </DialogTitle>
            </DialogHeader>
            <UbicacionForm
                ubicacion={editingUbicacion?.id ? editingUbicacion : null} // Pass null for new, or existing for edit
                // For new IDF/MDF under a Planta, parentId is pre-filled in editingUbicacion state
                // For editing a Planta, parentId field will be disabled/hidden by form logic
                // For editing IDF/MDF, parentId select will show Plantas
                allUbicaciones={allUbicacionesForForm} // Pass only Plantas if creating/editing IDF/MDF
                preselectedParentId={ubicacion.tipo === 'Planta' && !editingUbicacion?.id ? ubicacion.id : undefined} // For new IDF/MDF in current Planta
                onSuccess={() => {
                  setIsFormOpen(false);
                  setEditingUbicacion(null); // Reset after form action
                }}
            />
        </DialogContent>
      </Dialog>
    </div>
  );
}
