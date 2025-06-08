// src/app/(dashboard)/equipos/page.tsx (Refactored)
'use client';

import { useState, useEffect, useCallback } from 'react';
import { PlusCircle, Edit, Trash2, Cpu, Search, MapPin } from 'lucide-react';
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
import { useAuth } from '@/contexts/auth-context'; // For getting user and token
// Removed Firestore imports
import type { Equipo } from '@/types'; // Assuming Equipo might not have ubicacionNombre
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

// This interface should match the structure returned by GET /api/equipos
interface EquipoConUbicacion extends Equipo {
  id: string; // Ensure 'id' is part of the base Equipo or explicitly here
  ubicacionNombre?: string;
  // Add other fields from 'equipos' table that are in Equipo type and returned by API
  // e.g. nombre, tipo, marca, modelo, serialNumber, estado etc.
}

export default function EquiposGlobalPage() {
  const [equipos, setEquipos] = useState<EquipoConUbicacion[]>([]);
  // ubicacionesMap is no longer needed as ubicacionNombre comes from API
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const { user, userProfile } = useAuth(); // user from useAuth for getIdToken()
  const { toast } = useToast();

  const fetchEquipos = useCallback(async () => {
    if (!user || !userProfile?.organizationId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/equipos', { // Fetches all equipos for the org
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch equipos');
      }
      const data: EquipoConUbicacion[] = await response.json();
      setEquipos(data);
    } catch (error: any) {
      console.error("Error fetching equipos:", error);
      toast({ title: "Error", description: error.message || "No se pudieron cargar los equipos.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [user, userProfile?.organizationId, toast]);

  useEffect(() => {
    fetchEquipos();
  }, [fetchEquipos]);


  const handleDelete = async (equipo: EquipoConUbicacion) => {
    if (!user || !userProfile?.organizationId) return;

    try {
      const token = await user.getIdToken();
      const response = await fetch(`/api/equipos/${equipo.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete equipo');
      }

      toast({ title: "Equipo eliminado", description: `El equipo "${equipo.nombre}" ha sido eliminado.`});
      // Refetch or remove from local state
      setEquipos(prevEquipos => prevEquipos.filter(e => e.id !== equipo.id));

    } catch (error: any) {
      console.error("Error deleting equipo: ", error);
      toast({ title: "Error", description: error.message || "No se pudo eliminar el equipo.", variant: "destructive"});
    }
  };
  
  const filteredEquipos = equipos.filter(e => 
    e.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (e.tipo && e.tipo.toLowerCase().includes(searchTerm.toLowerCase())) || // check if tipo exists
    (e.marca && e.marca.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (e.modelo && e.modelo.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (e.serialNumber && e.serialNumber.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (e.ubicacionNombre && e.ubicacionNombre.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // The rest of the JSX structure remains largely the same.
  // Links to specific equipo pages like `/dashboard/ubicaciones/${equipo.ubicacionId}/equipos/${equipo.id}`
  // will also need to be updated eventually if the routing structure for viewing/editing single items changes,
  // or those target pages will need to be refactored to use API calls too.

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
                  Visualiza todos los equipos de red registrados en tu organización.
                </CardDescription>
              </div>
              <Button disabled> 
                <PlusCircle className="mr-2 h-4 w-4" /> Nuevo Equipo (desde Ubicación)
              </Button>
            </div>
             <div className="mt-4 flex gap-2 items-center">
              <div className="relative flex-grow">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input 
                  type="search"
                  placeholder="Buscar equipo (nombre, tipo, marca, S/N, ubicación)..."
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
                    {searchTerm ? "Intenta con otra búsqueda." : "No hay equipos registrados o no se pudieron cargar."}
                  </p>
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
                      <TableHead>Ubicación</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredEquipos.map((equipo) => (
                      <TableRow key={equipo.id}>
                        <TableCell className="font-medium">
                           {/* This link will eventually point to a page that also needs refactoring */}
                           <Link href={`/dashboard/ubicaciones/${equipo.ubicacionId}/equipos/${equipo.id}`} className="hover:underline text-primary">
                            {equipo.nombre}
                          </Link>
                        </TableCell>
                        <TableCell><Badge variant="outline">{equipo.tipo}</Badge></TableCell>
                        <TableCell>{equipo.marca || '-'} / {equipo.modelo || '-'}</TableCell>
                        <TableCell>{equipo.serialNumber || '-'}</TableCell>
                        <TableCell>
                          {/* This link will eventually point to a page that also needs refactoring */}
                          <Link href={`/dashboard/ubicaciones/${equipo.ubicacionId}`} className="hover:underline text-sm">
                            <MapPin className="inline mr-1 h-3 w-3 text-muted-foreground"/>{equipo.ubicacionNombre || 'N/A'}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant={equipo.estado === 'Activo' ? 'default' : equipo.estado === 'Inactivo' ? 'destructive' : 'secondary'}
                            // className={equipo.estado === 'Activo' ? 'bg-green-500 text-white' : ''} // Standard badge variants should handle colors
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
                                  // className="bg-destructive hover:bg-destructive/90 text-destructive-foreground" // Standard destructive variant should handle this
                                  variant="destructive"
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
