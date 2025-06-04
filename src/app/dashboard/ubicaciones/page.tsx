'use client';

import { useState, useEffect } from 'react';
import { PlusCircle, Edit, Trash2, MapPin, Search } from 'lucide-react';
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
  DialogFooter,
  DialogClose
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { UbicacionForm } from './components/location-form'; // To be created
import { useAuth } from '@/contexts/auth-context';
import { collection, query, where, onSnapshot, orderBy, deleteDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import type { Ubicacion } from '@/types';
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

export default function UbicacionesPage() {
  const [ubicaciones, setUbicaciones] = useState<Ubicacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingUbicacion, setEditingUbicacion] = useState<Ubicacion | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const { userProfile } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (!userProfile?.organizationId) return;

    setLoading(true);
    const q = query(
      collection(db, 'ubicaciones'),
      where('organizationId', '==', userProfile.organizationId),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const data: Ubicacion[] = [];
      querySnapshot.forEach((doc) => {
        data.push({ id: doc.id, ...doc.data() } as Ubicacion);
      });
      setUbicaciones(data);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching ubicaciones:", error);
      toast({ title: "Error", description: "No se pudieron cargar las ubicaciones.", variant: "destructive"});
      setLoading(false);
    });

    return () => unsubscribe();
  }, [userProfile?.organizationId, toast]);

  const handleAdd = () => {
    setEditingUbicacion(null);
    setIsFormOpen(true);
  };

  const handleEdit = (ubicacion: Ubicacion) => {
    setEditingUbicacion(ubicacion);
    setIsFormOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!userProfile?.organizationId) return;
    try {
      // TODO: Check for child ubicaciones or associated equipos before deleting
      await deleteDoc(doc(db, 'ubicaciones', id));
      toast({ title: "Ubicación eliminada", description: "La ubicación ha sido eliminada correctamente."});
    } catch (error) {
      console.error("Error deleting ubicacion: ", error);
      toast({ title: "Error", description: "No se pudo eliminar la ubicación.", variant: "destructive"});
    }
  };
  
  const filteredUbicaciones = ubicaciones.filter(u => 
    u.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.tipo.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="container mx-auto py-8">
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle className="flex items-center font-headline">
                  <MapPin className="mr-2 h-6 w-6 text-primary" />
                  Gestión de Ubicaciones
                </CardTitle>
                <CardDescription>
                  Visualiza, crea y administra tus IDFs, MDFs, Racks y otras ubicaciones.
                </CardDescription>
              </div>
              <DialogTrigger asChild>
                <Button onClick={handleAdd}>
                  <PlusCircle className="mr-2 h-4 w-4" /> Nueva Ubicación
                </Button>
              </DialogTrigger>
            </div>
             <div className="mt-4">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input 
                  type="search"
                  placeholder="Buscar por nombre o tipo..."
                  className="pl-8 w-full sm:w-1/3"
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
            ) : filteredUbicaciones.length === 0 ? (
                <div className="text-center py-10">
                  <MapPin className="mx-auto h-12 w-12 text-muted-foreground" />
                  <h3 className="mt-2 text-sm font-medium text-foreground">No se encontraron ubicaciones</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {searchTerm ? "Intenta con otra búsqueda." : "Crea una nueva ubicación para empezar."}
                  </p>
                   {!searchTerm && (
                    <DialogTrigger asChild>
                      <Button className="mt-4" onClick={handleAdd}>
                        <PlusCircle className="mr-2 h-4 w-4" /> Crear Ubicación
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
                      <TableHead>Principal (Parent)</TableHead>
                      <TableHead>Creado</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUbicaciones.map((ubicacion) => (
                      <TableRow key={ubicacion.id}>
                        <TableCell className="font-medium">
                          <Link href={`/dashboard/ubicaciones/${ubicacion.id}`} className="hover:underline text-primary">
                            {ubicacion.nombre}
                          </Link>
                        </TableCell>
                        <TableCell><Badge variant="secondary">{ubicacion.tipo}</Badge></TableCell>
                        <TableCell>
                          {ubicacion.parentId ? 
                            (ubicaciones.find(u => u.id === ubicacion.parentId)?.nombre || 'N/A') : 
                            '-'}
                        </TableCell>
                        <TableCell>
                          {ubicacion.createdAt ? format(ubicacion.createdAt.toDate(), 'dd/MM/yyyy HH:mm') : 'N/A'}
                        </TableCell>
                        <TableCell className="text-right space-x-2">
                          <DialogTrigger asChild>
                            <Button variant="ghost" size="icon" onClick={() => handleEdit(ubicacion)}>
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
                                  Esta acción no se puede deshacer. Esto eliminará permanentemente la ubicación "{ubicacion.nombre}".
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDelete(ubicacion.id)}
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

        <DialogContent className="sm:max-w-[525px]">
          <DialogHeader>
            <DialogTitle className="font-headline">
              {editingUbicacion ? 'Editar Ubicación' : 'Nueva Ubicación'}
            </DialogTitle>
          </DialogHeader>
          <UbicacionForm
            ubicacion={editingUbicacion}
            allUbicaciones={ubicaciones}
            onSuccess={() => setIsFormOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
