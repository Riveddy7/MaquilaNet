import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/mysql';
import { verifyFirebaseToken } from '@/lib/firebase/admin';
import { v4 as uuidv4 } from 'uuid';
import { equipoSchema } from '@/lib/schemas';

async function getOrganizationId(dbPool: any, userUid: string): Promise<string | null> {
  // ... (implementation as in ubicaciones routes)
  try {
    const [rows] = await dbPool.query('SELECT organizationId FROM users WHERE id = ?', [userUid]);
    // @ts-ignore
    if (rows.length > 0) {
    // @ts-ignore
      return rows[0].organizationId;
    }
    return null;
  } catch (error) {
    console.error('Error fetching organizationId:', error);
    return null;
  }
}

// Helper to check if ubicacionId is valid and belongs to the organization
async function isValidUbicacion(dbPool: any, ubicacionId: string, organizationId: string): Promise<boolean> {
  if (!ubicacionId) return true; // Allow null/undefined if optional, though for equipo it's usually required.
  try {
    const [rows] = await dbPool.query('SELECT id FROM ubicaciones WHERE id = ? AND organizationId = ?', [ubicacionId, organizationId]);
    // @ts-ignore
    return rows.length > 0;
  } catch (error) {
    console.error('Error validating ubicacionId:', error);
    return false;
  }
}

// GET: List equipos
export async function GET(request: NextRequest) {
  const token = request.headers.get('Authorization')?.split('Bearer ')[1];
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const decodedToken = await verifyFirebaseToken(token);
  if (!decodedToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const organizationId = await getOrganizationId(pool, decodedToken.uid);
  if (!organizationId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const ubicacionIdFilter = searchParams.get('ubicacionId');

  try {
    let query = 'SELECT e.*, u.nombre as ubicacionNombre FROM equipos e JOIN ubicaciones u ON e.ubicacionId = u.id WHERE e.organizationId = ?';
    const queryParams: any[] = [organizationId];

    if (ubicacionIdFilter) {
      query += ' AND e.ubicacionId = ?';
      queryParams.push(ubicacionIdFilter);
    }
    query += ' ORDER BY e.createdAt DESC';

    const [rows] = await pool.query(query, queryParams);
    return NextResponse.json(rows);
  } catch (error) {
    console.error('Error fetching equipos:', error);
    return NextResponse.json({ error: 'Failed to fetch equipos' }, { status: 500 });
  }
}

// POST: Create equipo
export async function POST(request: NextRequest) {
  const token = request.headers.get('Authorization')?.split('Bearer ')[1];
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const decodedToken = await verifyFirebaseToken(token);
  if (!decodedToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const organizationId = await getOrganizationId(pool, decodedToken.uid);
  if (!organizationId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const data = await request.json();
    const { ubicacionId, ...equipoData } = data; // Separate ubicacionId for validation

    const validatedData = equipoSchema.parse(equipoData); // Validate main equipo data

    if (!ubicacionId) {
        return NextResponse.json({ error: 'ubicacionId is required' }, { status: 400 });
    }
    if (!await isValidUbicacion(pool, ubicacionId, organizationId)) {
      return NextResponse.json({ error: 'Invalid ubicacionId or ubicacion does not belong to organization' }, { status: 400 });
    }

    const id = uuidv4();
    const fullEquipoData = { id, ...validatedData, ubicacionId, organizationId };

    await pool.query(
      'INSERT INTO equipos (id, nombre, tipo, marca, modelo, serialNumber, assetTag, ipGestion, rfidTagId, ubicacionId, rackPositionU, estado, numeroDePuertos, organizationId) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [id, validatedData.nombre, validatedData.tipo, validatedData.marca, validatedData.modelo, validatedData.serialNumber, validatedData.assetTag, validatedData.ipGestion, validatedData.rfidTagId, ubicacionId, validatedData.rackPositionU, validatedData.estado, validatedData.numeroDePuertos, organizationId]
    );
    // @ts-ignore
    return NextResponse.json(fullEquipoData, { status: 201 });
  } catch (error: any) {
    console.error('Error creating equipo:', error);
    if (error.name === 'ZodError') {
      return NextResponse.json({ error: 'Invalid input data', details: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to create equipo' }, { status: 500 });
  }
}
