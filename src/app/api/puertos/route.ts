import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/mysql';
import { verifyFirebaseToken } from '@/lib/firebase/admin';
import { v4 as uuidv4 } from 'uuid';
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

async function getEquipoAndOrgId(dbPool: any, equipoId: string): Promise<{ equipoOrgId: string | null } | null> {
    try {
        const [rows]: any = await dbPool.query('SELECT organizationId FROM equipos WHERE id = ?', [equipoId]);
        if (rows.length > 0) {
            return { equipoOrgId: rows[0].organizationId };
        }
        return null;
    } catch (error) {
        console.error('Error fetching equipo details:', error);
        return null;
    }
}

async function isValidNodo(dbPool: any, nodoId: string | null | undefined, organizationId: string): Promise<boolean> {
  if (!nodoId) return true; // Nodo is optional
  try {
    const [rows] = await dbPool.query('SELECT id FROM nodos WHERE id = ? AND organizationId = ?', [nodoId, organizationId]);
    // @ts-ignore
    return rows.length > 0;
  } catch (error) {
    console.error('Error validating nodoId:', error);
    return false;
  }
}

// GET: List puertos (usually filtered by equipoId)
export async function GET(request: NextRequest) {
  const token = request.headers.get('Authorization')?.split('Bearer ')[1];
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const decodedToken = await verifyFirebaseToken(token);
  if (!decodedToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userOrganizationId = await getOrganizationId(pool, decodedToken.uid);
  if (!userOrganizationId) return NextResponse.json({ error: 'Forbidden: User organization not found' }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const equipoIdFilter = searchParams.get('equipoId');

  if (!equipoIdFilter) {
    return NextResponse.json({ error: 'equipoId query parameter is required' }, { status: 400 });
  }

  // Verify equipoId belongs to user's organization
  const equipoDetails = await getEquipoAndOrgId(pool, equipoIdFilter);
  if (!equipoDetails || equipoDetails.equipoOrgId !== userOrganizationId) {
      return NextResponse.json({ error: 'Forbidden: Equipo not found or access denied' }, { status: 403 });
  }

  try {
    // Also join with nodos to get nodoNombreHost if available
    const query = `
      SELECT p.*, n.nombreHost as nodoNombreHost
      FROM puertos p
      LEFT JOIN nodos n ON p.nodoId = n.id
      WHERE p.equipoId = ? AND p.organizationId = ?
      ORDER BY p.numeroPuerto ASC
    `;
    const [rows] = await pool.query(query, [equipoIdFilter, userOrganizationId]);
    return NextResponse.json(rows);
  } catch (error) {
    console.error('Error fetching puertos:', error);
    return NextResponse.json({ error: 'Failed to fetch puertos' }, { status: 500 });
  }
}

// POST: Create puerto
export async function POST(request: NextRequest) {
  const token = request.headers.get('Authorization')?.split('Bearer ')[1];
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const decodedToken = await verifyFirebaseToken(token);
  if (!decodedToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userOrganizationId = await getOrganizationId(pool, decodedToken.uid);
  if (!userOrganizationId) return NextResponse.json({ error: 'Forbidden: User organization not found' }, { status: 403 });

  try {
    const data = await request.json();
    // equipoId and numeroPuerto are not in puertoSchema, they are contextual.
    const { equipoId, numeroPuerto, ...puertoData } = data;

    if (!equipoId || typeof numeroPuerto !== 'number') {
        return NextResponse.json({ error: 'equipoId and numeroPuerto are required' }, { status: 400 });
    }

    const validatedData = puertoSchema.parse(puertoData); // Validates tipoPuerto, estado, nodoId, vlanId, descripcionConexion

    const equipoDetails = await getEquipoAndOrgId(pool, equipoId);
    if (!equipoDetails || equipoDetails.equipoOrgId !== userOrganizationId) {
        return NextResponse.json({ error: 'Forbidden: Equipo not found or access denied' }, { status: 403 });
    }

    if (validatedData.nodoId && !await isValidNodo(pool, validatedData.nodoId, userOrganizationId)) {
      return NextResponse.json({ error: 'Invalid nodoId or nodo does not belong to organization' }, { status: 400 });
    }

    const id = uuidv4();
    await pool.query(
      'INSERT INTO puertos (id, equipoId, numeroPuerto, tipoPuerto, estado, nodoId, vlanId, descripcionConexion, organizationId) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [id, equipoId, numeroPuerto, validatedData.tipoPuerto, validatedData.estado, validatedData.nodoId || null, validatedData.vlanId, validatedData.descripcionConexion, userOrganizationId]
    );
    // @ts-ignore
    return NextResponse.json({ id, equipoId, numeroPuerto, ...validatedData, organizationId: userOrganizationId }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating puerto:', error);
    if (error.name === 'ZodError') {
      return NextResponse.json({ error: 'Invalid input data', details: error.errors }, { status: 400 });
    }
    if (error.code === 'ER_DUP_ENTRY') { // Catch unique constraint violation for equipoId, numeroPuerto
        return NextResponse.json({ error: 'Puerto number already exists for this equipo.' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Failed to create puerto' }, { status: 500 });
  }
}
