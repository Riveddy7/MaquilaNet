'use client';

import { useState, useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScanLine, MapPin, AlertTriangle, CheckCircle, ListChecks } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { rfidCensoSchema } from '@/lib/schemas';
import { useAuth } from '@/contexts/auth-context';
import { db } from '@/lib/firebase/client';
import { collection, query, where, onSnapshot, orderBy, addDoc, serverTimestamp } from 'firebase/firestore';
import type { Ubicacion, RfidCenso, Discrepancia } from '@/types';
import { processRfidCensus, type ProcessRfidCensusOutput } from '@/ai/flows/process-rfid-census-flow'; // Ensure path is correct
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

type RfidCensoFormValues = z.infer<typeof rfidCensoSchema>;

export default function InventarioRfidPage() {
  const { toast } = useToast();
  const { userProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [ubicaciones, setUbicaciones] = useState<Ubicacion[]>([]);
  const [censusResult, setCensusResult] = useState<ProcessRfidCensusOutput | null>(null);
  const [lastCensusDetails, setLastCensusDetails] = useState<{ubicacionNombre: string, tagsCount: number} | null>(null);


  const form = useForm<RfidCensoFormValues>({
    resolver: zodResolver(rfidCensoSchema),
    defaultValues: {
      ubicacionId: '',
      rfidTagsLeidos: '',
    },
  });

  useEffect(() => {
    if (!userProfile?.organizationId) return;
    setLoading(true);
    const q = query(
      collection(db, 'ubicaciones'),
      where('organizationId', '==', userProfile.organizationId),
      where('tipo', 'in', ['IDF', 'MDF']), // Only allow census on IDF/MDF
      orderBy('nombre')
    );
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const data: Ubicacion[] = [];
      querySnapshot.forEach((doc) => data.push({ id: doc.id, ...doc.data() } as Ubicacion));
      setUbicaciones(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [userProfile?.organizationId]);

  const onSubmit = async (data: RfidCensoFormValues) => {
    if (!userProfile) {
        toast({ title: "Error", description: "Usuario no autenticado.", variant: "destructive"});
        return;
    }
    setProcessing(true);
    setCensusResult(null); // Clear previous results
    setLastCensusDetails(null);

    try {
      const result = await processRfidCensus({
        ubicacionId: data.ubicacionId,
        rfidTagsLeidos: data.rfidTagsLeidos, // Zod transform handles array conversion
      });
      
      setCensusResult(result);
      const selectedUbicacion = ubicaciones.find(u => u.id === data.ubicacionId);
      setLastCensusDetails({
          ubicacionNombre: selectedUbicacion?.nombre || data.ubicacionId,
          tagsCount: data.rfidTagsLeidos.length
      });

      // Save census record to Firestore
      await addDoc(collection(db, 'rfid_censos'), {
        ubicacionId: data.ubicacionId,
        fechaInicio: serverTimestamp(), // Simplification, could be more precise
        fechaFin: serverTimestamp(),
        usuarioId: userProfile.id,
        tagsLeidos: data.rfidTagsLeidos,
        discrepancias: result.discrepancias,
        organizationId: userProfile.organizationId,
        faltantesCount: result.faltantesCount,
        noRegistradosCount: result.noRegistradosCount,
      } as Omit<RfidCenso, 'id' | 'fechaInicio' | 'fechaFin'> & { fechaInicio: any, fechaFin: any }); // Firestore handles serverTimestamps

      toast({ title: "Censo Procesado", description: "Resultados del censo RFID disponibles." });
      form.reset({ ubicacionId: data.ubicacionId, rfidTagsLeidos: '' }); // Keep location, clear tags

    } catch (error: any) {
      console.error("Error processing RFID census:", error);
      toast({ title: "Error en Censo", description: error.message || "No se pudo procesar el censo.", variant: "destructive" });
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="container mx-auto py-8">
      <Card className="max-w-2xl mx-auto shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center font-headline">
            <ScanLine className="mr-2 h-6 w-6 text-primary" />
            Iniciar Nuevo Censo RFID
          </CardTitle>
          <CardDescription>
            Selecciona una ubicación (IDF/MDF) y pega los IDs de los tags RFID leídos.
          </CardDescription>
        </CardHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <CardContent className="space-y-6">
              <FormField
                control={form.control}
                name="ubicacionId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center"><MapPin className="mr-1 h-4 w-4 text-muted-foreground"/>Ubicación a Censar (IDF/MDF)</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value} disabled={loading || ubicaciones.length === 0}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={loading ? "Cargando ubicaciones..." : "Selecciona una ubicación"} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {ubicaciones.map((loc) => (
                          <SelectItem key={loc.id} value={loc.id}>{loc.nombre} ({loc.tipo})</SelectItem>
                        ))}
                        {ubicaciones.length === 0 && !loading && <SelectItem value="" disabled>No hay IDF/MDFs disponibles</SelectItem>}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="rfidTagsLeidos"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center"><ListChecks className="mr-1 h-4 w-4 text-muted-foreground"/>Tags RFID Leídos</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Pega aquí los IDs de los tags RFID, separados por espacio, coma o nueva línea."
                        className="min-h-[150px] resize-y font-mono text-sm"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
            <CardFooter>
              <Button type="submit" className="w-full bg-accent hover:bg-accent/90 text-accent-foreground" disabled={processing || loading}>
                {processing ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-accent-foreground mr-2"></div>
                ) : null}
                {processing ? 'Procesando Censo...' : 'Procesar Censo'}
              </Button>
            </CardFooter>
          </form>
        </Form>
      </Card>

      {censusResult && lastCensusDetails && (
        <Card className="max-w-2xl mx-auto mt-8 shadow-lg">
          <CardHeader>
            <CardTitle className="font-headline">Resultados del Censo para: {lastCensusDetails.ubicacionNombre}</CardTitle>
            <CardDescription>Se leyeron {lastCensusDetails.tagsCount} tags RFID.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold flex items-center mb-2">
                  <AlertTriangle className="mr-2 h-5 w-5 text-destructive" />
                  Equipos FALTANTES ({censusResult.faltantesCount})
                </h3>
                {censusResult.faltantesCount > 0 ? (
                  <ul className="list-disc pl-5 space-y-1 text-sm text-destructive">
                    {censusResult.discrepancias.filter(d => d.tipo === 'FALTANTE').map((d, i) => (
                      <li key={`faltante-${i}`}>
                        ID Equipo: {d.equipoId || 'Desconocido'}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground flex items-center">
                    <CheckCircle className="mr-2 h-4 w-4 text-green-500" />
                    No se encontraron equipos faltantes.
                  </p>
                )}
              </div>
              <Separator />
              <div>
                <h3 className="text-lg font-semibold flex items-center mb-2">
                  <AlertTriangle className="mr-2 h-5 w-5 text-orange-500" />
                  Tags NO REGISTRADOS ({censusResult.noRegistradosCount})
                </h3>
                {censusResult.noRegistradosCount > 0 ? (
                  <ul className="list-disc pl-5 space-y-1 text-sm text-orange-600">
                    {censusResult.discrepancias.filter(d => d.tipo === 'NO_REGISTRADO').map((d, i) => (
                      <li key={`no-reg-${i}`}>
                        ID Tag RFID: <Badge variant="outline" className="font-mono">{d.rfidTagId}</Badge>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground flex items-center">
                     <CheckCircle className="mr-2 h-4 w-4 text-green-500" />
                    Todos los tags leídos están registrados.
                  </p>
                )}
              </div>
               <Separator />
               <p className="text-sm text-muted-foreground">
                El registro del censo ha sido guardado. Puedes consultar el historial de censos (próximamente).
               </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
