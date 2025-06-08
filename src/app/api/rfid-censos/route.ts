import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/mysql';
import { verifyFirebaseToken } from '@/lib/firebase/admin';
import { v4 as uuidv4 } from 'uuid';
import { rfidCensoSchema } from '@/lib/schemas';

async function getOrganizationId(dbPool: any, userUid: string): Promise<string | null> {
  // ... (implementation)
  try {
    const [rows] = await dbPool.query('SELECT organizationId FROM users WHERE id = ?', [userUid]);
    // @ts-ignore
    if (rows.length > 0) { return rows[0].organizationId; }
    return null;
  } catch (error) { console.error('Error fetching organizationId:', error); return null; }
}

async function isValidUbicacion(dbPool: any, ubicacionId: string, organizationId: string): Promise<boolean> {
  // ... (implementation)
  if (!ubicacionId) return false;
  try {
    const [rows] = await dbPool.query('SELECT id FROM ubicaciones WHERE id = ? AND organizationId = ?', [ubicacionId, organizationId]);
    // @ts-ignore
    return rows.length > 0;
  } catch (error) { console.error('Error validating ubicacionId:', error); return false;}
}

// GET: List RFID Censos
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
    let censosQuery = 'SELECT * FROM rfid_censos WHERE organizationId = ?';
    const queryParams: any[] = [organizationId];

    if (ubicacionIdFilter) {
      censosQuery += ' AND ubicacionId = ?';
      queryParams.push(ubicacionIdFilter);
    }
    censosQuery += ' ORDER BY createdAt DESC';

    const [censosRows]:any = await pool.query(censosQuery, queryParams);

    // For each censo, fetch its tags
    const censosWithTags = [];
    for (const censo of censosRows) {
        const [tagsRows]:any = await pool.query('SELECT rfidTag FROM rfid_censo_tags WHERE censoId = ?', [censo.id]);
        censosWithTags.push({
            ...censo,
            rfidTagsLeidos: tagsRows.map((t: any) => t.rfidTag)
        });
    }
    return NextResponse.json(censosWithTags);
  } catch (error) {
    console.error('Error fetching RFID censos:', error);
    return NextResponse.json({ error: 'Failed to fetch RFID censos' }, { status: 500 });
  }
}

// POST: Create RFID Censo
export async function POST(request: NextRequest) {
  const token = request.headers.get('Authorization')?.split('Bearer ')[1];
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const decodedToken = await verifyFirebaseToken(token);
  if (!decodedToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const organizationId = await getOrganizationId(pool, decodedToken.uid);
  if (!organizationId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  let connection; // For transaction
  try {
    const data = await request.json();
    const validatedData = rfidCensoSchema.parse(data); // Validates ubicacionId, rfidTagsLeidos (array)

    if (!await isValidUbicacion(pool, validatedData.ubicacionId, organizationId)) {
      return NextResponse.json({ error: 'Invalid ubicacionId or ubicacion does not belong to organization' }, { status: 400 });
    }

    connection = await pool.getConnection(); // Get connection for transaction
    await connection.beginTransaction();

    const censoId = uuidv4();
    await connection.query(
      'INSERT INTO rfid_censos (id, ubicacionId, organizationId) VALUES (?, ?, ?)',
      [censoId, validatedData.ubicacionId, organizationId]
    );

    if (validatedData.rfidTagsLeidos && validatedData.rfidTagsLeidos.length > 0) {
      const tagsToInsert = validatedData.rfidTagsLeidos.map(tag => [uuidv4(), censoId, tag]);
      await connection.query('INSERT INTO rfid_censo_tags (id, censoId, rfidTag) VALUES ?', [tagsToInsert]);
    }

    await connection.commit();
    // @ts-ignore
    return NextResponse.json({ id: censoId, ...validatedData, organizationId }, { status: 201 });

  } catch (error: any) {
    if (connection) await connection.rollback(); // Rollback transaction on error
    console.error('Error creating RFID censo:', error);
    if (error.name === 'ZodError') {
      return NextResponse.json({ error: 'Invalid input data', details: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to create RFID censo' }, { status: 500 });
  } finally {
    if (connection) connection.release();
  }
}
