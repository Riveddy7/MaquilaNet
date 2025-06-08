-- Main database schema for MySQL migration

-- Organizations table
CREATE TABLE organizations (
    id VARCHAR(36) NOT NULL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Users table (linked to Firebase Auth UID)
CREATE TABLE users (
    id VARCHAR(36) NOT NULL PRIMARY KEY, -- Firebase Auth User ID (UID)
    organizationId VARCHAR(36) NOT NULL,
    displayName VARCHAR(255),
    email VARCHAR(255) UNIQUE, -- Store email for easier reference, though auth is Firebase
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (organizationId) REFERENCES organizations(id) ON DELETE CASCADE
);

-- Ubicaciones (Locations) table
CREATE TABLE ubicaciones (
    id VARCHAR(36) NOT NULL PRIMARY KEY,
    nombre VARCHAR(255) NOT NULL,
    tipo ENUM('Planta', 'Edificio', 'IDF', 'MDF', 'Rack') NOT NULL,
    parentId VARCHAR(36),
    organizationId VARCHAR(36) NOT NULL,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (parentId) REFERENCES ubicaciones(id) ON DELETE SET NULL, -- Allow parent to be null, or on delete set null
    FOREIGN KEY (organizationId) REFERENCES organizations(id) ON DELETE CASCADE
);

-- Equipos (Equipment) table
CREATE TABLE equipos (
    id VARCHAR(36) NOT NULL PRIMARY KEY,
    nombre VARCHAR(255) NOT NULL,
    tipo ENUM('Switch', 'Router', 'Firewall', 'Server', 'Patch Panel') NOT NULL,
    marca VARCHAR(255),
    modelo VARCHAR(255),
    serialNumber VARCHAR(255) UNIQUE,
    assetTag VARCHAR(255) UNIQUE,
    ipGestion VARCHAR(45), -- Increased size for potential future IPv6, though schema was v4
    rfidTagId VARCHAR(255) UNIQUE,
    ubicacionId VARCHAR(36) NOT NULL,
    rackPositionU INT,
    estado ENUM('Activo', 'Inactivo', 'Mantenimiento') NOT NULL,
    numeroDePuertos INT NOT NULL DEFAULT 0,
    organizationId VARCHAR(36) NOT NULL,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (ubicacionId) REFERENCES ubicaciones(id) ON DELETE RESTRICT, -- Don't delete ubicacion if an equipo is still there
    FOREIGN KEY (organizationId) REFERENCES organizations(id) ON DELETE CASCADE
);

-- Puertos (Ports) table
CREATE TABLE puertos (
    id VARCHAR(36) NOT NULL PRIMARY KEY,
    equipoId VARCHAR(36) NOT NULL,
    numeroPuerto INT NOT NULL, -- e.g., 1, 2, 24, 48
    tipoPuerto ENUM('RJ45', 'SFP', 'SFP+') NOT NULL,
    estado ENUM('Libre', 'Ocupado', 'Dañado', 'Mantenimiento') NOT NULL,
    nodoId VARCHAR(36),
    vlanId VARCHAR(255), -- Could be an INT if VLANs are strictly numeric and managed internally
    descripcionConexion TEXT,
    organizationId VARCHAR(36) NOT NULL,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (equipoId) REFERENCES equipos(id) ON DELETE CASCADE,
    FOREIGN KEY (nodoId) REFERENCES nodos(id) ON DELETE SET NULL, -- If a nodo is deleted, set port's nodoId to NULL
    FOREIGN KEY (organizationId) REFERENCES organizations(id) ON DELETE CASCADE,
    UNIQUE KEY idx_equipo_numeroPuerto (equipoId, numeroPuerto) -- Each port number must be unique per equipo
);

-- Nodos (Network Nodes/Endpoints) table
CREATE TABLE nodos (
    id VARCHAR(36) NOT NULL PRIMARY KEY,
    nombreHost VARCHAR(255) NOT NULL,
    tipoDispositivo ENUM('PC', 'Impresora', 'Cámara IP', 'Máquina Industrial', 'Otro') NOT NULL,
    ipAsignada VARCHAR(45), -- Increased size for potential future IPv6
    macAddress VARCHAR(17) UNIQUE, -- Standard MAC address format xx:xx:xx:xx:xx:xx
    usuarioResponsable VARCHAR(255),
    ubicacionFisicaFinal VARCHAR(255), -- Could be a text description or potentially FK to ubicaciones if more structured
    organizationId VARCHAR(36) NOT NULL,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (organizationId) REFERENCES organizations(id) ON DELETE CASCADE
);

-- RFID Censos (RFID Census Events) table
CREATE TABLE rfid_censos (
    id VARCHAR(36) NOT NULL PRIMARY KEY,
    ubicacionId VARCHAR(36) NOT NULL,
    organizationId VARCHAR(36) NOT NULL,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    -- No updatedAt needed if census events are immutable after creation
    FOREIGN KEY (ubicacionId) REFERENCES ubicaciones(id) ON DELETE CASCADE,
    FOREIGN KEY (organizationId) REFERENCES organizations(id) ON DELETE CASCADE
);

-- RFID Censo Tags table (Many-to-many relationship between rfid_censos and RFID tags read)
CREATE TABLE rfid_censo_tags (
    id VARCHAR(36) NOT NULL PRIMARY KEY, -- Or AUTO_INCREMENT INT PRIMARY KEY
    censoId VARCHAR(36) NOT NULL,
    rfidTag VARCHAR(255) NOT NULL,
    FOREIGN KEY (censoId) REFERENCES rfid_censos(id) ON DELETE CASCADE,
    UNIQUE KEY idx_censo_tag (censoId, rfidTag) -- A tag should only appear once per census
);
