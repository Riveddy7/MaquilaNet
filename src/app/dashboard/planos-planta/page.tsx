'use client';

import { useState, useEffect, useRef } from 'react';
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
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Construction, Upload, MapPin, Trash2, Eye, XCircle, CheckCircle, MousePointerSquare, Scan } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { floorPlanSchema, locationMarkerSchema } from '@/lib/schemas';
import { useAuth } from '@/contexts/auth-context';
import { db, storage } from '@/lib/firebase/client';
import { collection, query, where, onSnapshot, orderBy, addDoc, serverTimestamp, doc, updateDoc, deleteDoc, getDocs } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from "firebase/storage";
import type { FloorPlan, Ubicacion, LocationMarker } from '@/types';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';
import { v4 as uuidv4 } from 'uuid';

pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

type FloorPlanFormValues = z.infer<typeof floorPlanSchema>;

export default function PlanosPlantaPage() {
  const { toast } = useToast();
  const { userProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [floorPlans, setFloorPlans] = useState<FloorPlan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<FloorPlan | null>(null);
  const [numPages, setNumPages] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [ubicaciones, setUbicaciones] = useState<Ubicacion[]>([]); // For dropdown
  const [selectedUbicacionId, setSelectedUbicacionId] = useState<string | null>(null);
  const pdfContainerRef = useRef<HTMLDivElement>(null);

  const form = useForm<FloorPlanFormValues>({
    resolver: zodResolver(floorPlanSchema),
    defaultValues: {
      name: '',
      pdfFile: undefined,
    },
  });

  // Fetch floor plans
  useEffect(() => {
    if (!userProfile?.organizationId) return;
    setLoading(true);
    const q = query(
      collection(db, 'floorPlans'),
      where('organizationId', '==', userProfile.organizationId),
      orderBy('createdAt', 'desc')
    );
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const data: FloorPlan[] = [];
      querySnapshot.forEach((doc) => data.push({ id: doc.id, ...doc.data() } as FloorPlan));
      setFloorPlans(data);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching floor plans:", error);
      toast({ title: "Error", description: "No se pudieron cargar los planos.", variant: "destructive"});
      setLoading(false);
    });
    return () => unsubscribe();
  }, [userProfile?.organizationId, toast]);

  // Fetch ubicaciones (IDF/MDF) for marker association
  useEffect(() => {
    if (!userProfile?.organizationId) return;
    const q = query(
      collection(db, 'ubicaciones'),
      where('organizationId', '==', userProfile.organizationId),
      where('tipo', 'in', ['IDF', 'MDF']),
      orderBy('nombre')
    );
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const data: Ubicacion[] = [];
      querySnapshot.forEach((doc) => data.push({ id: doc.id, ...doc.data() } as Ubicacion));
      setUbicaciones(data);
    });
    return () => unsubscribe();
  }, [userProfile?.organizationId]);


  const handleUpload = async (data: FloorPlanFormValues) => {
    if (!userProfile || !data.pdfFile) {
      toast({ title: "Error", description: "Faltan datos para la subida.", variant: "destructive" });
      return;
    }
    setUploading(true);
    const file = data.pdfFile;
    const floorPlanId = uuidv4();
    const storagePath = `floorPlans/${userProfile.organizationId}/${userProfile.id}/${floorPlanId}-${file.name}`;
    const storageRef = ref(storage, storagePath);
    
    console.log("Attempting to upload with:", {
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        userId: userProfile.id,
        organizationId: userProfile.organizationId,
        storagePath: storagePath,
        floorPlanId: floorPlanId
    });

    try {
      const uploadTask = uploadBytesResumable(storageRef, file);
      uploadTask.on('state_changed',
        (snapshot) => { /* progress */ },
        (error) => {
          console.error("Upload error:", error);
          toast({ title: "Error de Subida", description: `Storage: ${error.message}`, variant: "destructive" });
          setUploading(false);
        },
        async () => {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          const newFloorPlan: Omit<FloorPlan, 'id' | 'createdAt'> = {
            name: data.name,
            pdfUrl: downloadURL,
            storagePath: storagePath,
            organizationId: userProfile.organizationId,
            userId: userProfile.id,
            markers: [],
            // createdAt will be set by serverTimestamp
          };
          await addDoc(collection(db, 'floorPlans'), { ...newFloorPlan, createdAt: serverTimestamp() });
          toast({ title: "Éxito", description: "Plano subido y guardado." });
          form.reset();
          setUploading(false);
        }
      );
    } catch (error: any) {
      console.error("Error saving floor plan:", error);
      toast({ title: "Error", description: error.message || "No se pudo guardar el plano.", variant: "destructive" });
      setUploading(false);
    }
  };

  const handleDeletePlan = async (plan: FloorPlan) => {
    if (!userProfile) return;
    try {
      // Delete from Firestore
      await deleteDoc(doc(db, 'floorPlans', plan.id));
      // Delete from Storage
      const fileRef = ref(storage, plan.storagePath);
      await deleteObject(fileRef);
      toast({ title: "Plano Eliminado", description: `El plano "${plan.name}" ha sido eliminado.` });
      if(selectedPlan?.id === plan.id) setSelectedPlan(null);
    } catch (error:any) {
      console.error("Error deleting plan: ", error);
      toast({ title: "Error", description: `No se pudo eliminar el plano: ${error.message}`, variant: "destructive" });
    }
  };
  
  function onDocumentLoadSuccess({ numPages: nextNumPages }: { numPages: number }) {
    setNumPages(nextNumPages);
    setCurrentPage(1); // Reset to first page on new document load
  }

  const handlePdfClick = async (event: React.MouseEvent<HTMLDivElement>) => {
    if (!selectedPlan || !selectedUbicacionId || !pdfContainerRef.current) return;

    const rect = pdfContainerRef.current.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100; // Percentage
    const y = ((event.clientY - rect.top) / rect.height) * 100; // Percentage

    const newMarker: LocationMarker = {
      id: uuidv4(),
      ubicacionId: selectedUbicacionId,
      x: parseFloat(x.toFixed(2)),
      y: parseFloat(y.toFixed(2)),
      pageNumber: currentPage,
    };

    const planRef = doc(db, 'floorPlans', selectedPlan.id);
    await updateDoc(planRef, {
      markers: [...(selectedPlan.markers || []), newMarker]
    });
    toast({ title: "Marcador Añadido", description: `Ubicación marcada en el plano.` });
    setSelectedUbicacionId(null); // Reset selection
  };

  const handleDeleteMarker = async (markerId: string) => {
    if (!selectedPlan) return;
    const updatedMarkers = selectedPlan.markers.filter(m => m.id !== markerId);
    const planRef = doc(db, 'floorPlans', selectedPlan.id);
    await updateDoc(planRef, { markers: updatedMarkers });
    toast({ title: "Marcador Eliminado" });
  };
  
  const handleScanWorkflow = async () => {
    if (!selectedPlan) {
        toast({ title: "Error", description: "Ningún plano seleccionado para escanear.", variant: "destructive" });
        return;
    }
    setLoading(true);
    toast({ title: "Iniciando Escaneo", description: "Activando el workflow de escaneo..." });
    try {
        const response = await fetch('http://139.177.101.46:8989/trigger_workflow', { method: 'GET' });
        if (!response.ok) {
            throw new Error(`Error del servidor: ${response.status} ${response.statusText}`);
        }
        const result = await response.json(); // O response.text() si no es JSON
        toast({ title: "Workflow Activado", description: `Respuesta: ${JSON.stringify(result)}` });
    } catch (error: any) {
        console.error("Error triggering workflow:", error);
        toast({ title: "Error de Workflow", description: error.message || "No se pudo activar el workflow.", variant: "destructive" });
    } finally {
        setLoading(false);
    }
  };


  return (
    <div className="container mx-auto py-8 space-y-8">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center font-headline">
            <Construction className="mr-2 h-6 w-6 text-primary" />
            Gestión de Planos de Planta
          </CardTitle>
          <CardDescription>
            Sube y administra los planos de tus plantas. Marca ubicaciones (IDF/MDF) sobre ellos.
          </CardDescription>
        </CardHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleUpload)}>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre del Plano</FormLabel>
                    <FormControl><Input placeholder="Ej: Plano Planta Principal - Nivel 1" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="pdfFile"
                render={({ field: { onChange, value, ...rest } }) => (
                  <FormItem>
                    <FormLabel>Archivo PDF del Plano</FormLabel>
                    <FormControl>
                      <Input type="file" accept="application/pdf" onChange={(e) => onChange(e.target.files?.[0])} {...rest} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
            <CardFooter>
              <Button type="submit" disabled={uploading || !userProfile} className="w-full md:w-auto">
                {uploading ? <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-primary-foreground mr-2"></div> : <Upload className="mr-2 h-4 w-4" />}
                {uploading ? 'Subiendo Plano...' : 'Subir Plano'}
              </Button>
            </CardFooter>
          </form>
        </Form>
      </Card>

      {loading && !floorPlans.length && <p>Cargando planos...</p>}
      {!loading && floorPlans.length === 0 && <p className="text-center text-muted-foreground">No hay planos cargados aún.</p>}

      {floorPlans.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Planos Existentes</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {floorPlans.map(plan => (
              <div key={plan.id} className="flex items-center justify-between p-2 border rounded-md">
                <span>{plan.name}</span>
                <div className="space-x-2">
                  <Button variant="outline" size="sm" onClick={() => {setSelectedPlan(plan); setCurrentPage(1);}}>
                    <Eye className="mr-1 h-4 w-4" /> Ver/Marcar
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" size="sm"><Trash2 className="mr-1 h-4 w-4" /> Eliminar</Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader><AlertDialogTitle>¿Seguro que quieres eliminar este plano?</AlertDialogTitle>
                        <AlertDialogDescription>Esta acción es irreversible y eliminará el archivo PDF y todos sus marcadores asociados.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDeletePlan(plan)} className="bg-destructive hover:bg-destructive/90">Confirmar Eliminación</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {selectedPlan && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
                <CardTitle>Visualizador: {selectedPlan.name}</CardTitle>
                <CardDescription>
                    Haz clic en el plano para añadir un marcador. Página {currentPage} de {numPages || '...'}
                </CardDescription>
            </div>
            <Button onClick={handleScanWorkflow} disabled={loading} className="bg-accent hover:bg-accent/90 text-accent-foreground">
                <Scan className="mr-2 h-4 w-4" /> {loading ? "Activando..." : "Escanear con este Plano"}
            </Button>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-3 relative border rounded-md overflow-hidden" ref={pdfContainerRef}>
                {selectedPlan.pdfUrl && (
                  <Document
                    file={selectedPlan.pdfUrl}
                    onLoadSuccess={onDocumentLoadSuccess}
                    onLoadError={(error) => toast({ title: "Error PDF", description: `No se pudo cargar PDF: ${error.message}`, variant: "destructive"})}
                    loading={<div className="p-4 text-center">Cargando PDF...</div>}
                  >
                    <div onClick={selectedUbicacionId ? handlePdfClick : undefined} style={{ cursor: selectedUbicacionId ? 'crosshair' : 'default', position: 'relative' }}>
                      <Page pageNumber={currentPage} width={pdfContainerRef.current?.clientWidth || 600} />
                      {selectedPlan.markers?.filter(m => m.pageNumber === currentPage).map(marker => (
                        <div key={marker.id}
                             title={ubicaciones.find(u=>u.id === marker.ubicacionId)?.nombre || marker.ubicacionId}
                             style={{ 
                                position: 'absolute', 
                                left: `${marker.x}%`, 
                                top: `${marker.y}%`,
                                transform: 'translate(-50%, -50%)',
                             }}
                             className="p-1 bg-primary rounded-full shadow-lg group hover:bg-red-500 transition-colors"
                        >
                          <MapPin className="h-5 w-5 text-primary-foreground" />
                          <button onClick={(e) => {e.stopPropagation(); handleDeleteMarker(marker.id);}} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <XCircle className="h-3 w-3"/>
                          </button>
                        </div>
                      ))}
                    </div>
                  </Document>
                )}
                {numPages && numPages > 1 && (
                  <div className="flex justify-center items-center space-x-2 mt-2">
                    <Button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage <= 1}>Anterior</Button>
                    <span>Pág {currentPage} / {numPages}</span>
                    <Button onClick={() => setCurrentPage(p => Math.min(numPages, p + 1))} disabled={currentPage >= numPages}>Siguiente</Button>
                  </div>
                )}
              </div>
              <div className="md:col-span-1 space-y-4">
                <h3 className="font-semibold flex items-center"><MousePointerSquare className="mr-2 h-5 w-5 text-primary"/> Añadir Marcador</h3>
                <Select onValueChange={setSelectedUbicacionId} value={selectedUbicacionId || ""}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona IDF/MDF a marcar" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="" disabled>Selecciona una ubicación</SelectItem>
                    {ubicaciones.map(u => (
                      <SelectItem key={u.id} value={u.id}>{u.nombre} ({u.tipo})</SelectItem>
                    ))}
                    {ubicaciones.length === 0 && <SelectItem value="" disabled>No hay IDF/MDFs</SelectItem>}
                  </SelectContent>
                </Select>
                {selectedUbicacionId && <p className="text-sm text-primary">Haz clic en el plano para colocar: <span className="font-bold">{ubicaciones.find(u=>u.id === selectedUbicacionId)?.nombre}</span></p>}
                
                <h4 className="font-semibold mt-4 pt-4 border-t">Marcadores en Página Actual:</h4>
                {selectedPlan.markers?.filter(m => m.pageNumber === currentPage).length === 0 && <p className="text-xs text-muted-foreground">No hay marcadores en esta página.</p>}
                <ul className="space-y-1 text-sm max-h-60 overflow-y-auto">
                  {selectedPlan.markers?.filter(m => m.pageNumber === currentPage).map(marker => (
                    <li key={marker.id} className="flex items-center justify-between text-xs p-1 hover:bg-muted rounded">
                      <span>{ubicaciones.find(u=>u.id === marker.ubicacionId)?.nombre || marker.ubicacionId}</span>
                      <button onClick={() => handleDeleteMarker(marker.id)} className="text-destructive hover:text-destructive/70"><Trash2 className="h-3 w-3"/></button>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
