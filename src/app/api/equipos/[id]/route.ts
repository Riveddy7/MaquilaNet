import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/mysql';
import { verifyFirebaseToken } from '@/lib/firebase/admin';
import { equipoSchema } from '@/lib/schemas'; // Zod schema for validation

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

async function isValidUbicacion(dbPool: any, ubicacionId: string, organizationId: string): Promise<boolean> {
  // ... (implementation as above)
  if (!ubicacionId) return true;
  try {
    const [rows] = await dbPool.query('SELECT id FROM ubicaciones WHERE id = ? AND organizationId = ?', [ubicacionId, organizationId]);
    // @ts-ignore
    return rows.length > 0;
  } catch (error) {
    console.error('Error validating ubicacionId:', error);
    return false;
  }
}

// GET: Get a single equipo by ID
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const token = request.headers.get('Authorization')?.split('Bearer ')[1];
  const { id } = params;

  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const decodedToken = await verifyFirebaseToken(token);
  if (!decodedToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const organizationId = await getOrganizationId(pool, decodedToken.uid);
  if (!organizationId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const [rows] = await pool.query('SELECT e.*, u.nombre as ubicacionNombre FROM equipos e JOIN ubicaciones u ON e.ubicacionId = u.id WHERE e.id = ? AND e.organizationId = ?', [id, organizationId]);
    // @ts-ignore
    if (rows.length === 0) {
      return NextResponse.json({ error: 'Equipo not found' }, { status: 404 });
    }
    // @ts-ignore
    return NextResponse.json(rows[0]);
  } catch (error) {
    console.error('Error fetching equipo:', error);
    return NextResponse.json({ error: 'Failed to fetch equipo' }, { status: 500 });
  }
}

// PUT: Update an existing equipo
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const token = request.headers.get('Authorization')?.split('Bearer ')[1];
  const { id } = params;

  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const decodedToken = await verifyFirebaseToken(token);
  if (!decodedToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const organizationId = await getOrganizationId(pool, decodedToken.uid);
  if (!organizationId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const data = await request.json();
    const { ubicacionId, ...equipoData } = data;
    const validatedData = equipoSchema.parse(equipoData);

    if (!ubicacionId) {
        return NextResponse.json({ error: 'ubicacionId is required' }, { status: 400 });
    }
    if (!await isValidUbicacion(pool, ubicacionId, organizationId)) {
      return NextResponse.json({ error: 'Invalid ubicacionId or ubicacion does not belong to organization' }, { status: 400 });
    }

    const [result] = await pool.query(
      'UPDATE equipos SET nombre = ?, tipo = ?, marca = ?, modelo = ?, serialNumber = ?, assetTag = ?, ipGestion = ?, rfidTagId = ?, ubicacionId = ?, rackPositionU = ?, estado = ?, numeroDePuertos = ? WHERE id = ? AND organizationId = ?',
      [validatedData.nombre, validatedData.tipo, validatedData.marca, validatedData.modelo, validatedData.serialNumber, validatedData.assetTag, validatedData.ipGestion, validatedData.rfidTagId, ubicacionId, validatedData.rackPositionU, validatedData.estado, validatedData.numeroDePuertos, id, organizationId]
    );
    // @ts-ignore
    if (result.affectedRows === 0) {
      return NextResponse.json({ error: 'Equipo not found or no changes made' }, { status: 404 });
    }
    // @ts-ignore
    return NextResponse.json({ id, ...validatedData, ubicacionId });
  } catch (error: any) {
    console.error('Error updating equipo:', error);
    if (error.name === 'ZodError') {
      return NextResponse.json({ error: 'Invalid input data', details: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to update equipo' }, { status: 500 });
  }
}

// DELETE: Delete an equipo
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const token = request.headers.get('Authorization')?.split('Bearer ')[1];
  const { id } = params;

  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const decodedToken = await verifyFirebaseToken(token);
  if (!decodedToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const organizationId = await getOrganizationId(pool, decodedToken.uid);
  if (!organizationId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    // Puertos associated with this equipo will be deleted by ON DELETE CASCADE in DB schema.
    // No other direct dependencies from other tables to `equipos` that require manual checks before delete based on current schema.
    const [result] = await pool.query('DELETE FROM equipos WHERE id = ? AND organizationId = ?', [id, organizationId]);
    // @ts-ignore
    if (result.affectedRows === 0) {
      return NextResponse.json({ error: 'Equipo not found' }, { status: 404 });
    }
    return NextResponse.json({ message: 'Equipo deleted successfully' }, { status: 200 });
  } catch (error: any) {
    console.error('Error deleting equipo:', error);
    return NextResponse.json({ error: 'Failed to delete equipo' }, { status: 500 });
  }
}
