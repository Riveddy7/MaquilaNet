// src/app/(dashboard)/ubicaciones/components/location-form.tsx (Conceptual Refactor)
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
import { useAuth } from '@/contexts/auth-context';
import { useRouter } from 'next/navigation'; // Or handle navigation via callback
import { ubicacionSchema, UbicacionTipoEnum } from '@/lib/schemas';
import { useEffect, useState } from 'react';

// Type for the ubicacion data that the form handles and API returns
interface AppUbicacion {
  id: string;
  nombre: string;
  tipo: z.infer<typeof UbicacionTipoEnum>;
  parentId?: string | null;
  organizationId?: string; // May not be part of form, but part of AppUbicacion
  // other fields if necessary
}

type UbicacionFormData = z.infer<typeof ubicacionSchema>;

interface LocationFormProps {
  initialData?: AppUbicacion;
  onSubmitSuccess?: (ubicacion: AppUbicacion) => void;
  // We might also need a list of possible parent ubicaciones to select from
  // parentUbicaciones?: { id: string; nombre: string }[];
}

export function LocationForm({ initialData, onSubmitSuccess }: LocationFormProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const router = useRouter(); // Example for navigation
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<UbicacionFormData>({
    resolver: zodResolver(ubicacionSchema),
    defaultValues: {
      nombre: initialData?.nombre || '',
      tipo: initialData?.tipo || undefined, // Ensure valid enum value or undefined
      parentId: initialData?.parentId || null,
    },
  });

  useEffect(() => {
    if (initialData) {
      form.reset({
        nombre: initialData.nombre,
        tipo: initialData.tipo,
        parentId: initialData.parentId || null,
      });
    }
  }, [initialData, form]);


  async function onSubmit(values: UbicacionFormData) {
    if (!user) {
      toast({ title: "Error", description: "Debes iniciar sesión.", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    try {
      const token = await user.getIdToken();
      const method = initialData ? 'PUT' : 'POST';
      const url = initialData ? `/api/ubicaciones/${initialData.id}` : '/api/ubicaciones';

      const response = await fetch(url, {
        method: method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(values),
      });

      const responseData = await response.json();

      if (!response.ok) {
        throw new Error(responseData.error || `Failed to ${initialData ? 'update' : 'create'} ubicacion`);
      }

      toast({
        title: `Ubicación ${initialData ? 'actualizada' : 'creada'}`,
        description: `La ubicación "${responseData.nombre}" ha sido ${initialData ? 'actualizada' : 'creada'} exitosamente.`,
      });

      if (onSubmitSuccess) {
        onSubmitSuccess(responseData as AppUbicacion);
      } else {
        // Default navigation if no callback
        router.push('/dashboard/ubicaciones');
        router.refresh(); // Important to see changes if list page doesn't auto-revalidate aggressively
      }

    } catch (error: any) {
      console.error("Error submitting location form:", error);
      toast({
        title: "Error",
        description: error.message || `No se pudo ${initialData ? 'actualizar' : 'crear'} la ubicación.`,
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
              <FormLabel>Nombre de la Ubicación</FormLabel>
              <FormControl>
                <Input placeholder="Ej: Edificio Central - Rack A1" {...field} />
              </FormControl>
              <FormDescription>
                El nombre descriptivo de la ubicación.
              </FormDescription>
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
                  {UbicacionTipoEnum.options.map(option => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormDescription>
                Clasifica el tipo de ubicación.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="parentId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Ubicación Padre (Opcional)</FormLabel>
              <FormControl>
                {/* This should ideally be a Select populated with other ubicaciones from the API */}
                <Input placeholder="ID de la ubicación padre (si aplica)" {...field} value={field.value ?? ''} />
              </FormControl>
              <FormDescription>
                Si esta ubicación está dentro de otra (ej: un Rack dentro de un IDF).
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Guardando...' : (initialData ? 'Actualizar Ubicación' : 'Crear Ubicación')}
        </Button>
      </form>
    </Form>
  );
}
