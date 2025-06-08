import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/mysql';
import { verifyFirebaseToken } from '@/lib/firebase/admin';

async function getOrganizationId(dbPool: any, userUid: string): Promise<string | null> {
  // ... (implementation)
  try {
    const [rows] = await dbPool.query('SELECT organizationId FROM users WHERE id = ?', [userUid]);
    // @ts-ignore
    if (rows.length > 0) { return rows[0].organizationId; }
    return null;
  } catch (error) { console.error('Error fetching organizationId:', error); return null; }
}

async function getCensoOrg(dbPool: any, censoId: string): Promise<string | null> {
    try {
        const [rows]: any = await dbPool.query('SELECT organizationId FROM rfid_censos WHERE id = ?', [censoId]);
        if (rows.length > 0) {
            return rows[0].organizationId;
        }
        return null;
    } catch (error) {
        console.error('Error fetching censo organization:', error);
        return null;
    }
}

// GET: Get a single RFID Censo by ID
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const token = request.headers.get('Authorization')?.split('Bearer ')[1];
  const { id } = params;

  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const decodedToken = await verifyFirebaseToken(token);
  if (!decodedToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userOrganizationId = await getOrganizationId(pool, decodedToken.uid);
  if (!userOrganizationId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const [censoRows]:any = await pool.query('SELECT * FROM rfid_censos WHERE id = ? AND organizationId = ?', [id, userOrganizationId]);
    if (censoRows.length === 0) {
      return NextResponse.json({ error: 'RFID Censo not found' }, { status: 404 });
    }
    const censo = censoRows[0];
    const [tagsRows]:any = await pool.query('SELECT rfidTag FROM rfid_censo_tags WHERE censoId = ?', [censo.id]);

    return NextResponse.json({
        ...censo,
        rfidTagsLeidos: tagsRows.map((t: any) => t.rfidTag)
    });
  } catch (error) {
    console.error('Error fetching RFID censo:', error);
    return NextResponse.json({ error: 'Failed to fetch RFID censo' }, { status: 500 });
  }
}

// DELETE: Delete an RFID Censo
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const token = request.headers.get('Authorization')?.split('Bearer ')[1];
  const { id } = params;

  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const decodedToken = await verifyFirebaseToken(token);
  if (!decodedToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userOrganizationId = await getOrganizationId(pool, decodedToken.uid);
  if (!userOrganizationId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const censoOrg = await getCensoOrg(pool, id);
  if (!censoOrg || censoOrg !== userOrganizationId) {
      return NextResponse.json({ error: 'RFID Censo not found or access denied' }, { status: 404 });
  }

  try {
    // Associated rfid_censo_tags will be deleted by ON DELETE CASCADE in DB schema.
    const [result] = await pool.query('DELETE FROM rfid_censos WHERE id = ? AND organizationId = ?', [id, userOrganizationId]);
    // @ts-ignore
    if (result.affectedRows === 0) {
      return NextResponse.json({ error: 'RFID Censo not found' }, { status: 404 });
    }
    return NextResponse.json({ message: 'RFID Censo deleted successfully' }, { status: 200 });
  } catch (error: any) {
    console.error('Error deleting RFID censo:', error);
    return NextResponse.json({ error: 'Failed to delete RFID censo' }, { status: 500 });
  }
}
