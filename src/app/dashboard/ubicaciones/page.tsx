'use client';

import { useState, useEffect } from 'react';
import { PlusCircle, Edit, Trash2, MapPin, Search, Building } from 'lucide-react';
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
import Link from 'next/link';
import { UbicacionForm } from './components/location-form';
import { useAuth } from '@/contexts/auth-context';
import { collection, query, where, onSnapshot, orderBy, deleteDoc, doc, getDocs } from 'firebase/firestore';
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
  const [plantas, setPlantas] = useState<Ubicacion[]>([]); // Only Plantas here
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingUbicacion, setEditingUbicacion] = useState<Ubicacion | null>(null); // For editing a Planta or creating a new one
  const [searchTerm, setSearchTerm] = useState('');
  const { userProfile } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (!userProfile?.organizationId) return;

    setLoading(true);
    // Query for Plantas only
    const q = query(
      collection(db, 'ubicaciones'),
      where('organizationId', '==', userProfile.organizationId),
      where('tipo', '==', 'Planta'), 
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const data: Ubicacion[] = [];
      querySnapshot.forEach((doc) => {
        data.push({ id: doc.id, ...doc.data() } as Ubicacion);
      });
      setPlantas(data);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching plantas:", error);
      toast({ title: "Error", description: "No se pudieron cargar las plantas.", variant: "destructive"});
      setLoading(false);
    });

    return () => unsubscribe();
  }, [userProfile?.organizationId, toast]);

  const handleAddPlanta = () => {
    setEditingUbicacion(null); // For creating a new Planta
    setIsFormOpen(true);
  };

  const handleEditPlanta = (planta: Ubicacion) => {
    setEditingUbicacion(planta);
    setIsFormOpen(true);
  };

  const handleDeletePlanta = async (plantaId: string) => {
    if (!userProfile?.organizationId) return;
    
    // Check for child IDF/MDFs
    const childrenQuery = query(collection(db, 'ubicaciones'), where('parentId', '==', plantaId));
    const childrenSnap = await getDocs(childrenQuery);
    if (!childrenSnap.empty) {
      toast({ title: "Error", description: "No se puede eliminar la planta. Primero elimine los IDF/MDFs asociados.", variant: "destructive"});
      return;
    }

    try {
      await deleteDoc(doc(db, 'ubicaciones', plantaId));
      toast({ title: "Planta eliminada", description: "La planta ha sido eliminada correctamente."});
    } catch (error) {
      console.error("Error deleting planta: ", error);
      toast({ title: "Error", description: "No se pudo eliminar la planta.", variant: "destructive"});
    }
  };
  
  const filteredPlantas = plantas.filter(p => 
    p.nombre.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="container mx-auto py-8">
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle className="flex items-center font-headline">
                  <Building className="mr-2 h-6 w-6 text-primary" />
                  Gestión de Plantas
                </CardTitle>
                <CardDescription>
                  Visualiza, crea y administra tus plantas de producción.
                </CardDescription>
              </div>
              <DialogTrigger asChild>
                <Button onClick={handleAddPlanta} className="bg-primary hover:bg-primary/90 text-primary-foreground">
                  <PlusCircle className="mr-2 h-4 w-4" /> Nueva Planta
                </Button>
              </DialogTrigger>
            </div>
             <div className="mt-4">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input 
                  type="search"
                  placeholder="Buscar por nombre de planta..."
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
            ) : filteredPlantas.length === 0 ? (
                <div className="text-center py-10">
                  <Building className="mx-auto h-12 w-12 text-muted-foreground" />
                  <h3 className="mt-2 text-sm font-medium text-foreground">No se encontraron plantas</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {searchTerm ? "Intenta con otra búsqueda." : "Crea una nueva planta para empezar."}
                  </p>
                   {!searchTerm && (
                    <DialogTrigger asChild>
                      <Button className="mt-4 bg-primary hover:bg-primary/90 text-primary-foreground" onClick={handleAddPlanta}>
                        <PlusCircle className="mr-2 h-4 w-4" /> Crear Planta
                      </Button>
                    </DialogTrigger>
                   )}
                </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nombre Planta</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Creado</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPlantas.map((planta) => (
                      <TableRow key={planta.id}>
                        <TableCell className="font-medium">
                          <Link href={`/dashboard/ubicaciones/${planta.id}`} className="hover:underline text-primary">
                            {planta.nombre}
                          </Link>
                        </TableCell>
                        <TableCell><Badge variant="secondary">{planta.tipo}</Badge></TableCell>
                        <TableCell>
                          {planta.createdAt ? format(planta.createdAt.toDate(), 'dd/MM/yyyy HH:mm') : 'N/A'}
                        </TableCell>
                        <TableCell className="text-right space-x-2">
                          <DialogTrigger asChild>
                            <Button variant="ghost" size="icon" onClick={() => handleEditPlanta(planta)}>
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
                                  Esta acción no se puede deshacer. Esto eliminará permanentemente la planta "{planta.nombre}" y todos sus IDF/MDFs y equipos asociados.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDeletePlanta(planta.id)}
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
              {editingUbicacion ? 'Editar Planta' : 'Nueva Planta'}
            </DialogTitle>
          </DialogHeader>
          <UbicacionForm
            ubicacion={editingUbicacion} 
            allUbicaciones={[]} // Plantas no tienen padres, so no options needed for parentId field in this context
            onSuccess={() => setIsFormOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
