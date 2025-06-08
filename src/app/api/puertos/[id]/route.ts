import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/mysql';
import { verifyFirebaseToken } from '@/lib/firebase/admin';
import { puertoSchema } from '@/lib/schemas';

async function getOrganizationId(dbPool: any, userUid: string): Promise<string | null> {
  // ... (implementation)
  try {
    const [rows] = await dbPool.query('SELECT organizationId FROM users WHERE id = ?', [userUid]);
    // @ts-ignore
    if (rows.length > 0) { return rows[0].organizationId; }
    return null;
  } catch (error) { console.error('Error fetching organizationId:', error); return null; }
}

// Helper to get puerto's current orgId for auth checks, could also return equipoId for context
async function getPuertoDetails(dbPool: any, puertoId: string): Promise<{ organizationId: string, equipoId: string, numeroPuerto: number } | null> {
    try {
        const [rows]: any = await dbPool.query('SELECT organizationId, equipoId, numeroPuerto FROM puertos WHERE id = ?', [puertoId]);
        if (rows.length > 0) {
            return rows[0];
        }
        return null;
    } catch (error) {
        console.error('Error fetching puerto details:', error);
        return null;
    }
}

async function isValidNodo(dbPool: any, nodoId: string | null | undefined, organizationId: string): Promise<boolean> {
  // ... (implementation)
  if (!nodoId) return true;
  try {
    const [rows] = await dbPool.query('SELECT id FROM nodos WHERE id = ? AND organizationId = ?', [nodoId, organizationId]);
    // @ts-ignore
    return rows.length > 0;
  } catch (error) { console.error('Error validating nodoId:', error); return false;}
}


// GET: Get a single puerto by ID
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const token = request.headers.get('Authorization')?.split('Bearer ')[1];
  const { id } = params;

  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const decodedToken = await verifyFirebaseToken(token);
  if (!decodedToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userOrganizationId = await getOrganizationId(pool, decodedToken.uid);
  if (!userOrganizationId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const query = `
      SELECT p.*, n.nombreHost as nodoNombreHost
      FROM puertos p
      LEFT JOIN nodos n ON p.nodoId = n.id
      WHERE p.id = ? AND p.organizationId = ?
    `;
    const [rows] = await pool.query(query, [id, userOrganizationId]);
    // @ts-ignore
    if (rows.length === 0) {
      return NextResponse.json({ error: 'Puerto not found' }, { status: 404 });
    }
    // @ts-ignore
    return NextResponse.json(rows[0]);
  } catch (error) {
    console.error('Error fetching puerto:', error);
    return NextResponse.json({ error: 'Failed to fetch puerto' }, { status: 500 });
  }
}

// PUT: Update an existing puerto
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const token = request.headers.get('Authorization')?.split('Bearer ')[1];
  const { id } = params; // Puerto ID

  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const decodedToken = await verifyFirebaseToken(token);
  if (!decodedToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userOrganizationId = await getOrganizationId(pool, decodedToken.uid);
  if (!userOrganizationId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const currentPuerto = await getPuertoDetails(pool, id);
    if (!currentPuerto || currentPuerto.organizationId !== userOrganizationId) {
        return NextResponse.json({ error: 'Puerto not found or access denied' }, { status: 404 });
    }

    const data = await request.json();
    // equipoId and numeroPuerto are generally not updatable for an existing port.
    // If they need to be, it's more like deleting and recreating the port.
    // For this PUT, we assume we are updating other attributes of the port.
    const { equipoId, numeroPuerto, ...puertoUpdateData } = data;

    const validatedData = puertoSchema.parse(puertoUpdateData);

    if (validatedData.nodoId && !await isValidNodo(pool, validatedData.nodoId, userOrganizationId)) {
      return NextResponse.json({ error: 'Invalid nodoId or nodo does not belong to organization' }, { status: 400 });
    }

    // If numeroPuerto is part of the update payload and different from currentPuerto.numeroPuerto, check for conflict
    // This example assumes numeroPuerto is NOT being changed via PUT. If it is, add logic:
    // if (typeof numeroPuerto === 'number' && numeroPuerto !== currentPuerto.numeroPuerto) {
    //   const [existingPortWithNum] = await pool.query('SELECT id FROM puertos WHERE equipoId = ? AND numeroPuerto = ? AND id != ?', [currentPuerto.equipoId, numeroPuerto, id]);
    //   if (existingPortWithNum.length > 0) return NextResponse.json({ error: 'Puerto number conflict' }, { status: 409 });
    // }
    // const finalNumeroPuerto = typeof numeroPuerto === 'number' ? numeroPuerto : currentPuerto.numeroPuerto;


    const [result] = await pool.query(
      'UPDATE puertos SET tipoPuerto = ?, estado = ?, nodoId = ?, vlanId = ?, descripcionConexion = ? WHERE id = ? AND organizationId = ?',
      [validatedData.tipoPuerto, validatedData.estado, validatedData.nodoId || null, validatedData.vlanId, validatedData.descripcionConexion, id, userOrganizationId]
    );
    // @ts-ignore
    if (result.affectedRows === 0) {
      return NextResponse.json({ error: 'Puerto not found or no changes made' }, { status: 404 });
    }
    // @ts-ignore
    return NextResponse.json({ id, equipoId: currentPuerto.equipoId, numeroPuerto: currentPuerto.numeroPuerto, ...validatedData });
  } catch (error: any) {
    console.error('Error updating puerto:', error);
    if (error.name === 'ZodError') {
      return NextResponse.json({ error: 'Invalid input data', details: error.errors }, { status: 400 });
    }
    // if (error.code === 'ER_DUP_ENTRY' && (typeof numeroPuerto === 'number' && numeroPuerto !== currentPuerto.numeroPuerto)) {
    //    return NextResponse.json({ error: 'Puerto number already exists for this equipo.' }, { status: 409 });
    // }
    return NextResponse.json({ error: 'Failed to update puerto' }, { status: 500 });
  }
}

// DELETE: Delete a puerto
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const token = request.headers.get('Authorization')?.split('Bearer ')[1];
  const { id } = params;

  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const decodedToken = await verifyFirebaseToken(token);
  if (!decodedToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userOrganizationId = await getOrganizationId(pool, decodedToken.uid);
  if (!userOrganizationId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const currentPuerto = await getPuertoDetails(pool, id);
    if (!currentPuerto || currentPuerto.organizationId !== userOrganizationId) {
        return NextResponse.json({ error: 'Puerto not found or access denied' }, { status: 404 });
    }

    const [result] = await pool.query('DELETE FROM puertos WHERE id = ? AND organizationId = ?', [id, userOrganizationId]);
    // @ts-ignore
    if (result.affectedRows === 0) {
      return NextResponse.json({ error: 'Puerto not found' }, { status: 404 });
    }
    return NextResponse.json({ message: 'Puerto deleted successfully' }, { status: 200 });
  } catch (error: any) {
    console.error('Error deleting puerto:', error);
    return NextResponse.json({ error: 'Failed to delete puerto' }, { status: 500 });
  }
}
