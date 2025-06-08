import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/mysql'; // MySQL connection pool
import { verifyFirebaseToken } from '@/lib/firebase/admin';
import { v4 as uuidv4 } from 'uuid'; // For generating IDs
import { ubicacionSchema } from '@/lib/schemas'; // Zod schema for validation

// Helper function to get user's organizationId from Firebase UID
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

// GET: List all ubicaciones for the user's organization
export async function GET(request: NextRequest) {
  const token = request.headers.get('Authorization')?.split('Bearer ')[1];
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
    const [rows] = await pool.query('SELECT * FROM ubicaciones WHERE organizationId = ? ORDER BY createdAt DESC', [organizationId]);
    return NextResponse.json(rows);
  } catch (error) {
    console.error('Error fetching ubicaciones:', error);
    return NextResponse.json({ error: 'Failed to fetch ubicaciones' }, { status: 500 });
  }
}

// POST: Create a new ubicacion
export async function POST(request: NextRequest) {
  const token = request.headers.get('Authorization')?.split('Bearer ')[1];
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
    const id = uuidv4();

    await pool.query(
      'INSERT INTO ubicaciones (id, nombre, tipo, parentId, organizationId) VALUES (?, ?, ?, ?, ?)',
      [id, validatedData.nombre, validatedData.tipo, validatedData.parentId || null, organizationId]
    );
    // @ts-ignore
    return NextResponse.json({ id, ...validatedData, organizationId }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating ubicacion:', error);
    if (error.name === 'ZodError') {
      return NextResponse.json({ error: 'Invalid input data', details: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to create ubicacion' }, { status: 500 });
  }
}
