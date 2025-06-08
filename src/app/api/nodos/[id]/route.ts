import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/mysql';
import { verifyFirebaseToken } from '@/lib/firebase/admin';
import { nodoSchema } from '@/lib/schemas';

async function getOrganizationId(dbPool: any, userUid: string): Promise<string | null> {
  // ... (implementation)
  try {
    const [rows] = await dbPool.query('SELECT organizationId FROM users WHERE id = ?', [userUid]);
    // @ts-ignore
    if (rows.length > 0) { return rows[0].organizationId; }
    return null;
  } catch (error) { console.error('Error fetching organizationId:', error); return null; }
}

// Helper to check if nodo belongs to the user's org
async function getNodoOrg(dbPool: any, nodoId: string): Promise<string | null> {
    try {
        const [rows]: any = await dbPool.query('SELECT organizationId FROM nodos WHERE id = ?', [nodoId]);
        if (rows.length > 0) {
            return rows[0].organizationId;
        }
        return null;
    } catch (error) {
        console.error('Error fetching nodo organization:', error);
        return null;
    }
}

// GET: Get a single nodo by ID
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const token = request.headers.get('Authorization')?.split('Bearer ')[1];
  const { id } = params;

  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const decodedToken = await verifyFirebaseToken(token);
  if (!decodedToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userOrganizationId = await getOrganizationId(pool, decodedToken.uid);
  if (!userOrganizationId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const [rows] = await pool.query('SELECT * FROM nodos WHERE id = ? AND organizationId = ?', [id, userOrganizationId]);
    // @ts-ignore
    if (rows.length === 0) {
      return NextResponse.json({ error: 'Nodo not found' }, { status: 404 });
    }
    // @ts-ignore
    return NextResponse.json(rows[0]);
  } catch (error) {
    console.error('Error fetching nodo:', error);
    return NextResponse.json({ error: 'Failed to fetch nodo' }, { status: 500 });
  }
}

// PUT: Update an existing nodo
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const token = request.headers.get('Authorization')?.split('Bearer ')[1];
  const { id } = params;

  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const decodedToken = await verifyFirebaseToken(token);
  if (!decodedToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userOrganizationId = await getOrganizationId(pool, decodedToken.uid);
  if (!userOrganizationId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const nodoOrg = await getNodoOrg(pool, id);
  if (!nodoOrg || nodoOrg !== userOrganizationId) {
      return NextResponse.json({ error: 'Nodo not found or access denied' }, { status: 404 });
  }

  try {
    const data = await request.json();
    const validatedData = nodoSchema.parse(data);

    const [result] = await pool.query(
      'UPDATE nodos SET nombreHost = ?, tipoDispositivo = ?, ipAsignada = ?, macAddress = ?, usuarioResponsable = ?, ubicacionFisicaFinal = ? WHERE id = ? AND organizationId = ?',
      [validatedData.nombreHost, validatedData.tipoDispositivo, validatedData.ipAsignada || null, validatedData.macAddress || null, validatedData.usuarioResponsable, validatedData.ubicacionFisicaFinal, id, userOrganizationId]
    );
    // @ts-ignore
    if (result.affectedRows === 0) {
      return NextResponse.json({ error: 'Nodo not found or no changes made' }, { status: 404 });
    }
    // @ts-ignore
    return NextResponse.json({ id, ...validatedData });
  } catch (error: any) {
    console.error('Error updating nodo:', error);
    if (error.name === 'ZodError') {
      return NextResponse.json({ error: 'Invalid input data', details: error.errors }, { status: 400 });
    }
    if (error.code === 'ER_DUP_ENTRY' && error.sqlMessage?.includes('macAddress')) {
        return NextResponse.json({ error: 'MAC address already exists.' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Failed to update nodo' }, { status: 500 });
  }
}

// DELETE: Delete a nodo
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const token = request.headers.get('Authorization')?.split('Bearer ')[1];
  const { id } = params;

  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const decodedToken = await verifyFirebaseToken(token);
  if (!decodedToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userOrganizationId = await getOrganizationId(pool, decodedToken.uid);
  if (!userOrganizationId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const nodoOrg = await getNodoOrg(pool, id);
  if (!nodoOrg || nodoOrg !== userOrganizationId) {
      return NextResponse.json({ error: 'Nodo not found or access denied' }, { status: 404 });
  }

  try {
    // Associated puertos will have their nodoId set to NULL due to ON DELETE SET NULL in DB schema.
    const [result] = await pool.query('DELETE FROM nodos WHERE id = ? AND organizationId = ?', [id, userOrganizationId]);
    // @ts-ignore
    if (result.affectedRows === 0) {
      return NextResponse.json({ error: 'Nodo not found' }, { status: 404 });
    }
    return NextResponse.json({ message: 'Nodo deleted successfully' }, { status: 200 });
  } catch (error: any) {
    console.error('Error deleting nodo:', error);
    return NextResponse.json({ error: 'Failed to delete nodo' }, { status: 500 });
  }
}
