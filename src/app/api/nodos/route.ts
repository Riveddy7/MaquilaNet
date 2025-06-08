import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/mysql';
import { verifyFirebaseToken } from '@/lib/firebase/admin';
import { v4 as uuidv4 } from 'uuid';
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

// GET: List nodos
export async function GET(request: NextRequest) {
  const token = request.headers.get('Authorization')?.split('Bearer ')[1];
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const decodedToken = await verifyFirebaseToken(token);
  if (!decodedToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const organizationId = await getOrganizationId(pool, decodedToken.uid);
  if (!organizationId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const [rows] = await pool.query('SELECT * FROM nodos WHERE organizationId = ? ORDER BY createdAt DESC', [organizationId]);
    return NextResponse.json(rows);
  } catch (error) {
    console.error('Error fetching nodos:', error);
    return NextResponse.json({ error: 'Failed to fetch nodos' }, { status: 500 });
  }
}

// POST: Create nodo
export async function POST(request: NextRequest) {
  const token = request.headers.get('Authorization')?.split('Bearer ')[1];
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const decodedToken = await verifyFirebaseToken(token);
  if (!decodedToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const organizationId = await getOrganizationId(pool, decodedToken.uid);
  if (!organizationId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const data = await request.json();
    const validatedData = nodoSchema.parse(data);
    const id = uuidv4();

    await pool.query(
      'INSERT INTO nodos (id, nombreHost, tipoDispositivo, ipAsignada, macAddress, usuarioResponsable, ubicacionFisicaFinal, organizationId) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [id, validatedData.nombreHost, validatedData.tipoDispositivo, validatedData.ipAsignada || null, validatedData.macAddress || null, validatedData.usuarioResponsable, validatedData.ubicacionFisicaFinal, organizationId]
    );
    // @ts-ignore
    return NextResponse.json({ id, ...validatedData, organizationId }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating nodo:', error);
    if (error.name === 'ZodError') {
      return NextResponse.json({ error: 'Invalid input data', details: error.errors }, { status: 400 });
    }
    if (error.code === 'ER_DUP_ENTRY' && error.sqlMessage?.includes('macAddress')) {
        return NextResponse.json({ error: 'MAC address already exists.' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Failed to create nodo' }, { status: 500 });
  }
}
