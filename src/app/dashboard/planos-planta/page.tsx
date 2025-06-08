
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
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
import { Progress } from '@/components/ui/progress';
import { FileText, UploadCloud, MapPin, Edit, Trash2, AlertTriangle, Eye, PlusCircle, Scan, Send } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { floorPlanSchema, locationMarkerSchema } from '@/lib/schemas';
import { useAuth } from '@/contexts/auth-context';
import { db, storage } from '@/lib/firebase/client';
import { collection, addDoc, serverTimestamp, query, where, onSnapshot, doc, updateDoc, deleteDoc, arrayUnion, arrayRemove, orderBy } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import type { FloorPlan, Ubicacion, LocationMarker } from '@/types';
import { v4 as uuidv4 } from 'uuid';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
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
} from "@/components/ui/alert-dialog";


pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`;

type FloorPlanFormValues = z.infer<typeof floorPlanSchema>;
type LocationMarkerFormValues = z.infer<typeof locationMarkerSchema>;

export default function PlanosPlantaPage() {
  const { toast } = useToast();
  const { userProfile } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [floorPlans, setFloorPlans] = useState<FloorPlan[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState<FloorPlan | null>(null);
  const [numPages, setNumPages] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [isAddingMarker, setIsAddingMarker] = useState(false);
  const [ubicaciones, setUbicaciones] = useState<Ubicacion[]>([]);
  const [showMarkerModal, setShowMarkerModal] = useState(false);
  const [markerCoords, setMarkerCoords] = useState<{ x: number; y: number } | null>(null);
  const pdfPageRef = useRef<HTMLDivElement>(null);
  const [triggeringWorkflow, setTriggeringWorkflow] = useState(false);

  const planForm = useForm<FloorPlanFormValues>({
    resolver: zodResolver(floorPlanSchema),
    defaultValues: { name: '' },
  });

  const markerForm = useForm<LocationMarkerFormValues>({
    resolver: zodResolver(locationMarkerSchema),
    defaultValues: { ubicacionId: '' },
  });

  useEffect(() => {
    if (!userProfile?.organizationId) return;
    setLoadingPlans(true);
    const q = query(
      collection(db, 'floorPlans'),
      where('organizationId', '==', userProfile.organizationId),
      orderBy('createdAt', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const plans: FloorPlan[] = [];
      snapshot.forEach(doc => plans.push({ id: doc.id, ...doc.data() } as FloorPlan));
      setFloorPlans(plans);
      setLoadingPlans(false);
    }, (error) => {
        console.error("Error fetching floor plans:", error);
        toast({title: "Error", description: "No se pudieron cargar los planos.", variant: "destructive"});
        setLoadingPlans(false);
    });

    const ubicacionesQuery = query(
      collection(db, 'ubicaciones'),
      where('organizationId', '==', userProfile.organizationId),
      where('tipo', 'in', ['IDF', 'MDF']),
      orderBy('nombre')
    );
    const unsubUbicaciones = onSnapshot(ubicacionesQuery, (snapshot) => {
      const ubiData: Ubicacion[] = [];
      snapshot.forEach(doc => ubiData.push({ id: doc.id, ...doc.data() } as Ubicacion));
      setUbicaciones(ubiData);
    }, (error) => {
        console.error("Error fetching ubicaciones:", error);
        toast({title: "Error", description: "No se pudieron cargar las ubicaciones IDF/MDF.", variant: "destructive"});
    });

    return () => {
      unsubscribe();
      unsubUbicaciones();
    };
  }, [userProfile?.organizationId, toast]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      if (event.target.files[0].type !== 'application/pdf') {
        toast({ title: "Archivo Inválido", description: "Por favor, selecciona un archivo PDF.", variant: "destructive" });
        event.target.value = ''; // Clear the input
        setFile(null);
        return;
      }
      if (event.target.files[0].size > 10 * 1024 * 1024) { // 10MB limit
        toast({ title: "Archivo Demasiado Grande", description: "El PDF no debe exceder los 10MB.", variant: "destructive" });
        event.target.value = ''; // Clear the input
        setFile(null);
        return;
      }
      setFile(event.target.files[0]);
    }
  };

  const handleUpload = async (data: FloorPlanFormValues) => {
    if (!file || !userProfile) {
        toast({ title: "Faltan Datos", description: "Por favor, selecciona un archivo PDF y asegúrate de haber iniciado sesión.", variant: "destructive" });
        return;
    }

    const floorPlanId = uuidv4();
    const storagePath = `floorPlans/${userProfile.organizationId}/${userProfile.id}/${floorPlanId}-${file.name}`;

    console.log('Attempting to upload with:', {
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        userId: userProfile.id,
        organizationId: userProfile.organizationId,
        storagePath: storagePath,
        floorPlanId: floorPlanId
    });
    
    setIsUploading(true);
    setUploadProgress(0);
    
    const storageRef = ref(storage, storagePath);
    const uploadTask = uploadBytesResumable(storageRef, file);

    uploadTask.on(
      'state_changed',
      (snapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        setUploadProgress(progress);
      },
      (error) => {
        console.error("Upload error:", error);
        toast({ title: "Error de Carga", description: `No se pudo subir el archivo PDF: ${error.message}`, variant: "destructive" });
        setIsUploading(false);
        setUploadProgress(null);
      },
      async () => {
        try {
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            await addDoc(collection(db, 'floorPlans'), {
              name: data.name,
              pdfUrl: downloadURL,
              pdfStoragePath: storagePath,
              organizationId: userProfile.organizationId,
              userId: userProfile.id,
              markers: [],
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            } as Omit<FloorPlan, 'id'>);
            toast({ title: "Éxito", description: "Plano de planta subido y guardado." });
            setFile(null);
            planForm.reset();
            const fileInput = document.getElementById('pdfFile') as HTMLInputElement;
            if(fileInput) fileInput.value = '';
        } catch (dbError: any) {
            console.error("Firestore error:", dbError);
            toast({ title: "Error de Base de Datos", description: `No se pudo guardar la información del plano: ${dbError.message}`, variant: "destructive" });
        } finally {
            setIsUploading(false);
            setUploadProgress(null);
        }
      }
    );
  };

  const handleDeletePlan = async (plan: FloorPlan) => {
    try {
      await deleteDoc(doc(db, 'floorPlans', plan.id));
      const fileRef = ref(storage, plan.pdfStoragePath);
      await deleteObject(fileRef);
      toast({ title: "Plano Eliminado", description: `"${plan.name}" ha sido eliminado.` });
      if (selectedPlan?.id === plan.id) {
        setSelectedPlan(null);
        setNumPages(null);
        setCurrentPage(1);
      }
    } catch (error: any) {
      console.error("Error deleting plan: ", error);
      toast({ title: "Error", description: `No se pudo eliminar el plano: ${error.message}`, variant: "destructive" });
    }
  };
  
  function onDocumentLoadSuccess({ numPages: nextNumPages }: { numPages: number }) {
    setNumPages(nextNumPages);
    setCurrentPage(1); 
  }

  const handlePdfPageClick = (event: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    if (!isAddingMarker || !pdfPageRef.current || !selectedPlan) return;
    const rect = pdfPageRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, ((event.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((event.clientY - rect.top) / rect.height) * 100));
    setMarkerCoords({ x, y });
    setShowMarkerModal(true);
    markerForm.reset({ ubicacionId: ''}); // Reset form for new marker
  };

  const handleSaveMarker = async (data: LocationMarkerFormValues) => {
    if (!selectedPlan || !markerCoords || !userProfile) return;
    const selectedUbicacion = ubicaciones.find(u => u.id === data.ubicacionId);
    if (!selectedUbicacion) {
      toast({ title: "Error", description: "Ubicación seleccionada no válida.", variant: "destructive" });
      return;
    }

    const newMarker: LocationMarker = {
      id: uuidv4(),
      x: markerCoords.x,
      y: markerCoords.y,
      ubicacionId: data.ubicacionId,
      ubicacionNombre: selectedUbicacion.nombre,
    };

    try {
      const planRef = doc(db, 'floorPlans', selectedPlan.id);
      await updateDoc(planRef, {
        markers: arrayUnion(newMarker),
        updatedAt: serverTimestamp(),
      });
      toast({ title: "Marcador Añadido", description: `Ubicación "${selectedUbicacion.nombre}" añadida al plano.` });
      // Optimistically update local state
      setSelectedPlan(prev => prev ? ({...prev, markers: [...prev.markers, newMarker]}) : null);
      setShowMarkerModal(false);
      markerForm.reset();
      setIsAddingMarker(false);
    } catch (error: any) {
      console.error("Error saving marker:", error);
      toast({ title: "Error", description: `No se pudo guardar el marcador: ${error.message}`, variant: "destructive" });
    }
  };

  const handleDeleteMarker = async (markerId: string) => {
    if (!selectedPlan) return;
    const markerToDelete = selectedPlan.markers.find(m => m.id === markerId);
    if (!markerToDelete) return;

    try {
      const planRef = doc(db, 'floorPlans', selectedPlan.id);
      await updateDoc(planRef, {
        markers: arrayRemove(markerToDelete),
        updatedAt: serverTimestamp(),
      });
      toast({ title: "Marcador Eliminado" });
      setSelectedPlan(prev => prev ? ({ ...prev, markers: prev.markers.filter(m => m.id !== markerId) }) : null);
    } catch (error: any) {
      console.error("Error deleting marker:", error);
      toast({ title: "Error", description: `No se pudo eliminar el marcador: ${error.message}`, variant: "destructive" });
    }
  };
  
  const handleTriggerWorkflow = async () => {
    if (!selectedPlan) {
        toast({ title: "Error", description: "No hay un plano seleccionado para escanear.", variant: "destructive" });
        return;
    }
    setTriggeringWorkflow(true);
    try {
      const response = await fetch('http://139.177.101.46:8989/trigger_workflow', { method: 'GET' });
      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`HTTP error ${response.status}: ${errorBody}`);
      }
      // Assuming the response is JSON, if not, use .text()
      const result = await response.json().catch(() => response.text());
      toast({ title: "Workflow Iniciado", description: "El proceso de escaneo ha comenzado. Respuesta: " + (typeof result === 'string' ? result : JSON.stringify(result))});
      console.log("Workflow trigger result:", result);
    } catch (error: any) {
      console.error("Error triggering workflow:", error);
      toast({ title: "Error de Workflow", description: `No se pudo iniciar el workflow: ${error.message}`, variant: "destructive" });
    } finally {
      setTriggeringWorkflow(false);
    }
  };

  const renderMarkers = () => {
    if (!selectedPlan || !pdfPageRef.current) return null;
    return selectedPlan.markers.map(marker => (
      <div
        key={marker.id}
        className="absolute transform -translate-x-1/2 -translate-y-1/2 cursor-default group"
        style={{ left: `${marker.x}%`, top: `${marker.y}%` }}
        title={`${marker.ubicacionNombre} (ID: ${marker.ubicacionId})`}
      >
        <MapPin className="h-6 w-6 text-red-600 fill-red-400 stroke-white stroke-1" />
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 ease-in-out
                        whitespace-nowrap bg-black/70 text-white text-xs rounded py-1 px-3 flex items-center">
          {marker.ubicacionNombre}
          <Button variant="ghost" size="sm" className="ml-2 p-0 h-auto text-destructive hover:text-destructive/80" onClick={(e) => {e.stopPropagation(); handleDeleteMarker(marker.id)}}>
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>
    ));
  };

  return (
    <div className="container mx-auto py-8 space-y-8">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center font-headline">
            <UploadCloud className="mr-2 h-6 w-6 text-primary" />
            Subir Nuevo Plano de Planta
          </CardTitle>
          <CardDescription>Sube un archivo PDF (máx 10MB) con el diseño de tu planta.</CardDescription>
        </CardHeader>
        <Form {...planForm}>
          <form onSubmit={planForm.handleSubmit(handleUpload)}>
            <CardContent className="space-y-4">
              <FormField
                control={planForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre del Plano</FormLabel>
                    <FormControl><Input placeholder="Ej: Planta Baja - Zona A" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormItem>
                <FormLabel htmlFor="pdfFile">Archivo PDF</FormLabel>
                <FormControl><Input id="pdfFile" type="file" accept="application/pdf" onChange={handleFileChange} /></FormControl>
                {file && <p className="text-sm text-muted-foreground">Archivo seleccionado: {file.name}</p>}
              </FormItem>
              {isUploading && uploadProgress !== null && (
                <Progress value={uploadProgress} className="w-full mt-2" />
              )}
            </CardContent>
            <CardFooter>
              <Button type="submit" disabled={!file || isUploading || !planForm.formState.isValid} className="bg-primary hover:bg-primary/90 text-primary-foreground">
                {isUploading ? `Subiendo... ${uploadProgress?.toFixed(0) ?? 0}%` : <><UploadCloud className="mr-2 h-4 w-4"/>Subir Plano</>}
              </Button>
            </CardFooter>
          </form>
        </Form>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-headline">Planos Existentes</CardTitle>
          <CardDescription>Selecciona un plano para ver, editar ubicaciones o escanear.</CardDescription>
        </CardHeader>
        <CardContent>
          {loadingPlans ? <p>Cargando planos...</p> :
            floorPlans.length === 0 ? <p>No hay planos subidos todavía.</p> :
            <ul className="space-y-2">
              {floorPlans.map(plan => (
                <li key={plan.id} className={`flex justify-between items-center p-3 border rounded-md hover:bg-muted/50 ${selectedPlan?.id === plan.id ? 'ring-2 ring-primary bg-muted/60' : ''}`}>
                  <span>{plan.name}</span>
                  <div className="space-x-2">
                    <Button variant="outline" size="sm" onClick={() => {setSelectedPlan(plan); setIsAddingMarker(false);}}><Eye className="mr-1 h-4 w-4"/> Ver</Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive/80"><Trash2 className="h-4 w-4"/></Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader><AlertDialogTitle>¿Estás seguro?</AlertDialogTitle><AlertDialogDescription>Esta acción eliminará permanentemente el plano "{plan.name}". Los marcadores asociados también se perderán.</AlertDialogDescription></AlertDialogHeader>
                        <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => handleDeletePlan(plan)} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">Eliminar</AlertDialogAction></AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </li>
              ))}
            </ul>
          }
        </CardContent>
      </Card>

      {selectedPlan && (
        <Card>
          <CardHeader>
            <CardTitle className="font-headline flex justify-between items-center">
              Visualizador: {selectedPlan.name}
              <div className="space-x-2">
                <Button onClick={() => setIsAddingMarker(prev => !prev)} variant={isAddingMarker ? "destructive" : "outline"} size="sm">
                  <MapPin className="mr-2 h-4 w-4"/> {isAddingMarker ? "Cancelar Marcador" : "Añadir Marcador"}
                </Button>
                <Button onClick={handleTriggerWorkflow} disabled={triggeringWorkflow} className="bg-accent hover:bg-accent/90 text-accent-foreground" size="sm">
                  <Scan className="mr-2 h-4 w-4"/> {triggeringWorkflow ? "Escaneando..." : "Escanear este Plano"}
                </Button>
              </div>
            </CardTitle>
            {isAddingMarker && <CardDescription className="text-primary font-semibold">Haz clic en el PDF para colocar un nuevo marcador de ubicación (IDF/MDF).</CardDescription>}
          </CardHeader>
          <CardContent>
            <div className="relative border rounded-md overflow-auto max-h-[70vh]" ref={pdfPageRef} onClick={handlePdfPageClick} style={{ cursor: isAddingMarker ? 'crosshair' : 'default' }}>
              {selectedPlan.pdfUrl ? (
                <Document file={selectedPlan.pdfUrl} onLoadSuccess={onDocumentLoadSuccess} onLoadError={(error) => toast({title: "Error PDF", description: `No se pudo cargar el PDF: ${error.message}`, variant: "destructive"})} loading="Cargando PDF...">
                  <Page pageNumber={currentPage} width={pdfPageRef.current?.offsetWidth ? Math.min(pdfPageRef.current.offsetWidth - 2, 1200) : 600} renderTextLayer={false} renderAnnotationLayer={false} />
                  {renderMarkers()}
                </Document>
              ) : <p>URL del PDF no disponible.</p>}
            </div>
            {numPages && numPages > 1 && (
              <div className="flex justify-center items-center space-x-2 mt-4">
                <Button onClick={() => setCurrentPage(p => Math.max(1, p -1))} disabled={currentPage <= 1}>Anterior</Button>
                <span>Página {currentPage} de {numPages}</span>
                <Button onClick={() => setCurrentPage(p => Math.min(numPages || 1, p + 1))} disabled={currentPage >= (numPages || 1)}>Siguiente</Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Dialog open={showMarkerModal} onOpenChange={setShowMarkerModal}>
        <DialogContent>
          <DialogHeader><DialogTitle>Asociar Ubicación a Marcador</DialogTitle></DialogHeader>
          <Form {...markerForm}>
            <form onSubmit={markerForm.handleSubmit(handleSaveMarker)} className="space-y-4">
              <FormField
                control={markerForm.control}
                name="ubicacionId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Seleccionar Ubicación (IDF/MDF)</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="Elige una ubicación existente" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {ubicaciones.length > 0 ? ubicaciones.map(ubi => (
                          <SelectItem key={ubi.id} value={ubi.id}>{ubi.nombre} ({ubi.tipo})</SelectItem>
                        )) : <SelectItem value="" disabled>No hay IDF/MDFs creados</SelectItem>}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                    <p className="text-xs text-muted-foreground mt-1">Coordenadas (X: {markerCoords?.x.toFixed(2)}%, Y: {markerCoords?.y.toFixed(2)}%)</p>
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => {setShowMarkerModal(false); markerForm.reset();}}>Cancelar</Button>
                <Button type="submit" disabled={!markerForm.formState.isValid}>Guardar Marcador</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

    </div>
  );
}

    