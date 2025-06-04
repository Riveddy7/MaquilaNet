'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter, Link } from 'next/navigation';
import { PlusCircle, Edit, Trash2, Cpu, Search, ArrowLeft, SlidersHorizontal } from 'lucide-react';
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
import { EquipoForm } from './components/equipment-form'; // To be created
import { useAuth } from '@/contexts/auth-context';
import { collection, query, where, onSnapshot, orderBy, deleteDoc, doc, getDoc } from 'firebase/firestore';
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

export default function EquiposPage() {
  const params = useParams();
  const router = useRouter();
  const ubicacionId = params.ubicacionId as string;

  const [ubicacion, setUbicacion] = useState<Ubicacion | null>(null);
  const [equipos, setEquipos] = useState<Equipo[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingEquipo, setEditingEquipo] = useState<Equipo | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const { userProfile } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (!userProfile?.organizationId || !ubicacionId) return;

    setLoading(true);
    // Fetch current ubicacion details
    const ubicacionDocRef = doc(db, 'ubicaciones', ubicacionId);
    const unsubUbicacion = onSnapshot(ubicacionDocRef, (docSnap) => {
      if (docSnap.exists() && docSnap.data().organizationId === userProfile.organizationId) {
        setUbicacion({ id: docSnap.id, ...docSnap.data() } as Ubicacion);
      } else {
        toast({ title: "Error", description: "Ubicación no encontrada o no tienes acceso.", variant: "destructive" });
        router.push('/dashboard/ubicaciones');
      }
    });

    // Fetch equipos for this ubicacion
    const q = query(
      collection(db, 'equipos'),
      where('organizationId', '==', userProfile.organizationId),
      where('ubicacionId', '==', ubicacionId),
      orderBy('createdAt', 'desc')
    );

    const unsubscribeEquipos = onSnapshot(q, (querySnapshot) => {
      const data: Equipo[] = [];
      querySnapshot.forEach((doc) => {
        data.push({ id: doc.id, ...doc.data() } as Equipo);
      });
      setEquipos(data);
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

  return (
    <div className="container mx-auto py-8">
      <Button variant="outline" size="sm" className="mb-6" asChild>
        <Link href={`/dashboard/ubicaciones/${ubicacionId}`}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Volver a {ubicacion?.nombre || 'Ubicación'}
        </Link>
      </Button>

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle className="flex items-center font-headline">
                  <Cpu className="mr-2 h-6 w-6 text-primary" />
                  Equipos en {ubicacion?.nombre || 'Cargando...'}
                </CardTitle>
                <CardDescription>
                  Administra los equipos de red instalados en esta ubicación.
                </CardDescription>
              </div>
              <DialogTrigger asChild>
                <Button onClick={handleAdd} disabled={!ubicacion}>
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
              {/* <Button variant="outline"><SlidersHorizontal className="mr-2 h-4 w-4" /> Filtros</Button> */}
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
                     {searchTerm ? "Intenta con otra búsqueda." : `No hay equipos registrados en "${ubicacion?.nombre || 'esta ubicación'}".`}
                  </p>
                   {!searchTerm && ubicacion && (
                    <DialogTrigger asChild>
                      <Button className="mt-4" onClick={handleAdd}>
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
                      <TableHead>Marca/Modelo</TableHead>
                      <TableHead>S/N</TableHead>
                      <TableHead>IP Gestión</TableHead>
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
                        </TableCell>
                        <TableCell><Badge variant="outline">{equipo.tipo}</Badge></TableCell>
                        <TableCell>{equipo.marca || '-'} / {equipo.modelo || '-'}</TableCell>
                        <TableCell>{equipo.serialNumber || '-'}</TableCell>
                        <TableCell>{equipo.ipGestion || '-'}</TableCell>
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

        <DialogContent className="sm:max-w-2xl"> {/* Wider dialog for more fields */}
          <DialogHeader>
            <DialogTitle className="font-headline">
              {editingEquipo ? 'Editar Equipo' : 'Nuevo Equipo'}
            </DialogTitle>
          </DialogHeader>
          {ubicacionId && (
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
