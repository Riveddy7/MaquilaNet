// port-form.tsx
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
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/auth-context';
import { puertoSchema, PuertoTipoEnum, PuertoEstadoEnum } from '@/lib/schemas';
import { useEffect, useState, useCallback } from 'react';
import type { AppPuerto } from './port-list'; // Assuming AppPuerto is exported from port-list.tsx
import type { AppNodo } from '@/app/(dashboard)/nodos/components/nodos-list'; // Assuming a similar type exists

type PuertoFormData = z.infer<typeof puertoSchema>;

interface PortFormProps {
  initialData?: AppPuerto;
  equipoId: string;
  onSubmitSuccess?: (puerto: AppPuerto) => void;
  onCancel?: () => void;
  // nodosList is fetched internally now
}

export function PortForm({ initialData, equipoId, onSubmitSuccess, onCancel }: PortFormProps) {
  const { toast } = useToast();
  const { user, userProfile } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [numeroPuertoField, setNumeroPuertoField] = useState<number | undefined>(initialData?.numeroPuerto);
  const [availableNodos, setAvailableNodos] = useState<AppNodo[]>([]);

  const form = useForm<PuertoFormData>({
    resolver: zodResolver(puertoSchema),
    defaultValues: {
      tipoPuerto: initialData?.tipoPuerto || undefined,
      estado: initialData?.estado || PuertoEstadoEnum.Enum.Libre,
      nodoId: initialData?.nodoId || null, // Ensure null for empty selection
      vlanId: initialData?.vlanId || '',
      descripcionConexion: initialData?.descripcionConexion || '',
    },
  });

  const fetchNodos = useCallback(async () => {
    if (!user || !userProfile?.organizationId) return;
    try {
      const token = await user.getIdToken();
      // Assuming /api/nodos returns all nodos for the organization
      const response = await fetch('/api/nodos', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!response.ok) throw new Error((await response.json()).error || 'Failed to fetch nodos');
      const nodosData: AppNodo[] = await response.json();
      setAvailableNodos(nodosData);
    } catch (error: any) {
      toast({ title: "Error", description: `No se pudieron cargar los nodos: ${error.message}`, variant: "destructive" });
    }
  }, [user, userProfile?.organizationId, toast]);

  useEffect(() => {
    fetchNodos(); // Fetch available nodos when form mounts or user changes
    if (initialData) {
      form.reset({
        tipoPuerto: initialData.tipoPuerto,
        estado: initialData.estado,
        nodoId: initialData.nodoId || null,
        vlanId: initialData.vlanId || '',
        descripcionConexion: initialData.descripcionConexion || '',
      });
      setNumeroPuertoField(initialData.numeroPuerto);
    } else {
      form.reset({
        tipoPuerto: undefined,
        estado: PuertoEstadoEnum.Enum.Libre,
        nodoId: null,
        vlanId: '',
        descripcionConexion: '',
      });
      setNumeroPuertoField(undefined);
    }
  }, [initialData, form, fetchNodos]);


  async function onSubmit(values: PuertoFormData) {
    if (!user) { toast({ title: "Error", description: "Debes iniciar sesión.", variant: "destructive" }); return; }

    if (!initialData && (numeroPuertoField === undefined || numeroPuertoField < 0)) {
      form.setError("numeroPuerto", { type: "manual", message: "Número de puerto es requerido y debe ser positivo." });
      // toast({ title: "Error de validación", description: "Número de puerto es requerido y debe ser positivo.", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);

    const method = initialData ? 'PUT' : 'POST';
    const url = initialData ? `/api/puertos/${initialData.id}` : '/api/puertos';

    let payload: any = { ...values };
    if (!initialData) { // Create mode
      payload.equipoId = equipoId;
      payload.numeroPuerto = numeroPuertoField;
    }
    // For PUT, API expects all fields from puertoSchema. `equipoId` and `numeroPuerto` are not part of the PUT body.

    try {
      const token = await user.getIdToken();
      const response = await fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      const responseData = await response.json();
      if (!response.ok) throw new Error(responseData.error || 'Operation failed');

      toast({ title: `Puerto ${initialData ? 'actualizado' : 'creado'}`, description: `El puerto #${initialData ? initialData.numeroPuerto : numeroPuertoField} ha sido ${initialData ? 'actualizado' : 'creado'} correctamente.` });
      if (onSubmitSuccess) onSubmitSuccess(responseData as AppPuerto);
    } catch (error: any) {
      console.error(`Error ${initialData ? 'updating' : 'creating'} port:`, error)
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 p-1">
        {initialData ? (
            <FormItem>
                <FormLabel>Número de Puerto</FormLabel>
                <Input type="number" value={initialData.numeroPuerto} disabled className="bg-muted" />
                <FormDescription>El número de puerto no se puede cambiar una vez creado.</FormDescription>
            </FormItem>
        ) : (
          <FormField
            // This is not part of Zod schema, so direct control
            name="numeroPuerto" // Not used by react-hook-form directly here
            render={({ fieldState }) => ( // Use fieldState for error display if needed
              <FormItem>
                <FormLabel>Número de Puerto</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    placeholder="Ej: 1"
                    value={numeroPuertoField === undefined ? '' : numeroPuertoField}
                    onChange={(e) => setNumeroPuertoField(e.target.value === '' ? undefined : parseInt(e.target.value, 10))}
                    min="0"
                  />
                </FormControl>
                {form.formState.errors.numeroPuerto && <FormMessage>{form.formState.errors.numeroPuerto.message}</FormMessage>}
                {!form.formState.errors.numeroPuerto && <FormDescription>Número físico del puerto en el equipo.</FormDescription>}
              </FormItem>
            )}
          />
        )}

        <FormField control={form.control} name="tipoPuerto" render={({ field }) => (
            <FormItem>
                <FormLabel>Tipo de Puerto</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Selecciona un tipo" /></SelectTrigger></FormControl>
                    <SelectContent>{PuertoTipoEnum.options.map(o=><SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                </Select>
                <FormMessage />
            </FormItem>
        )} />
        <FormField control={form.control} name="estado" render={({ field }) => (
            <FormItem>
                <FormLabel>Estado del Puerto</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Selecciona un estado" /></SelectTrigger></FormControl>
                    <SelectContent>{PuertoEstadoEnum.options.map(o=><SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                </Select>
                <FormMessage />
            </FormItem>
        )} />
        <FormField control={form.control} name="nodoId" render={({ field }) => (
            <FormItem>
                <FormLabel>Nodo Conectado (Opcional)</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value ?? undefined} value={field.value ?? undefined}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Ninguno (o selecciona un nodo)" /></SelectTrigger></FormControl>
                    <SelectContent>
                        <SelectItem value="null">Ninguno</SelectItem> {/* Allow unsetting */}
                        {availableNodos.map(nodo => (
                            <SelectItem key={nodo.id} value={nodo.id}>{nodo.nombreHost} ({nodo.ipAsignada || 'No IP'})</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <FormDescription>Dispositivo final conectado a este puerto, si aplica.</FormDescription>
                <FormMessage />
            </FormItem>
        )} />
        <FormField control={form.control} name="vlanId" render={({ field }) => (
            <FormItem>
                <FormLabel>VLAN ID (Opcional)</FormLabel>
                <FormControl><Input placeholder="Ej: 100, 200-205" {...field} value={field.value ?? ''} /></FormControl>
                <FormDescription>Identificador de VLAN para este puerto.</FormDescription>
                <FormMessage />
            </FormItem>
        )} />
        <FormField control={form.control} name="descripcionConexion" render={({ field }) => (
            <FormItem>
                <FormLabel>Descripción de Conexión (Opcional)</FormLabel>
                <FormControl><Textarea placeholder="Detalles de la conexión, ej: Patch Panel A3, P24 -> User Desk 101" {...field} value={field.value ?? ''} /></FormControl>
                <FormMessage />
            </FormItem>
        )} />
        <div className="flex justify-end space-x-2 pt-4">
            {onCancel && <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>Cancelar</Button>}
            <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Guardando...' : (initialData ? 'Actualizar Puerto' : 'Crear Puerto')}</Button>
        </div>
      </form>
    </Form>
  );
}
