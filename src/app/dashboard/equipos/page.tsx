// This page can serve as a global equipment list or search.
// For MVP, it might be simpler to primarily manage equipment within specific locations.
// /dashboard/ubicaciones/[ubicacionId]/equipos/page.tsx will be the primary equipment management interface per location.

'use client';

import { useState, useEffect } from 'react';
import { PlusCircle, Edit, Trash2, Cpu, Search, SlidersHorizontal, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
// import { EquipoForm } from './components/equipment-form'; // Global form might be different or not needed if always location-specific
import { useAuth } from '@/contexts/auth-context';
import { collection, query, where, onSnapshot, orderBy, deleteDoc, doc, getDoc, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import type { Equipo, Ubicacion } from '@/types';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface EquipoConUbicacion extends Equipo {
  ubicacionNombre?: string;
  plantaNombre?: string;
}

export default function EquiposGlobalPage() {
  const [equipos, setEquipos] = useState<EquipoConUbicacion[]>([]);
  const [ubicacionesMap, setUbicacionesMap] = useState<Map<string, Ubicacion>>(new Map());
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const { userProfile } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (!userProfile?.organizationId) return;

    setLoading(true);
    const ubicacionesQuery = query(
      collection(db, 'ubicaciones'),
      where('organizationId', '==', userProfile.organizationId)
    );

    const unsubUbicaciones = onSnapshot(ubicacionesQuery, (querySnapshot) => {
      const uMap = new Map<string, Ubicacion>();
      querySnapshot.forEach((doc) => {
        uMap.set(doc.id, { id: doc.id, ...doc.data() } as Ubicacion);
      });
      setUbicacionesMap(uMap);

      const equiposQuery = query(
        collection(db, 'equipos'),
        where('organizationId', '==', userProfile.organizationId),
        orderBy('createdAt', 'desc')
      );

      const unsubEquipos = onSnapshot(equiposQuery, async (equiposSnapshot) => {
        const dataPromises = equiposSnapshot.docs.map(async (doc) => {
          const equipoData = { id: doc.id, ...doc.data() } as Equipo;
          const ubicacion = uMap.get(equipoData.ubicacionId);
          let plantaNombre = 'N/A';
          if (ubicacion?.parentId) { // IDF/MDF parent is a Planta
             const planta = uMap.get(ubicacion.parentId);
             plantaNombre = planta?.nombre || 'Desconocida';
          } else if (ubicacion?.tipo === 'Planta') { // Should not happen for equipos
             plantaNombre = ubicacion.nombre;
          }
          
          return {
            ...equipoData,
            ubicacionNombre: ubicacion?.nombre || 'Desconocida',
            plantaNombre: plantaNombre,
          };
        });
        const data = await Promise.all(dataPromises);
        setEquipos(data);
        setLoading(false);
      }, (error) => {
        console.error("Error fetching equipos:", error);
        toast({ title: "Error", description: "No se pudieron cargar los equipos.", variant: "destructive"});
        setLoading(false);
      });
      return () => unsubEquipos();
    }, (error) => {
      console.error("Error fetching ubicaciones map:", error);
      toast({ title: "Error", description: "No se pudieron cargar datos de ubicaciones.", variant: "destructive"});
      setLoading(false);
    });
    
    return () => unsubUbicaciones();
  }, [userProfile?.organizationId, toast]);


  const handleDelete = async (equipo: EquipoConUbicacion) => {
    if (!userProfile?.organizationId) return;
    try {
      await deleteDoc(doc(db, 'equipos', equipo.id));
      toast({ title: "Equipo eliminado", description: `El equipo "${equipo.nombre}" ha sido eliminado.`});
    } catch (error) {
      console.error("Error deleting equipo: ", error);
      toast({ title: "Error", description: "No se pudo eliminar el equipo.", variant: "destructive"});
    }
  };
  
  const filteredEquipos = equipos.filter(e => 
    e.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.tipo.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (e.marca && e.marca.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (e.modelo && e.modelo.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (e.serialNumber && e.serialNumber.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (e.ubicacionNombre && e.ubicacionNombre.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (e.plantaNombre && e.plantaNombre.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="container mx-auto py-8">
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle className="flex items-center font-headline">
                  <Cpu className="mr-2 h-6 w-6 text-primary" />
                  Inventario Global de Equipos
                </CardTitle>
                <CardDescription>
                  Visualiza todos los equipos de red registrados en tu organización, agrupados por IDF/MDF y Planta.
                </CardDescription>
              </div>
              <Button disabled> 
                <PlusCircle className="mr-2 h-4 w-4" /> Nuevo Equipo (desde IDF/MDF)
              </Button>
            </div>
             <div className="mt-4 flex gap-2 items-center">
              <div className="relative flex-grow">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input 
                  type="search"
                  placeholder="Buscar equipo (nombre, tipo, marca, S/N, IDF/MDF, Planta)..."
                  className="pl-8 w-full"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
              </div>
            ) : filteredEquipos.length === 0 ? (
                <div className="text-center py-10">
                  <Cpu className="mx-auto h-12 w-12 text-muted-foreground" />
                  <h3 className="mt-2 text-sm font-medium text-foreground">No se encontraron equipos</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {searchTerm ? "Intenta con otra búsqueda." : "Registra equipos dentro de sus IDF/MDF."}
                  </p>
                </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nombre Equipo</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Marca/Modelo</TableHead>
                      <TableHead>IDF/MDF</TableHead>
                      <TableHead>Planta</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredEquipos.map((equipo) => (
                      <TableRow key={equipo.id}>
                        <TableCell className="font-medium">
                           <Link href={`/dashboard/ubicaciones/${equipo.ubicacionId}/equipos/${equipo.id}`} className="hover:underline text-primary">
                            {equipo.nombre}
                          </Link>
                        </TableCell>
                        <TableCell><Badge variant="outline">{equipo.tipo}</Badge></TableCell>
                        <TableCell>{equipo.marca || '-'} / {equipo.modelo || '-'}</TableCell>
                         <TableCell>
                          <Link href={`/dashboard/ubicaciones/${equipo.ubicacionId}`} className="hover:underline text-sm">
                            <MapPin className="inline mr-1 h-3 w-3 text-muted-foreground"/>{equipo.ubicacionNombre}
                          </Link>
                        </TableCell>
                        <TableCell>
                          { ubicacionesMap.get(equipo.ubicacionId)?.parentId ? (
                             <Link href={`/dashboard/ubicaciones/${ubicacionesMap.get(equipo.ubicacionId)?.parentId}`} className="hover:underline text-xs">
                                {equipo.plantaNombre}
                             </Link>
                          ) : (equipo.plantaNombre || 'N/A')}
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant={equipo.estado === 'Activo' ? 'default' : equipo.estado === 'Inactivo' ? 'destructive' : 'secondary'}
                            className={equipo.estado === 'Activo' ? 'bg-green-500 text-white' : ''}
                          >
                            {equipo.estado}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right space-x-1">
                          <Button variant="ghost" size="icon" asChild>
                             <Link href={`/dashboard/ubicaciones/${equipo.ubicacionId}/equipos/${equipo.id}`}>
                              <Edit className="h-4 w-4" />
                            </Link>
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive/80">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Esta acción no se puede deshacer. Esto eliminará permanentemente el equipo "{equipo.nombre}".
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDelete(equipo)}
                                  className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                                >
                                  Eliminar
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
    </div>
  );
}
