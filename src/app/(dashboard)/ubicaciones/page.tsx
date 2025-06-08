// src/app/(dashboard)/ubicaciones/page.tsx (Conceptual Refactor)
// Actual file content will be read and modified by the subtask.
// This is a template for the subtask's actions.

'use client';

import { useState, useEffect, useCallback } from 'react';
import { PlusCircle, Edit, Trash2, MapPin, Search } from 'lucide-react'; // Common icons
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import Link from 'next/link';
import { useAuth } from '@/contexts/auth-context';
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
import { UbicacionTipoEnum } from '@/lib/schemas'; // For type if needed, or define locally
import { Badge } from '@/components/ui/badge';
import * as z from 'zod';


// Define a type for Ubicacion that matches API response and includes necessary fields
interface AppUbicacion {
  id: string;
  nombre: string;
  tipo: z.infer<typeof UbicacionTipoEnum>; // Using Zod enum type
  parentId?: string | null;
  organizationId: string;
  createdAt: string; // Assuming string from JSON
  updatedAt: string; // Assuming string from JSON
  // Add any other fields returned by GET /api/ubicaciones like childCount or equipoCount if API provides them
}

export default function UbicacionesListPage() {
  const [ubicaciones, setUbicaciones] = useState<AppUbicacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const { user, userProfile } = useAuth();
  const { toast } = useToast();

  const fetchUbicaciones = useCallback(async () => {
    if (!user || !userProfile?.organizationId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/ubicaciones', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch ubicaciones');
      }
      const data: AppUbicacion[] = await response.json();
      setUbicaciones(data);
    } catch (error: any) {
      console.error("Error fetching ubicaciones:", error);
      toast({ title: "Error", description: error.message || "No se pudieron cargar las ubicaciones.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [user, userProfile?.organizationId, toast]);

  useEffect(() => {
    fetchUbicaciones();
  }, [fetchUbicaciones]);

  const handleDelete = async (ubicacion: AppUbicacion) => {
    if (!user) return;

    try {
      const token = await user.getIdToken();
      const response = await fetch(`/api/ubicaciones/${ubicacion.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete ubicacion');
      }

      toast({ title: "Ubicación eliminada", description: `La ubicación "${ubicacion.nombre}" ha sido eliminada.`});
      setUbicaciones(prevUbicaciones => prevUbicaciones.filter(u => u.id !== ubicacion.id));

    } catch (error: any) {
      console.error("Error deleting ubicacion: ", error);
      toast({ title: "Error al eliminar", description: error.message || "No se pudo eliminar la ubicación.", variant: "destructive"});
    }
  };
  
  const filteredUbicaciones = ubicaciones.filter(u =>
    u.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.tipo.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // The actual JSX will depend on the original file's structure.
  // This is a plausible structure for listing locations in cards.
  return (
    <div className="container mx-auto py-8">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="flex items-center font-headline">
              <MapPin className="mr-2 h-6 w-6 text-primary" />
              Ubicaciones
            </CardTitle>
            {/* Link to a page for creating new ubicaciones, that page will use location-form.tsx */}
            <Button asChild>
              <Link href="/dashboard/ubicaciones/nueva"> {/* Assuming a route like this for new form */}
                <PlusCircle className="mr-2 h-4 w-4" /> Nueva Ubicación
              </Link>
            </Button>
          </div>
          <CardDescription>
            Gestiona las ubicaciones físicas de tu infraestructura de red.
          </CardDescription>
          <div className="mt-4 flex gap-2 items-center">
            <div className="relative flex-grow">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Buscar por nombre o tipo..."
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
          ) : filteredUbicaciones.length === 0 ? (
            <div className="text-center py-10">
              <MapPin className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-2 text-sm font-medium text-foreground">No se encontraron ubicaciones</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {searchTerm ? "Intenta con otra búsqueda." : "Comienza creando una nueva ubicación."}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredUbicaciones.map(ubicacion => (
                <Card key={ubicacion.id} className="flex flex-col">
                  <CardHeader>
                    <div className="flex justify-between items-start">
                        <div>
                            <CardTitle className="text-lg hover:underline">
                                <Link href={`/dashboard/ubicaciones/${ubicacion.id}`}>
                                    {ubicacion.nombre}
                                </Link>
                            </CardTitle>
                            <Badge variant="outline" className="mt-1">{ubicacion.tipo}</Badge>
                        </div>
                        {/* Actions: Edit (link) and Delete (dialog) */}
                         <div className="flex space-x-1">
                            <Button variant="ghost" size="icon" asChild>
                                <Link href={`/dashboard/ubicaciones/${ubicacion.id}/editar`}> {/* Assuming edit route */}
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
                                    Esta acción no se puede deshacer. Esto eliminará permanentemente la ubicación "{ubicacion.nombre}".
                                    Si hay equipos, censos RFID u otras ubicaciones secundarias asociadas, es posible que no se pueda eliminar directamente.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleDelete(ubicacion)} variant="destructive">
                                    Eliminar
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </div>
                    </div>
                  </CardHeader>
                  <CardContent className="flex-grow">
                    <p className="text-sm text-muted-foreground">
                      {/* Display more info like parent, or counts of items if API provides */}
                      {ubicacion.parentId ? `Sub-ubicación de: ${ubicacion.parentId}` : 'Ubicación principal'}
                    </p>
                    {/* Example: <p>Equipos: {ubicacion.equipoCount || 0}</p> */}
                  </CardContent>
                  <CardFooter>
                     <Button variant="outline" size="sm" asChild className="w-full">
                        <Link href={`/dashboard/ubicaciones/${ubicacion.id}`}>
                            Ver Detalles y Equipos
                        </Link>
                     </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
