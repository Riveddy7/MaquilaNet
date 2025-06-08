'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { PlusCircle, Edit, Trash2, Cpu, Search, ArrowLeft, SlidersHorizontal, Network } from 'lucide-react';
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { EquipoForm } from './components/equipment-form';
import { useAuth } from '@/contexts/auth-context';
import { collection, query, where, onSnapshot, orderBy, deleteDoc, doc, getDoc, getCountFromServer } from 'firebase/firestore';
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

interface EquipoExtendido extends Equipo {
  connectedNodosCount?: number | null;
}


export default function EquiposEnUbicacionPage() {
  const params = useParams();
  const router = useRouter();
  const ubicacionId = params.ubicacionId as string; // This is IDF/MDF ID

  const [ubicacion, setUbicacion] = useState<Ubicacion | null>(null);
  const [planta, setPlanta] = useState<Ubicacion | null>(null);
  const [equipos, setEquipos] = useState<EquipoExtendido[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingEquipo, setEditingEquipo] = useState<Equipo | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const { userProfile } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (!userProfile?.organizationId || !ubicacionId) return;

    setLoading(true);
    // Fetch current ubicacion (IDF/MDF) details
    const ubicacionDocRef = doc(db, 'ubicaciones', ubicacionId);
    const unsubUbicacion = onSnapshot(ubicacionDocRef, async (docSnap) => {
      if (docSnap.exists() && docSnap.data().organizationId === userProfile.organizationId && (docSnap.data().tipo === 'IDF' || docSnap.data().tipo === 'MDF') ) {
        const currentUbicacion = { id: docSnap.id, ...docSnap.data() } as Ubicacion;
        setUbicacion(currentUbicacion);
        // Fetch Planta if IDF/MDF has parentId
        if (currentUbicacion.parentId) {
            const plantaDocRef = doc(db, 'ubicaciones', currentUbicacion.parentId);
            const plantaSnap = await getDoc(plantaDocRef);
            if (plantaSnap.exists()) {
                setPlanta({ id: plantaSnap.id, ...plantaSnap.data()} as Ubicacion);
            }
        }
      } else {
        toast({ title: "Error", description: "Ubicación (IDF/MDF) no encontrada o no tienes acceso.", variant: "destructive" });
        router.push('/dashboard/ubicaciones'); // Redirect to plantas list
      }
    });

    // Fetch equipos for this ubicacion (IDF/MDF)
    const q = query(
      collection(db, 'equipos'),
      where('organizationId', '==', userProfile.organizationId),
      where('ubicacionId', '==', ubicacionId), // equipos directly under this IDF/MDF
      orderBy('createdAt', 'desc')
    );

    const unsubscribeEquipos = onSnapshot(q, async (querySnapshot) => {
      const dataPromises = querySnapshot.docs.map(async (doc) => {
        const equipoData = { id: doc.id, ...doc.data() } as Equipo;
        // Count connected nodos for this equipo
        const puertosQuery = query(collection(db, 'puertos'), where('equipoId', '==', equipoData.id), where('estado', '==', 'Ocupado'), where('nodoId', '!=', null));
        const puertosSnap = await getCountFromServer(puertosQuery);
        return { ...equipoData, connectedNodosCount: puertosSnap.data().count };
      });
      const resolvedData = await Promise.all(dataPromises);
      setEquipos(resolvedData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching equipos:", error);
      toast({ title: "Error", description: "No se pudieron cargar los equipos.", variant: "destructive"});
      setLoading(false);
    });

    return () => {
      unsubUbicacion();
      unsubscribeEquipos();
    };
  }, [ubicacionId, userProfile?.organizationId, router, toast]);

  const handleAdd = () => {
    setEditingEquipo(null);
    setIsFormOpen(true);
  };

  const handleEdit = (equipo: Equipo) => {
    setEditingEquipo(equipo);
    setIsFormOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!userProfile?.organizationId) return;
    try {
      // TODO: Check for associated ports or other dependencies before deleting
      await deleteDoc(doc(db, 'equipos', id));
      toast({ title: "Equipo eliminado", description: "El equipo ha sido eliminado correctamente."});
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
    (e.serialNumber && e.serialNumber.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const pageTitle = ubicacion ? `Equipos en ${ubicacion.nombre}` : 'Cargando Equipos...';
  const pageDescription = planta ? `Perteneciente a la planta ${planta.nombre}.` : `Administra los equipos de red instalados en este ${ubicacion?.tipo}.`;

  return (
    <div className="container mx-auto py-8">
      <Button variant="outline" size="sm" className="mb-6" asChild>
        <Link href={`/dashboard/ubicaciones/${planta?.id || ubicacion?.parentId || ''}`}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Volver a {planta?.nombre || ubicacion?.parentId || 'Planta'}
        </Link>
      </Button>

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle className="flex items-center font-headline">
                  <Cpu className="mr-2 h-6 w-6 text-primary" />
                  {pageTitle}
                </CardTitle>
                <CardDescription>
                  {pageDescription}
                </CardDescription>
              </div>
              <DialogTrigger asChild>
                <Button onClick={handleAdd} disabled={!ubicacion} className="bg-primary hover:bg-primary/90 text-primary-foreground">
                  <PlusCircle className="mr-2 h-4 w-4" /> Nuevo Equipo
                </Button>
              </DialogTrigger>
            </div>
             <div className="mt-4 flex gap-2 items-center">
              <div className="relative flex-grow">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input 
                  type="search"
                  placeholder="Buscar por nombre, tipo, marca, S/N..."
                  className="pl-8 w-full sm:w-1/2"
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
                     {searchTerm ? "Intenta con otra búsqueda." : `No hay equipos registrados en "${ubicacion?.nombre || 'este IDF/MDF'}".`}
                  </p>
                   {!searchTerm && ubicacion && (
                    <DialogTrigger asChild>
                      <Button className="mt-4 bg-primary hover:bg-primary/90 text-primary-foreground" onClick={handleAdd}>
                        <PlusCircle className="mr-2 h-4 w-4" /> Crear Equipo
                      </Button>
                    </DialogTrigger>
                   )}
                </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>S/N</TableHead>
                      <TableHead><Network className="inline h-4 w-4 mr-1"/>Nodos/Puertos</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredEquipos.map((equipo) => (
                      <TableRow key={equipo.id}>
                        <TableCell className="font-medium">
                          <Link href={`/dashboard/ubicaciones/${ubicacionId}/equipos/${equipo.id}`} className="hover:underline text-primary">
                            {equipo.nombre}
                          </Link>
                          <div className="text-xs text-muted-foreground">{equipo.marca || ''} {equipo.modelo || ''}</div>
                        </TableCell>
                        <TableCell><Badge variant="outline">{equipo.tipo}</Badge></TableCell>
                        <TableCell>{equipo.serialNumber || '-'}</TableCell>
                        <TableCell>
                          {equipo.connectedNodosCount === null ? '...' : equipo.connectedNodosCount} / {equipo.numeroDePuertos}
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
                          <DialogTrigger asChild>
                            <Button variant="ghost" size="icon" onClick={() => handleEdit(equipo)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
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
                                  onClick={() => handleDelete(equipo.id)}
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

        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-headline">
              {editingEquipo ? 'Editar Equipo' : `Nuevo Equipo en ${ubicacion?.nombre || 'IDF/MDF'}`}
            </DialogTitle>
          </DialogHeader>
          {ubicacionId && ( // Ensure ubicacionId (IDF/MDF ID) is available
            <EquipoForm
              ubicacionId={ubicacionId}
              equipo={editingEquipo}
              onSuccess={() => setIsFormOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
