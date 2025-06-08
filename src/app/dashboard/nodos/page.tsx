'use client';

import { useState, useEffect } from 'react';
import { PlusCircle, Edit, Trash2, Network as NetworkIcon, Search, PcCase, Printer, Camera, Factory } from 'lucide-react';
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
import { NodoForm } from './components/node-form';
import { useAuth } from '@/contexts/auth-context';
import { collection, query, where, onSnapshot, orderBy, deleteDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import type { Nodo } from '@/types';
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

export default function NodosPage() {
  const [nodos, setNodos] = useState<Nodo[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingNodo, setEditingNodo] = useState<Nodo | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const { userProfile } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (!userProfile?.organizationId) return;

    setLoading(true);
    const q = query(
      collection(db, 'nodos'),
      where('organizationId', '==', userProfile.organizationId),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const data: Nodo[] = [];
      querySnapshot.forEach((doc) => {
        data.push({ id: doc.id, ...doc.data() } as Nodo);
      });
      setNodos(data);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching nodos:", error);
      toast({ title: "Error", description: "No se pudieron cargar los nodos.", variant: "destructive"});
      setLoading(false);
    });

    return () => unsubscribe();
  }, [userProfile?.organizationId, toast]);

  const handleAdd = () => {
    setEditingNodo(null);
    setIsFormOpen(true);
  };

  const handleEdit = (nodo: Nodo) => {
    setEditingNodo(nodo);
    setIsFormOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!userProfile?.organizationId) return;
    try {
      // TODO: Check if nodo is associated with any port before deleting, or handle unlinking.
      await deleteDoc(doc(db, 'nodos', id));
      toast({ title: "Nodo eliminado", description: "El nodo ha sido eliminado correctamente."});
    } catch (error) {
      console.error("Error deleting nodo: ", error);
      toast({ title: "Error", description: "No se pudo eliminar el nodo.", variant: "destructive"});
    }
  };
  
  const filteredNodos = nodos.filter(n => 
    n.nombreHost.toLowerCase().includes(searchTerm.toLowerCase()) ||
    n.tipoDispositivo.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (n.ipAsignada && n.ipAsignada.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (n.macAddress && n.macAddress.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (n.usuarioResponsable && n.usuarioResponsable.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (n.ubicacionFisicaFinal && n.ubicacionFisicaFinal.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const getNodeIcon = (tipo: Nodo['tipoDispositivo']) => {
    switch (tipo) {
      case 'PC': return <PcCase className="h-4 w-4 mr-2 inline" />;
      case 'Impresora': return <Printer className="h-4 w-4 mr-2 inline" />;
      case 'Cámara IP': return <Camera className="h-4 w-4 mr-2 inline" />;
      case 'Máquina Industrial': return <Factory className="h-4 w-4 mr-2 inline" />;
      default: return <NetworkIcon className="h-4 w-4 mr-2 inline" />;
    }
  };

  return (
    <div className="container mx-auto py-8">
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle className="flex items-center font-headline">
                  <NetworkIcon className="mr-2 h-6 w-6 text-primary" />
                  Gestión de Nodos Finales
                </CardTitle>
                <CardDescription>
                  Administra los dispositivos finales conectados a tu red (PCs, impresoras, etc.).
                </CardDescription>
              </div>
              <DialogTrigger asChild>
                 <Button onClick={handleAdd} className="bg-primary hover:bg-primary/90 text-primary-foreground">
                  <PlusCircle className="mr-2 h-4 w-4" /> Nuevo Nodo
                </Button>
              </DialogTrigger>
            </div>
             <div className="mt-4">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input 
                  type="search"
                  placeholder="Buscar por nombre, tipo, IP, MAC..."
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
            ) : filteredNodos.length === 0 ? (
                <div className="text-center py-10">
                  <NetworkIcon className="mx-auto h-12 w-12 text-muted-foreground" />
                  <h3 className="mt-2 text-sm font-medium text-foreground">No se encontraron nodos</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                     {searchTerm ? "Intenta con otra búsqueda." : "Crea un nuevo nodo. Los nodos se asocian a puertos de equipos."}
                  </p>
                   {!searchTerm && (
                    <DialogTrigger asChild>
                       <Button className="mt-4 bg-primary hover:bg-primary/90 text-primary-foreground" onClick={handleAdd}>
                        <PlusCircle className="mr-2 h-4 w-4" /> Crear Nodo
                      </Button>
                    </DialogTrigger>
                   )}
                </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nombre Host</TableHead>
                      <TableHead>Tipo Dispositivo</TableHead>
                      <TableHead>IP Asignada</TableHead>
                      <TableHead>MAC Address</TableHead>
                      <TableHead>Ubicación Física</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredNodos.map((nodo) => (
                      <TableRow key={nodo.id}>
                        <TableCell className="font-medium">{nodo.nombreHost}</TableCell>
                        <TableCell><Badge variant="secondary">{getNodeIcon(nodo.tipoDispositivo)} {nodo.tipoDispositivo}</Badge></TableCell>
                        <TableCell>{nodo.ipAsignada || '-'}</TableCell>
                        <TableCell className="font-mono text-xs">{nodo.macAddress || '-'}</TableCell>
                        <TableCell>{nodo.ubicacionFisicaFinal || '-'}</TableCell>
                        <TableCell className="text-right space-x-2">
                          <DialogTrigger asChild>
                            <Button variant="ghost" size="icon" onClick={() => handleEdit(nodo)}>
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
                                  Esta acción no se puede deshacer. Esto eliminará permanentemente el nodo "{nodo.nombreHost}".
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDelete(nodo.id)}
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

        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-headline">
              {editingNodo ? 'Editar Nodo' : 'Nuevo Nodo'}
            </DialogTitle>
          </DialogHeader>
          <NodoForm
            nodo={editingNodo}
            onSuccess={() => setIsFormOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
