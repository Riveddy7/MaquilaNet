import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/mysql';
import { verifyFirebaseToken } from '@/lib/firebase/admin';

// GET: Get current user's organization details
export async function GET(request: NextRequest) {
  const token = request.headers.get('Authorization')?.split('Bearer ')[1];
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const decodedToken = await verifyFirebaseToken(token);
  if (!decodedToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    // First, get the user's organizationId from the users table
    const [userRows]:any = await pool.query('SELECT organizationId FROM users WHERE id = ?', [decodedToken.uid]);
    if (userRows.length === 0 || !userRows[0].organizationId) {
      return NextResponse.json({ error: 'User not associated with an organization' }, { status: 404 });
    }
    const organizationId = userRows[0].organizationId;

    // Then, get the organization details
    const [orgRows]:any = await pool.query('SELECT id, name, createdAt, updatedAt FROM organizations WHERE id = ?', [organizationId]);
    if (orgRows.length === 0) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }
    return NextResponse.json(orgRows[0]);

  } catch (error) {
    console.error("Error fetching user's organization:", error);
    return NextResponse.json({ error: "Failed to fetch user's organization" }, { status: 500 });
  }
}
