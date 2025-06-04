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
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { puertoSchema, PuertoTipoEnum, PuertoEstadoEnum } from '@/lib/schemas';
import type { Puerto, Nodo } from '@/types';
import { useAuth } from '@/contexts/auth-context';
import { db } from '@/lib/firebase/client';
import { collection, addDoc, doc, updateDoc, serverTimestamp, getDocs, query, where } from 'firebase/firestore';
import { useState } from 'react';
import { DialogFooter, DialogClose } from '@/components/ui/dialog';

type PuertoFormValues = z.infer<typeof puertoSchema>;

interface PuertoFormProps {
  equipoId: string;
  portNumber: number; // The physical port number on the equipment
  puerto?: Puerto | null; // Existing Puerto data if editing
  allNodos: Nodo[];
  onSuccess: () => void;
}

const NO_NODO_VALUE = "__NO_NODO__";

export function PortForm({ equipoId, portNumber, puerto, allNodos, onSuccess }: PuertoFormProps) {
  const { toast } = useToast();
  const { userProfile } = useAuth();
  const [loading, setLoading] = useState(false);

  const form = useForm<PuertoFormValues>({
    resolver: zodResolver(puertoSchema),
    defaultValues: {
      tipoPuerto: puerto?.tipoPuerto || PuertoTipoEnum.Values.RJ45,
      estado: puerto?.estado || PuertoEstadoEnum.Values.Libre,
      nodoId: puerto?.nodoId || null,
      vlanId: puerto?.vlanId || '',
      descripcionConexion: puerto?.descripcionConexion || '',
    },
  });

  const onSubmit = async (data: PuertoFormValues) => {
    if (!userProfile?.organizationId || !equipoId) {
      toast({ title: "Error", description: "Datos de sesión o equipo inválidos.", variant: "destructive" });
      return;
    }
    setLoading(true);

    const puertoData = {
      ...data,
      equipoId: equipoId,
      numeroPuerto: portNumber, // Use the passed portNumber
      organizationId: userProfile.organizationId,
      updatedAt: serverTimestamp(),
    };

    try {
      if (puerto) { // Editing existing puerto record
        const puertoRef = doc(db, 'puertos', puerto.id);
        await updateDoc(puertoRef, puertoData);
        toast({ title: "Éxito", description: `Puerto ${portNumber} actualizado.` });
      } else { // Creating new puerto record for this physical port
        // Check if a record for this port number already exists to avoid duplicates (should be handled by UI logic ideally)
        const q = query(collection(db, 'puertos'), 
            where('equipoId', '==', equipoId), 
            where('numeroPuerto', '==', portNumber),
            where('organizationId', '==', userProfile.organizationId)
        );
        const existingDocs = await getDocs(q);
        if (!existingDocs.empty) {
            // Update the first found existing document
            const existingDocId = existingDocs.docs[0].id;
            await updateDoc(doc(db, 'puertos', existingDocId), puertoData);
            toast({ title: "Éxito", description: `Puerto ${portNumber} configurado (registro existente actualizado).` });
        } else {
            await addDoc(collection(db, 'puertos'), puertoData);
            toast({ title: "Éxito", description: `Puerto ${portNumber} configurado.` });
        }
      }
      onSuccess();
    } catch (error: any) {
      console.error("Error saving puerto:", error);
      toast({ title: "Error", description: error.message || `No se pudo guardar el puerto ${portNumber}.`, variant: "destructive" });
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
                name="estado"
                render={({ field }) => (
                <FormItem>
                    <FormLabel>Estado del Puerto</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                        <SelectTrigger>
                        <SelectValue placeholder="Selecciona un estado" />
                        </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                        {Object.values(PuertoEstadoEnum.Values).map((estado) => (
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
                name="tipoPuerto"
                render={({ field }) => (
                <FormItem>
                    <FormLabel>Tipo de Puerto</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                        <SelectTrigger>
                        <SelectValue placeholder="Selecciona un tipo" />
                        </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                        {Object.values(PuertoTipoEnum.Values).map((tipo) => (
                        <SelectItem key={tipo} value={tipo}>{tipo}</SelectItem>
                        ))}
                    </SelectContent>
                    </Select>
                    <FormMessage />
                </FormItem>
                )}
            />
        </div>
        
        <FormField
          control={form.control}
          name="nodoId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nodo Conectado (Opcional)</FormLabel>
              <Select
                onValueChange={(value) => field.onChange(value === NO_NODO_VALUE ? null : value)}
                defaultValue={field.value ?? NO_NODO_VALUE}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona un nodo si está ocupado" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value={NO_NODO_VALUE}>Ninguno</SelectItem>
                  {allNodos.map((nodo) => (
                    <SelectItem key={nodo.id} value={nodo.id}>
                      {nodo.nombreHost} ({nodo.tipoDispositivo})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
            control={form.control}
            name="vlanId"
            render={({ field }) => (
                <FormItem>
                <FormLabel>VLAN ID (Opcional)</FormLabel>
                <FormControl>
                    <Input placeholder="Ej: 10, 20-25, Marketing" {...field} />
                </FormControl>
                <FormMessage />
                </FormItem>
            )}
        />

        <FormField
          control={form.control}
          name="descripcionConexion"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Descripción de Conexión (Opcional)</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Ej: Conectado a PC de Juan Perez en Oficina 101, Patch Panel A Fila 3 Puerto 5"
                  className="resize-none"
                  {...field}
                />
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
            Guardar Cambios
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );
}
