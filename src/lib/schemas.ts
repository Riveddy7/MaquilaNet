import * as z from 'zod';

export const UbicacionTipoEnum = z.enum(["Planta", "Edificio", "IDF", "MDF", "Rack"]);
export const EquipoTipoEnum = z.enum(["Switch", "Router", "Firewall", "Server", "Patch Panel"]);
export const EquipoEstadoEnum = z.enum(["Activo", "Inactivo", "Mantenimiento"]);
export const PuertoTipoEnum = z.enum(["RJ45", "SFP", "SFP+"]);
export const PuertoEstadoEnum = z.enum(["Libre", "Ocupado", "Dañado", "Mantenimiento"]);
export const NodoTipoDispositivoEnum = z.enum(["PC", "Impresora", "Cámara IP", "Máquina Industrial", "Otro"]);

export const ubicacionSchema = z.object({
  nombre: z.string().min(2, { message: "Nombre debe tener al menos 2 caracteres." }),
  tipo: UbicacionTipoEnum,
  parentId: z.string().optional().nullable(),
});

export const equipoSchema = z.object({
  nombre: z.string().min(2, { message: "Nombre debe tener al menos 2 caracteres." }),
  tipo: EquipoTipoEnum,
  marca: z.string().optional(),
  modelo: z.string().optional(),
  serialNumber: z.string().optional(),
  assetTag: z.string().optional(),
  ipGestion: z.string().ip({ version: "v4", message: "IP de gestión inválida." }).optional().or(z.literal("")),
  rfidTagId: z.string().optional(),
  // ubicacionId will be passed as a prop or from route, not part of the form directly usually
  rackPositionU: z.number().int().min(1).optional().nullable(),
  estado: EquipoEstadoEnum,
  numeroDePuertos: z.number().int().min(0, { message: "Número de puertos debe ser 0 o más." }),
});

export const puertoSchema = z.object({
  // equipoId and numeroPuerto usually fixed or contextually determined
  tipoPuerto: PuertoTipoEnum,
  estado: PuertoEstadoEnum,
  nodoId: z.string().optional().nullable(),
  vlanId: z.string().optional(),
  descripcionConexion: z.string().optional(),
});

export const nodoSchema = z.object({
  nombreHost: z.string().min(2, { message: "Nombre de host debe tener al menos 2 caracteres." }),
  tipoDispositivo: NodoTipoDispositivoEnum,
  ipAsignada: z.string().ip({ version: "v4", message: "IP asignada inválida." }).optional().or(z.literal("")),
  macAddress: z.string().regex(/^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/, { message: "MAC address inválida."}).optional().or(z.literal("")),
  usuarioResponsable: z.string().optional(),
  ubicacionFisicaFinal: z.string().optional(),
});

export const rfidCensoSchema = z.object({
  ubicacionId: z.string().min(1, { message: "Debe seleccionar una ubicación." }),
  rfidTagsLeidos: z.string().min(1, { message: "Debe ingresar al menos un tag RFID." })
    .transform(val => val.split(/[\s,]+/).map(tag => tag.trim()).filter(tag => tag.length > 0)), // Split by space or comma, trim, remove empty
});
