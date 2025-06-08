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
import { useState, useEffect } from 'react';
import { DialogFooter, DialogClose } from '@/components/ui/dialog';


type UbicacionFormValues = z.infer<typeof ubicacionSchema>;

interface UbicacionFormProps {
  ubicacion?: Ubicacion | null; // Current ubicacion being edited, or null for new
  allUbicaciones: Ubicacion[]; // For parent selection, should typically be Plantas
  preselectedParentId?: string; // If creating an IDF/MDF under a specific Planta
  onSuccess: () => void;
}

const NO_PARENT_VALUE = "__NO_PARENT__";

export function UbicacionForm({ ubicacion, allUbicaciones, preselectedParentId, onSuccess }: UbicacionFormProps) {
  const { toast } = useToast();
  const { userProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [currentTipo, setCurrentTipo] = useState<Ubicacion['tipo'] | undefined>(ubicacion?.tipo || (preselectedParentId ? UbicacionTipoEnum.Values.IDF : UbicacionTipoEnum.Values.Planta));

  const form = useForm<UbicacionFormValues>({
    resolver: zodResolver(ubicacionSchema),
    defaultValues: {
      nombre: ubicacion?.nombre || '',
      tipo: currentTipo,
      parentId: ubicacion?.parentId || preselectedParentId || null,
    },
  });
  
  useEffect(() => {
    // Update form default values if 'ubicacion' or 'preselectedParentId' prop changes
    form.reset({
      nombre: ubicacion?.nombre || '',
      tipo: ubicacion?.tipo || (preselectedParentId ? UbicacionTipoEnum.Values.IDF : UbicacionTipoEnum.Values.Planta),
      parentId: ubicacion?.parentId || preselectedParentId || null,
    });
    setCurrentTipo(ubicacion?.tipo || (preselectedParentId ? UbicacionTipoEnum.Values.IDF : UbicacionTipoEnum.Values.Planta));
  }, [ubicacion, preselectedParentId, form]);


  const onSubmit = async (data: UbicacionFormValues) => {
    if (!userProfile?.organizationId) {
      toast({ title: "Error", description: "Usuario no autenticado o sin organización.", variant: "destructive" });
      return;
    }
    setLoading(true);

    let finalData = { ...data };
    if (finalData.tipo === UbicacionTipoEnum.Values.Planta) {
      finalData.parentId = null; // Plantas cannot have parents
    } else if (!finalData.parentId && (finalData.tipo === UbicacionTipoEnum.Values.IDF || finalData.tipo === UbicacionTipoEnum.Values.MDF)) {
      toast({ title: "Error de Validación", description: "IDF/MDF debe tener una Planta principal seleccionada.", variant: "destructive" });
      setLoading(false);
      return;
    }


    try {
      if (ubicacion?.id) { // Editing existing ubicacion
        const ubicacionRef = doc(db, 'ubicaciones', ubicacion.id);
        await updateDoc(ubicacionRef, {
          ...finalData,
          updatedAt: serverTimestamp(),
        });
        toast({ title: "Éxito", description: "Ubicación actualizada correctamente." });
      } else { // Creating new ubicacion
        await addDoc(collection(db, 'ubicaciones'), {
          ...finalData,
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
  
  // Filter for parent options: only Plantas, and not self if editing
  const parentOptions = allUbicaciones.filter(u => u.tipo === 'Planta' && u.id !== ubicacion?.id);
  const availableTipos = ubicacion?.tipo === 'Planta' ? [UbicacionTipoEnum.Values.Planta] : Object.values(UbicacionTipoEnum.Values);
  const isParentFixed = !!preselectedParentId && !ubicacion?.id; // Parent is fixed if creating IDF/MDF under a Planta

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
                <Input placeholder={currentTipo === 'Planta' ? "Ej: Planta Chihuahua Norte" : "Ej: IDF Compras P1"} {...field} />
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
              <Select 
                onValueChange={(value) => {
                  field.onChange(value);
                  setCurrentTipo(value as Ubicacion['tipo']);
                  if (value === UbicacionTipoEnum.Values.Planta) {
                    form.setValue('parentId', null); // Reset parentId if type is Planta
                  }
                }} 
                defaultValue={field.value}
                disabled={!!ubicacion?.id && ubicacion.tipo === 'Planta'} // Cannot change type of existing Planta
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona un tipo" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {availableTipos.map((tipo) => (
                    <SelectItem key={tipo} value={tipo} disabled={ubicacion?.id && ubicacion.tipo === 'Planta' && tipo !== 'Planta'}>
                        {tipo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        {(currentTipo === UbicacionTipoEnum.Values.IDF || currentTipo === UbicacionTipoEnum.Values.MDF) && (
          <FormField
            control={form.control}
            name="parentId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Planta Principal</FormLabel>
                <Select 
                  onValueChange={(value) => field.onChange(value === NO_PARENT_VALUE ? null : value)} 
                  defaultValue={field.value ?? NO_PARENT_VALUE}
                  disabled={isParentFixed}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona la planta principal" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value={NO_PARENT_VALUE} disabled={currentTipo !== UbicacionTipoEnum.Values.Planta}>Ninguna (Solo para Plantas)</SelectItem>
                    {parentOptions.map((parent) => (
                      <SelectItem key={parent.id} value={parent.id}>
                        {parent.nombre} ({parent.tipo})
                      </SelectItem>
                    ))}
                    {parentOptions.length === 0 && <SelectItem value="" disabled>No hay Plantas disponibles</SelectItem>}
                  </SelectContent>
                </Select>
                {isParentFixed && <p className="text-xs text-muted-foreground mt-1">Asignado a: {allUbicaciones.find(p => p.id === preselectedParentId)?.nombre}</p>}
                <FormMessage />
              </FormItem>
            )}
          />
        )}
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
            {ubicacion?.id ? 'Guardar Cambios' : 'Crear Ubicación'}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );
}
