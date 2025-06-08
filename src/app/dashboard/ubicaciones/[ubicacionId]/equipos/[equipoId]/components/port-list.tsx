'use client';

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Edit3, Link2, Slash, WifiOff, Wifi, AlertCircle, CheckCircle2, Settings2 } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { db } from '@/lib/firebase/client';
import { collection, query, where, onSnapshot, doc, getDoc, orderBy } from 'firebase/firestore';
import type { Puerto, Nodo } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { PortForm } from './port-form';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

interface PortListProps {
  equipoId: string;
  numeroDePuertos: number;
}

interface PuertoExtendido extends Puerto {
  nodoNombreHost?: string;
}

export function PortList({ equipoId, numeroDePuertos }: PortListProps) {
  const [puertosData, setPuertosData] = useState<Map<number, PuertoExtendido>>(new Map());
  const [nodosMap, setNodosMap] = useState<Map<string, Nodo>>(new Map());
  const [loading, setLoading] = useState(true);
  const { userProfile } = useAuth();
  const { toast } = useToast();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingPuerto, setEditingPuerto] = useState<PuertoExtendido | null>(null);
  const [selectedPortNumber, setSelectedPortNumber] = useState<number | null>(null);


  useEffect(() => {
    if (!userProfile?.organizationId || !equipoId) return;
    setLoading(true);

    const nodosQuery = query(
        collection(db, 'nodos'),
        where('organizationId', '==', userProfile.organizationId)
    );
    const unsubNodos = onSnapshot(nodosQuery, (snapshot) => {
        const newNodosMap = new Map<string, Nodo>();
        snapshot.forEach(doc => newNodosMap.set(doc.id, { id: doc.id, ...doc.data() } as Nodo));
        setNodosMap(newNodosMap);
    });

    const q = query(
      collection(db, 'puertos'),
      where('organizationId', '==', userProfile.organizationId),
      where('equipoId', '==', equipoId),
      orderBy('numeroPuerto') // Firestore order might not be strictly necessary if we map by numeroPuerto
    );

    const unsubscribePorts = onSnapshot(q, (querySnapshot) => {
      const newPuertosData = new Map<number, PuertoExtendido>();
      querySnapshot.forEach((doc) => {
        const puertoData = { id: doc.id, ...doc.data() } as Puerto;
        newPuertosData.set(puertoData.numeroPuerto, {
            ...puertoData,
            nodoNombreHost: puertoData.nodoId ? nodosMap.get(puertoData.nodoId)?.nombreHost : undefined
        });
      });
      setPuertosData(newPuertosData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching ports:", error);
      toast({ title: "Error", description: "No se pudieron cargar los puertos.", variant: "destructive"});
      setLoading(false);
    });

    return () => {
        unsubscribePorts();
        unsubNodos();
    };
  }, [equipoId, userProfile?.organizationId, toast, nodosMap]); // Added nodosMap dependency

  const handleEdit = (portNumber: number) => {
    const puertoExistente = puertosData.get(portNumber);
    setEditingPuerto(puertoExistente || null);
    setSelectedPortNumber(portNumber);
    setIsFormOpen(true);
  };


  const getPortStatusIcon = (estado: Puerto['estado']) => {
    switch (estado) {
      case 'Libre': return <WifiOff className="h-4 w-4 text-green-500" />;
      case 'Ocupado': return <Wifi className="h-4 w-4 text-blue-500" />;
      case 'Dañado': return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'Mantenimiento': return <Settings2 className="h-4 w-4 text-yellow-500" />;
      default: return <Slash className="h-4 w-4 text-gray-400" />;
    }
  };
  
  const allNodosArray = useMemo(() => Array.from(nodosMap.values()), [nodosMap]);


  const renderPorts = () => {
    const portElements = [];
    for (let i = 1; i <= numeroDePuertos; i++) {
      const puertoData = puertosData.get(i);
      const nodoNombre = puertoData?.nodoId ? nodosMap.get(puertoData.nodoId)?.nombreHost : undefined;

      portElements.push(
        <TableRow key={i}>
          <TableCell className="font-mono">{i}</TableCell>
          <TableCell>
            {puertoData ? (
                <Badge variant={
                    puertoData.estado === 'Libre' ? 'default' 
                    : puertoData.estado === 'Ocupado' ? 'secondary' 
                    : puertoData.estado === 'Dañado' ? 'destructive' 
                    : 'outline'}
                    className={puertoData.estado === 'Libre' ? 'bg-green-100 text-green-700 border-green-300' : 
                               puertoData.estado === 'Ocupado' ? 'bg-blue-100 text-blue-700 border-blue-300' : ''}
                >
                    {getPortStatusIcon(puertoData.estado)}
                    <span className="ml-1">{puertoData.estado}</span>
                </Badge>
            ) : (
                 <Badge variant="outline">
                    <WifiOff className="h-4 w-4 text-gray-400 mr-1" />
                    No Configurado
                 </Badge>
            )}
          </TableCell>
          <TableCell>{puertoData?.tipoPuerto || 'N/A'}</TableCell>
          <TableCell>
            {puertoData?.nodoId && (nodoNombre || puertoData.nodoId) ? (
                 <span className="flex items-center">
                    <Link2 className="h-3 w-3 mr-1 text-muted-foreground"/> 
                    {nodoNombre || puertoData.nodoId}
                 </span>
            ) : '-'}
          </TableCell>
          <TableCell className="truncate max-w-xs">{puertoData?.descripcionConexion || '-'}</TableCell>
          <TableCell className="text-right">
            <DialogTrigger asChild>
                <Button variant="ghost" size="icon" onClick={() => handleEdit(i)}>
                    <Edit3 className="h-4 w-4" />
                </Button>
            </DialogTrigger>
          </TableCell>
        </TableRow>
      );
    }
    return portElements;
  };


  if (loading) {
    return <div className="text-center py-4">Cargando puertos...</div>;
  }

  return (
    <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
      <div className="max-h-[500px] overflow-y-auto">
        <Table>
          <TableHeader className="sticky top-0 bg-card z-10">
            <TableRow>
              <TableHead className="w-[80px]">Puerto #</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Conectado a (Nodo)</TableHead>
              <TableHead>Descripción</TableHead>
              <TableHead className="text-right w-[100px]">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {numeroDePuertos > 0 ? renderPorts() : (
                <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        Este equipo no tiene puertos numerados para gestionar o el número de puertos es 0.
                    </TableCell>
                </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      
      {selectedPortNumber !== null && (
        <DialogContent className="sm:max-w-lg">
            <DialogHeader>
            <DialogTitle className="font-headline">
                {editingPuerto ? `Editar Puerto ${editingPuerto.numeroPuerto}` : `Configurar Puerto ${selectedPortNumber}`}
            </DialogTitle>
            </DialogHeader>
            <PortForm
                equipoId={equipoId}
                puerto={editingPuerto}
                portNumber={selectedPortNumber}
                allNodos={allNodosArray}
                onSuccess={() => {
                    setIsFormOpen(false);
                    setEditingPuerto(null);
                    setSelectedPortNumber(null);
                }}
            />
        </DialogContent>
      )}
    </Dialog>
  );
}
