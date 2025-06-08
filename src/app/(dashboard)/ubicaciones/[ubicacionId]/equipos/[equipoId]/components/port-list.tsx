// port-list.tsx
'use client';
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Trash2, Edit, PowerIcon, CableIcon, InfoIcon, NetworkIcon, ServerIcon, ShieldAlertIcon, WorkflowIcon } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
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
import { PuertoEstadoEnum, PuertoTipoEnum } from '@/lib/schemas'; // For enums
import * as z from 'zod';


export interface AppPuerto {
  id: string;
  numeroPuerto: number;
  tipoPuerto: z.infer<typeof PuertoTipoEnum>;
  estado: z.infer<typeof PuertoEstadoEnum>;
  nodoId?: string | null;
  vlanId?: string | null;
  descripcionConexion?: string | null;
  nodoNombreHost?: string | null;
  createdAt: string;
  updatedAt: string;
  // equipoId and organizationId are also returned by API, can be added if needed by UI directly
}

interface PortListProps {
  equipoId: string;
  onEditPort: (puerto: AppPuerto) => void;
  onPortsLoaded?: (ports: AppPuerto[]) => void; // Optional: callback when ports are loaded
  refreshKey?: number; // Optional: to trigger re-fetch from parent
}

export function PortList({ equipoId, onEditPort, onPortsLoaded, refreshKey }: PortListProps) {
  const [ports, setPorts] = useState<AppPuerto[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();

  const fetchPorts = useCallback(async () => {
    if (!user || !equipoId) {
        setLoading(false);
        return;
    }
    setLoading(true);
    try {
      const token = await user.getIdToken();
      const response = await fetch(`/api/puertos?equipoId=${equipoId}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch ports');
      }
      const data = await response.json();
      setPorts(data);
      if (onPortsLoaded) {
        onPortsLoaded(data);
      }
    } catch (error: any) {
      console.error("Error fetching ports:", error);
      toast({ title: "Error al cargar puertos", description: error.message, variant: "destructive" });
      setPorts([]); // Clear ports on error
      if (onPortsLoaded) {
        onPortsLoaded([]);
      }
    } finally {
      setLoading(false);
    }
  }, [user, equipoId, toast, onPortsLoaded]);

  useEffect(() => {
    fetchPorts();
  }, [fetchPorts, refreshKey]); // Add refreshKey as dependency

  const handleDelete = async (portId: string) => {
    if (!user) return;
    try {
      const token = await user.getIdToken();
      const response = await fetch(`/api/puertos/${portId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete port');
      }
      toast({ title: "Puerto eliminado", description: "El puerto ha sido eliminado exitosamente." });
      setPorts(prev => prev.filter(p => p.id !== portId));
    } catch (error: any) {
      console.error("Error deleting port:", error);
      toast({ title: "Error al eliminar puerto", description: error.message, variant: "destructive" });
    }
  };

  const getPortStatusIcon = (status: z.infer<typeof PuertoEstadoEnum>) => {
    switch (status) {
      case 'Libre': return <PowerIcon className="h-4 w-4 text-green-500" />;
      case 'Ocupado': return <CableIcon className="h-4 w-4 text-blue-500" />;
      case 'Dañado': return <ShieldAlertIcon className="h-4 w-4 text-red-500" />;
      case 'Mantenimiento': return <WorkflowIcon className="h-4 w-4 text-yellow-500" />;
      default: return <InfoIcon className="h-4 w-4 text-gray-500" />;
    }
  };

  const getPortTypeIcon = (type: z.infer<typeof PuertoTipoEnum>) => {
    switch (type) {
        case 'RJ45': return <NetworkIcon className="h-4 w-4 text-gray-700" />;
        case 'SFP': return <ServerIcon className="h-4 w-4 text-purple-700" />; // Example, choose appropriate
        case 'SFP+': return <ServerIcon className="h-4 w-4 text-indigo-700" />; // Example
        default: return <CableIcon className="h-4 w-4 text-gray-500" />;
    }
  }


  if (loading) return (
    <div className="flex justify-center items-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
        <p className="ml-2">Cargando puertos...</p>
    </div>
  );

  if (ports.length === 0 && !loading) return (
    <div className="text-center py-8">
        <CableIcon className="mx-auto h-12 w-12 text-muted-foreground" />
        <h3 className="mt-2 text-sm font-medium">No hay puertos</h3>
        <p className="mt-1 text-sm text-muted-foreground">Este equipo no tiene puertos configurados o no se pudieron cargar.</p>
    </div>
    );

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>#</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Conectado a</TableHead>
            <TableHead>VLAN</TableHead>
            <TableHead>Descripción</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {ports.sort((a,b) => a.numeroPuerto - b.numeroPuerto).map(port => (
            <TableRow key={port.id}>
              <TableCell className="font-medium">{port.numeroPuerto}</TableCell>
              <TableCell>
                <Badge variant="outline" className="flex items-center w-min">
                    {getPortTypeIcon(port.tipoPuerto)}
                    <span className="ml-1">{port.tipoPuerto}</span>
                </Badge>
              </TableCell>
              <TableCell>
                <Badge variant={
                    port.estado === 'Libre' ? 'default' :
                    port.estado === 'Ocupado' ? 'secondary' :
                    port.estado === 'Dañado' ? 'destructive' :
                    'warning' // Mantenimiento
                } className="flex items-center w-min">
                   {getPortStatusIcon(port.estado)}
                   <span className="ml-1">{port.estado}</span>
                </Badge>
              </TableCell>
              <TableCell>{port.nodoNombreHost || '-'}</TableCell>
              <TableCell>{port.vlanId || '-'}</TableCell>
              <TableCell className="max-w-xs truncate">{port.descripcionConexion || '-'}</TableCell>
              <TableCell className="text-right space-x-1">
                <Button variant="ghost" size="icon" onClick={() => onEditPort(port)} title="Editar Puerto">
                  <Edit className="h-4 w-4" />
                </Button>
                <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive/80" title="Eliminar Puerto">
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                        <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Esta acción no se puede deshacer. Esto eliminará permanentemente el puerto #{port.numeroPuerto}.
                        </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDelete(port.id)} variant="destructive">
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
  );
}
