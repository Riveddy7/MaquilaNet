import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/mysql';
import { verifyFirebaseToken } from '@/lib/firebase/admin';
import { ubicacionSchema } from '@/lib/schemas'; // Zod schema for validation (useful for PUT)

// Helper function to get user's organizationId (same as above, consider moving to a shared util if used often)
async function getOrganizationId(dbPool: any, userUid: string): Promise<string | null> {
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

// GET: Get a single ubicacion by ID
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const token = request.headers.get('Authorization')?.split('Bearer ')[1];
  const { id } = params;

  if (!token) {
    return NextResponse.json({ error: 'Unauthorized: No token provided' }, { status: 401 });
  }
  const decodedToken = await verifyFirebaseToken(token);
  if (!decodedToken) {
    return NextResponse.json({ error: 'Unauthorized: Invalid token' }, { status: 401 });
  }

  const userUid = decodedToken.uid;
  const organizationId = await getOrganizationId(pool, userUid);
  if (!organizationId) {
    return NextResponse.json({ error: 'Forbidden: User or organization not found' }, { status: 403 });
  }

  try {
    const [rows] = await pool.query('SELECT * FROM ubicaciones WHERE id = ? AND organizationId = ?', [id, organizationId]);
    // @ts-ignore
    if (rows.length === 0) {
      return NextResponse.json({ error: 'Ubicacion not found' }, { status: 404 });
    }
    // @ts-ignore
    return NextResponse.json(rows[0]);
  } catch (error) {
    console.error('Error fetching ubicacion:', error);
    return NextResponse.json({ error: 'Failed to fetch ubicacion' }, { status: 500 });
  }
}

// PUT: Update an existing ubicacion
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const token = request.headers.get('Authorization')?.split('Bearer ')[1];
  const { id } = params;

  if (!token) {
    return NextResponse.json({ error: 'Unauthorized: No token provided' }, { status: 401 });
  }
  const decodedToken = await verifyFirebaseToken(token);
  if (!decodedToken) {
    return NextResponse.json({ error: 'Unauthorized: Invalid token' }, { status: 401 });
  }

  const userUid = decodedToken.uid;
  const organizationId = await getOrganizationId(pool, userUid);
  if (!organizationId) {
    return NextResponse.json({ error: 'Forbidden: User or organization not found' }, { status: 403 });
  }

  try {
    const data = await request.json();
    const validatedData = ubicacionSchema.parse(data); // Validate input

    const [result] = await pool.query(
      'UPDATE ubicaciones SET nombre = ?, tipo = ?, parentId = ? WHERE id = ? AND organizationId = ?',
      [validatedData.nombre, validatedData.tipo, validatedData.parentId || null, id, organizationId]
    );
    // @ts-ignore
    if (result.affectedRows === 0) {
      return NextResponse.json({ error: 'Ubicacion not found or no changes made' }, { status: 404 });
    }
    // @ts-ignore
    return NextResponse.json({ id, ...validatedData });
  } catch (error: any) {
    console.error('Error updating ubicacion:', error);
    if (error.name === 'ZodError') {
      return NextResponse.json({ error: 'Invalid input data', details: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to update ubicacion' }, { status: 500 });
  }
}

// DELETE: Delete an ubicacion
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const token = request.headers.get('Authorization')?.split('Bearer ')[1];
  const { id } = params;

  if (!token) {
    return NextResponse.json({ error: 'Unauthorized: No token provided' }, { status: 401 });
  }
  const decodedToken = await verifyFirebaseToken(token);
  if (!decodedToken) {
    return NextResponse.json({ error: 'Unauthorized: Invalid token' }, { status: 401 });
  }

  const userUid = decodedToken.uid;
  const organizationId = await getOrganizationId(pool, userUid);
  if (!organizationId) {
    return NextResponse.json({ error: 'Forbidden: User or organization not found' }, { status: 403 });
  }

  try {
    // Check for dependent equipos first, as schema has ON DELETE RESTRICT for ubicacionId in equipos
    const [equipos]:any = await pool.query('SELECT id FROM equipos WHERE ubicacionId = ? AND organizationId = ?', [id, organizationId]);
    if (equipos.length > 0) {
        return NextResponse.json({ error: 'Cannot delete ubicacion: It has associated equipos. Please reassign or delete them first.' }, { status: 409 }); // 409 Conflict
    }

    // Check for dependent rfid_censos
    const [censos]:any = await pool.query('SELECT id FROM rfid_censos WHERE ubicacionId = ? AND organizationId = ?', [id, organizationId]);
    if (censos.length > 0) {
        return NextResponse.json({ error: 'Cannot delete ubicacion: It has associated RFID censos. Please delete them first.' }, { status: 409 });
    }

    // Check for child ubicaciones (parentId)
    const [children]:any = await pool.query('SELECT id FROM ubicaciones WHERE parentId = ? AND organizationId = ?', [id, organizationId]);
    if (children.length > 0) {
        return NextResponse.json({ error: 'Cannot delete ubicacion: It has child ubicaciones. Please reassign or delete them first.' }, { status: 409 });
    }

    const [result] = await pool.query('DELETE FROM ubicaciones WHERE id = ? AND organizationId = ?', [id, organizationId]);
    // @ts-ignore
    if (result.affectedRows === 0) {
      return NextResponse.json({ error: 'Ubicacion not found' }, { status: 404 });
    }
    return NextResponse.json({ message: 'Ubicacion deleted successfully' }, { status: 200 }); // Or 204 No Content
  } catch (error: any) {
    console.error('Error deleting ubicacion:', error);
    // Catch foreign key constraint errors specifically if possible, e.g. error.code === 'ER_ROW_IS_REFERENCED_2'
    // For now, a generic error. The checks above should prevent most FK violations.
    return NextResponse.json({ error: 'Failed to delete ubicacion' }, { status: 500 });
  }
}
