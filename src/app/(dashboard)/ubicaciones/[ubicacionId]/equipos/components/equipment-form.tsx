// src/app/(dashboard)/ubicaciones/[ubicacionId]/equipos/components/equipment-form.tsx (Conceptual)
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
// import { Textarea } from '@/components/ui/textarea'; // For longer fields if any
// import { Checkbox } from '@/components/ui/checkbox'; // If any boolean fields
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/auth-context';
import { useRouter } from 'next/navigation';
import { equipoSchema, EquipoTipoEnum, EquipoEstadoEnum } from '@/lib/schemas';
import { useEffect, useState } from 'react';

// Define AppEquipo to match API response / data structure
interface AppEquipo {
  id: string;
  nombre: string;
  tipo: z.infer<typeof EquipoTipoEnum>;
  marca?: string | null;
  modelo?: string | null;
  serialNumber?: string | null;
  assetTag?: string | null;
  ipGestion?: string | null;
  rfidTagId?: string | null;
  ubicacionId: string;
  rackPositionU?: number | null;
  estado: z.infer<typeof EquipoEstadoEnum>;
  numeroDePuertos: number;
  organizationId?: string;
  // ubicacionNombre?: string; // API might return this, but form usually deals with IDs
}

type EquipoFormData = z.infer<typeof equipoSchema>;

interface EquipmentFormProps {
  initialData?: AppEquipo;
  ubicacionId: string; // Current location context, primarily for creation.
                       // For editing, initialData.ubicacionId is the source of truth,
                       // but this prop might be used to default/validate a move.
  onSubmitSuccess?: (equipo: AppEquipo) => void;
  // parentUbicaciones?: { id: string; nombre: string }[]; // For moving equipment
}

export function EquipmentForm({ initialData, ubicacionId, onSubmitSuccess }: EquipmentFormProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const defaultValues: EquipoFormData = { // Explicitly type defaultValues
    nombre: initialData?.nombre || '',
    tipo: initialData?.tipo || undefined,
    marca: initialData?.marca || '',
    modelo: initialData?.modelo || '',
    serialNumber: initialData?.serialNumber || '',
    assetTag: initialData?.assetTag || '',
    ipGestion: initialData?.ipGestion || '',
    rfidTagId: initialData?.rfidTagId || '',
    rackPositionU: initialData?.rackPositionU === undefined ? null : initialData.rackPositionU, // Ensure null if undefined
    estado: initialData?.estado || EquipoEstadoEnum.Enum.Activo, // Default to 'Activo'
    numeroDePuertos: initialData?.numeroDePuertos === undefined ? 0 : initialData.numeroDePuertos, // Default to 0
  };

  const form = useForm<EquipoFormData>({
    resolver: zodResolver(equipoSchema),
    defaultValues,
  });

  useEffect(() => {
    if (initialData) {
      form.reset({
        nombre: initialData.nombre,
        tipo: initialData.tipo,
        marca: initialData.marca || '',
        modelo: initialData.modelo || '',
        serialNumber: initialData.serialNumber || '',
        assetTag: initialData.assetTag || '',
        ipGestion: initialData.ipGestion || '',
        rfidTagId: initialData.rfidTagId || '',
        rackPositionU: initialData.rackPositionU === undefined ? null : initialData.rackPositionU,
        estado: initialData.estado,
        numeroDePuertos: initialData.numeroDePuertos === undefined ? 0 : initialData.numeroDePuertos,
      });
    }
  }, [initialData, form]);

  async function onSubmit(values: EquipoFormData) {
    if (!user) {
      toast({ title: "Error", description: "Debes iniciar sesión.", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);

    // Determine the ubicacionId for the payload.
    // For creation, it's from props. For update, it's from initialData.
    // This form does not currently support moving an equipo to a different ubicacionId.
    const payloadUbicacionId = initialData ? initialData.ubicacionId : ubicacionId;

    const payload = { ...values, ubicacionId: payloadUbicacionId };


    try {
      const token = await user.getIdToken();
      const method = initialData ? 'PUT' : 'POST';
      const url = initialData ? `/api/equipos/${initialData.id}` : '/api/equipos';

      const response = await fetch(url, {
        method: method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(payload), // Send combined payload
      });

      const responseData = await response.json();

      if (!response.ok) {
        throw new Error(responseData.error || `Failed to ${initialData ? 'update' : 'create'} equipo`);
      }

      toast({
        title: `Equipo ${initialData ? 'actualizado' : 'creado'}`,
        description: `El equipo "${responseData.nombre}" ha sido ${initialData ? 'actualizado' : 'creado'} exitosamente.`,
      });

      if (onSubmitSuccess) {
        onSubmitSuccess(responseData as AppEquipo);
      } else {
        router.push(`/dashboard/ubicaciones/${payloadUbicacionId}`); // Go to the ubicacion's page
        router.refresh();
      }

    } catch (error: any) {
      console.error("Error submitting equipment form:", error);
      toast({
        title: "Error",
        description: error.message || `No se pudo ${initialData ? 'actualizar' : 'crear'} el equipo.`,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <FormField
          control={form.control}
          name="nombre"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nombre del Equipo</FormLabel>
              <FormControl><Input placeholder="Ej: Switch Core Principal" {...field} /></FormControl>
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
                <FormControl><SelectTrigger><SelectValue placeholder="Selecciona un tipo" /></SelectTrigger></FormControl>
                <SelectContent>
                  {EquipoTipoEnum.options.map(option => (
                    <SelectItem key={option} value={option}>{option}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField control={form.control} name="marca" render={({ field }) => (<FormItem><FormLabel>Marca</FormLabel><FormControl><Input placeholder="Ej: Cisco" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
        <FormField control={form.control} name="modelo" render={({ field }) => (<FormItem><FormLabel>Modelo</FormLabel><FormControl><Input placeholder="Ej: Catalyst 9300" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
        <FormField control={form.control} name="serialNumber" render={({ field }) => (<FormItem><FormLabel>Número de Serie</FormLabel><FormControl><Input {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
        <FormField control={form.control} name="assetTag" render={({ field }) => (<FormItem><FormLabel>Asset Tag</FormLabel><FormControl><Input {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
        <FormField control={form.control} name="ipGestion" render={({ field }) => (<FormItem><FormLabel>IP de Gestión</FormLabel><FormControl><Input placeholder="Ej: 192.168.1.10" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
        <FormField control={form.control} name="rfidTagId" render={({ field }) => (<FormItem><FormLabel>RFID Tag ID</FormLabel><FormControl><Input {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
        <FormField
            control={form.control}
            name="rackPositionU"
            render={({ field }) => (
                <FormItem>
                <FormLabel>Posición en Rack (U)</FormLabel>
                <FormControl><Input type="number" {...field} value={field.value ?? ''} onChange={e => field.onChange(e.target.value === '' ? null : parseInt(e.target.value,10))} /></FormControl>
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
                    <FormControl><SelectTrigger><SelectValue placeholder="Selecciona un estado" /></SelectTrigger></FormControl>
                    <SelectContent>
                    {EquipoEstadoEnum.options.map(option => (
                        <SelectItem key={option} value={option}>{option}</SelectItem>
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
                <FormControl><Input type="number" {...field} value={field.value} onChange={e => field.onChange(parseInt(e.target.value,10) || 0)} /></FormControl>
                <FormMessage />
                </FormItem>
            )}
        />
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Guardando...' : (initialData ? 'Actualizar Equipo' : 'Crear Equipo')}
        </Button>
      </form>
    </Form>
  );
}
