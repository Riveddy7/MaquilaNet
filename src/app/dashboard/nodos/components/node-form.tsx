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
import { nodoSchema, NodoTipoDispositivoEnum } from '@/lib/schemas';
import type { Nodo } from '@/types';
import { useAuth } from '@/contexts/auth-context';
import { db } from '@/lib/firebase/client';
import { collection, addDoc, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { useState } from 'react';
import { DialogFooter, DialogClose } from '@/components/ui/dialog';

type NodoFormValues = z.infer<typeof nodoSchema>;

interface NodoFormProps {
  nodo?: Nodo | null;
  onSuccess: () => void;
}

export function NodoForm({ nodo, onSuccess }: NodoFormProps) {
  const { toast } = useToast();
  const { userProfile } = useAuth();
  const [loading, setLoading] = useState(false);

  const form = useForm<NodoFormValues>({
    resolver: zodResolver(nodoSchema),
    defaultValues: {
      nombreHost: nodo?.nombreHost || '',
      tipoDispositivo: nodo?.tipoDispositivo || NodoTipoDispositivoEnum.Values.PC,
      ipAsignada: nodo?.ipAsignada || '',
      macAddress: nodo?.macAddress || '',
      usuarioResponsable: nodo?.usuarioResponsable || '',
      ubicacionFisicaFinal: nodo?.ubicacionFisicaFinal || '',
    },
  });

  const onSubmit = async (data: NodoFormValues) => {
    if (!userProfile?.organizationId) {
      toast({ title: "Error", description: "Usuario no autenticado o sin organización.", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      if (nodo) { // Editing existing nodo
        const nodoRef = doc(db, 'nodos', nodo.id);
        await updateDoc(nodoRef, {
          ...data,
          updatedAt: serverTimestamp(),
        });
        toast({ title: "Éxito", description: "Nodo actualizado correctamente." });
      } else { // Creating new nodo
        await addDoc(collection(db, 'nodos'), {
          ...data,
          organizationId: userProfile.organizationId,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        toast({ title: "Éxito", description: "Nodo creado correctamente." });
      }
      onSuccess();
    } catch (error: any) {
      console.error("Error saving nodo:", error);
      toast({ title: "Error", description: error.message || "No se pudo guardar el nodo.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
                control={form.control}
                name="nombreHost"
                render={({ field }) => (
                <FormItem>
                    <FormLabel>Nombre del Host</FormLabel>
                    <FormControl>
                    <Input placeholder="Ej: PC-CONTABILIDAD-01" {...field} />
                    </FormControl>
                    <FormMessage />
                </FormItem>
                )}
            />
            <FormField
                control={form.control}
                name="tipoDispositivo"
                render={({ field }) => (
                <FormItem>
                    <FormLabel>Tipo de Dispositivo</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                        <SelectTrigger>
                        <SelectValue placeholder="Selecciona un tipo" />
                        </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                        {Object.values(NodoTipoDispositivoEnum.Values).map((tipo) => (
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
                name="ipAsignada"
                render={({ field }) => (
                <FormItem>
                    <FormLabel>IP Asignada (Opcional)</FormLabel>
                    <FormControl>
                    <Input placeholder="Ej: 192.168.1.100" {...field} />
                    </FormControl>
                    <FormMessage />
                </FormItem>
                )}
            />
            <FormField
                control={form.control}
                name="macAddress"
                render={({ field }) => (
                <FormItem>
                    <FormLabel>MAC Address (Opcional)</FormLabel>
                    <FormControl>
                    <Input placeholder="Ej: 00:1A:2B:3C:4D:5E" {...field} />
                    </FormControl>
                    <FormMessage />
                </FormItem>
                )}
            />
        </div>
        
        <FormField
            control={form.control}
            name="usuarioResponsable"
            render={({ field }) => (
                <FormItem>
                <FormLabel>Usuario Responsable (Opcional)</FormLabel>
                <FormControl>
                    <Input placeholder="Ej: Juan Pérez" {...field} />
                </FormControl>
                <FormMessage />
                </FormItem>
            )}
            />
        <FormField
            control={form.control}
            name="ubicacionFisicaFinal"
            render={({ field }) => (
                <FormItem>
                <FormLabel>Ubicación Física Final (Opcional)</FormLabel>
                <FormControl>
                    <Input placeholder="Ej: Oficina 101, Línea de Producción A" {...field} />
                </FormControl>
                <FormMessage />
                </FormItem>
            )}
        />

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
            {nodo ? 'Guardar Cambios' : 'Crear Nodo'}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );
}
