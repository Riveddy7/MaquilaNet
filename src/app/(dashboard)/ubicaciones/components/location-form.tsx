'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
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
import { ubicacionSchema, UbicacionTipoEnum } from '@/lib/schemas';
import type { Ubicacion } from '@/types';
import { useAuth } from '@/contexts/auth-context';
import { db } from '@/lib/firebase/client';
import { collection, addDoc, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { useState } from 'react';
import { DialogFooter, DialogClose } from '@/components/ui/dialog';


type UbicacionFormValues = z.infer<typeof ubicacionSchema>;

interface UbicacionFormProps {
  ubicacion?: Ubicacion | null;
  allUbicaciones: Ubicacion[]; // For parent selection
  onSuccess: () => void;
}

export function UbicacionForm({ ubicacion, allUbicaciones, onSuccess }: UbicacionFormProps) {
  const { toast } = useToast();
  const { userProfile } = useAuth();
  const [loading, setLoading] = useState(false);

  const form = useForm<UbicacionFormValues>({
    resolver: zodResolver(ubicacionSchema),
    defaultValues: {
      nombre: ubicacion?.nombre || '',
      tipo: ubicacion?.tipo || UbicacionTipoEnum.Values.IDF,
      parentId: ubicacion?.parentId || null,
    },
  });

  const onSubmit = async (data: UbicacionFormValues) => {
    if (!userProfile?.organizationId) {
      toast({ title: "Error", description: "Usuario no autenticado o sin organización.", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      if (ubicacion) { // Editing existing ubicacion
        const ubicacionRef = doc(db, 'ubicaciones', ubicacion.id);
        await updateDoc(ubicacionRef, {
          ...data,
          parentId: data.parentId || null, // Ensure null if empty
          updatedAt: serverTimestamp(),
        });
        toast({ title: "Éxito", description: "Ubicación actualizada correctamente." });
      } else { // Creating new ubicacion
        await addDoc(collection(db, 'ubicaciones'), {
          ...data,
          parentId: data.parentId || null, // Ensure null if empty
          organizationId: userProfile.organizationId,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        toast({ title: "Éxito", description: "Ubicación creada correctamente." });
      }
      onSuccess();
    } catch (error: any) {
      console.error("Error saving ubicacion:", error);
      toast({ title: "Error", description: error.message || "No se pudo guardar la ubicación.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };
  
  const parentOptions = allUbicaciones.filter(u => u.id !== ubicacion?.id); // Prevent self-parenting

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="nombre"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nombre de la Ubicación</FormLabel>
              <FormControl>
                <Input placeholder="Ej: IDF Piso 1, Rack A03" {...field} />
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
              <FormLabel>Tipo de Ubicación</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona un tipo" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {Object.values(UbicacionTipoEnum.Values).map((tipo) => (
                    <SelectItem key={tipo} value={tipo}>{tipo}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="parentId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Ubicación Principal (Opcional)</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value || ""}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona ubicación principal (si aplica)" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="">Ninguna</SelectItem>
                  {parentOptions.map((parent) => (
                    <SelectItem key={parent.id} value={parent.id}>
                      {parent.nombre} ({parent.tipo})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline" disabled={loading}>
              Cancelar
            </Button>
          </DialogClose>
          <Button type="submit" disabled={loading} className="bg-primary hover:bg-primary/90 text-primary-foreground">
            {loading ? (
              <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-primary-foreground mr-2"></div>
            ) : null}
            {ubicacion ? 'Guardar Cambios' : 'Crear Ubicación'}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );
}
