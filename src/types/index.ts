import type { Timestamp } from 'firebase/firestore';

export interface Organization {
  id: string;
  name: string;
  createdAt: Timestamp;
}

export interface UserProfile {
  id: string; // UID from Firebase Auth
  email: string | null;
  displayName: string | null;
  organizationId: string;
  role: 'admin' | 'engineer' | 'technician';
  createdAt: Timestamp;
}

export type UbicacionTipo = "Planta" | "Edificio" | "IDF" | "MDF" | "Rack";
export interface Ubicacion {
  id: string;
  nombre: string;
  tipo: UbicacionTipo;
  parentId?: string | null; // For hierarchical structure
  organizationId: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type EquipoTipo = "Switch" | "Router" | "Firewall" | "Server" | "Patch Panel";
export type EquipoEstado = "Activo" | "Inactivo" | "Mantenimiento";
export interface Equipo {
  id: string;
  nombre: string;
  tipo: EquipoTipo;
  marca?: string;
  modelo?: string;
  serialNumber?: string;
  assetTag?: string;
  ipGestion?: string;
  rfidTagId?: string;
  ubicacionId: string;
  rackPositionU?: number;
  estado: EquipoEstado;
  numeroDePuertos: number;
  organizationId: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type PuertoTipo = "RJ45" | "SFP" | "SFP+";
export type PuertoEstado = "Libre" | "Ocupado" | "Dañado" | "Mantenimiento";
export interface Puerto {
  id: string; // equipoId-numeroPuerto could be a unique ID
  equipoId: string;
  numeroPuerto: number;
  tipoPuerto: PuertoTipo;
  estado: PuertoEstado;
  nodoId?: string | null;
  vlanId?: string;
  descripcionConexion?: string;
  organizationId: string;
  updatedAt: Timestamp;
}

export type NodoTipoDispositivo = "PC" | "Impresora" | "Cámara IP" | "Máquina Industrial" | "Otro";
export interface Nodo {
  id: string;
  nombreHost: string;
  tipoDispositivo: NodoTipoDispositivo;
  ipAsignada?: string;
  macAddress?: string;
  usuarioResponsable?: string;
  ubicacionFisicaFinal?: string; // e.g., "Office 101"
  organizationId: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface RfidTag {
  id: string; // RFID Tag UUID
  equipoId?: string | null; // FK to equipo if associated
  organizationId: string;
  lastSeenAt?: Timestamp;
  lastSeenInUbicacionId?: string; // FK to ubicaciones
}

export interface Discrepancia {
  tipo: 'FALTANTE' | 'NO_REGISTRADO';
  equipoId?: string; // ID of missing equipment
  rfidTagId?: string; // Unregistered RFID tag ID
}
export interface RfidCenso {
  id: string;
  ubicacionId: string;
  fechaInicio: Timestamp;
  fechaFin: Timestamp;
  usuarioId: string; // User who performed the census
  tagsLeidos: string[];
  discrepancias: Discrepancia[];
  organizationId: string;
}
