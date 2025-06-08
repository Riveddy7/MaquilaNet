'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { equipoSchema, EquipoTipoEnum, EquipoEstadoEnum } from '@/lib/schemas';
import type { Equipo } from '@/types';
import { useAuth } from '@/contexts/auth-context';
import { db } from '@/lib/firebase/client';
import { collection, addDoc, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { useState } from 'react';
import { DialogFooter, DialogClose } from '@/components/ui/dialog';

type EquipoFormValues = z.infer<typeof equipoSchema>;

interface EquipoFormProps {
  ubicacionId: string; // This is the IDF/MDF ID
  equipo?: Equipo | null;
  onSuccess: () => void;
}

export function EquipoForm({ ubicacionId, equipo, onSuccess }: EquipoFormProps) {
  const { toast } = useToast();
  const { userProfile } = useAuth();
  const [loading, setLoading] = useState(false);

  const form = useForm<EquipoFormValues>({
    resolver: zodResolver(equipoSchema),
    defaultValues: {
      nombre: equipo?.nombre || '',
      tipo: equipo?.tipo || EquipoTipoEnum.Values.Switch,
      marca: equipo?.marca || '',
      modelo: equipo?.modelo || '',
      serialNumber: equipo?.serialNumber || '',
      assetTag: equipo?.assetTag || '',
      ipGestion: equipo?.ipGestion || '',
      rfidTagId: equipo?.rfidTagId || '',
      rackPositionU: equipo?.rackPositionU === null ? undefined : equipo?.rackPositionU, // Handle null from Firestore
      estado: equipo?.estado || EquipoEstadoEnum.Values.Activo,
      numeroDePuertos: equipo?.numeroDePuertos || 0,
    },
  });

  const onSubmit = async (data: EquipoFormValues) => {
    if (!userProfile?.organizationId || !ubicacionId) {
      toast({ title: "Error", description: "Datos de sesión o ubicación inválidos.", variant: "destructive" });
      return;
    }
    setLoading(true);

    const equipoData = {
      ...data,
      rackPositionU: data.rackPositionU ? Number(data.rackPositionU) : null, // Store as number or null
      numeroDePuertos: Number(data.numeroDePuertos),
    };

    try {
      if (equipo) { // Editing existing equipo
        const equipoRef = doc(db, 'equipos', equipo.id);
        await updateDoc(equipoRef, {
          ...equipoData,
          updatedAt: serverTimestamp(),
        });
        toast({ title: "Éxito", description: "Equipo actualizado correctamente." });
      } else { // Creating new equipo
        await addDoc(collection(db, 'equipos'), {
          ...equipoData,
          ubicacionId: ubicacionId, // IDF/MDF ID
          organizationId: userProfile.organizationId,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        toast({ title: "Éxito", description: "Equipo creado correctamente." });
      }
      onSuccess();
    } catch (error: any) {
      console.error("Error saving equipo:", error);
      toast({ title: "Error", description: error.message || "No se pudo guardar el equipo.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="nombre"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nombre del Equipo</FormLabel>
                <FormControl>
                  <Input placeholder="Ej: SW-CORE-PISO1, RTR-BORDE" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="tipo"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Tipo de Equipo</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona un tipo" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {Object.values(EquipoTipoEnum.Values).map((tipo) => (
                      <SelectItem key={tipo} value={tipo}>{tipo}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="marca"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Marca (Opcional)</FormLabel>
                <FormControl>
                  <Input placeholder="Ej: Cisco, Juniper" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="modelo"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Modelo (Opcional)</FormLabel>
                <FormControl>
                  <Input placeholder="Ej: Catalyst 9300, MX204" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
            control={form.control}
            name="serialNumber"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Número de Serie (Opcional)</FormLabel>
                <FormControl>
                  <Input placeholder="Ej: FTX12345ABC" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="assetTag"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Asset Tag (Opcional)</FormLabel>
                <FormControl>
                  <Input placeholder="Ej: MAQ-IT-00123" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="ipGestion"
            render={({ field }) => (
              <FormItem>
                <FormLabel>IP de Gestión (Opcional)</FormLabel>
                <FormControl>
                  <Input placeholder="Ej: 192.168.1.10" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
           <FormField
            control={form.control}
            name="rfidTagId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Tag RFID (Opcional)</FormLabel>
                <FormControl>
                  <Input placeholder="ID del Tag RFID" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
           <FormField
            control={form.control}
            name="rackPositionU"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Posición en Rack (U) (Opcional)</FormLabel>
                <FormControl>
                  <Input type="number" placeholder="Ej: 23" {...field} 
                  value={field.value === null ? '' : field.value} // Handle null for input display
                  onChange={e => field.onChange(e.target.value === '' ? null : parseInt(e.target.value))} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
           <FormField
            control={form.control}
            name="estado"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Estado</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona un estado" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {Object.values(EquipoEstadoEnum.Values).map((estado) => (
                      <SelectItem key={estado} value={estado}>{estado}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="numeroDePuertos"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Número de Puertos</FormLabel>
                <FormControl>
                  <Input type="number" placeholder="Ej: 24, 48" {...field} onChange={e => field.onChange(parseInt(e.target.value))} />
                </FormControl>
                 <FormDescription>Referencia para la gestión de puertos.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <DialogFooter className="pt-4">
          <DialogClose asChild>
            <Button type="button" variant="outline" disabled={loading}>
              Cancelar
            </Button>
          </DialogClose>
          <Button type="submit" disabled={loading} className="bg-primary hover:bg-primary/90 text-primary-foreground">
            {loading ? (
              <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-primary-foreground mr-2"></div>
            ) : null}
            {equipo ? 'Guardar Cambios' : 'Crear Equipo'}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );
}
