import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/mysql';
import { verifyFirebaseToken } from '@/lib/firebase/admin';
import { v4 as uuidv4 } from 'uuid';
import * as z from 'zod';

const userProfileCreateSchema = z.object({
  organizationId: z.string().optional(), // To link to an existing org
  newOrganizationName: z.string().optional(), // To create a new org
  displayName: z.string().optional(),
  // email is derived from Firebase token
});

// GET: Get current user's profile from MySQL
export async function GET(request: NextRequest) {
  const token = request.headers.get('Authorization')?.split('Bearer ')[1];
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const decodedToken = await verifyFirebaseToken(token);
  if (!decodedToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const [rows]:any = await pool.query('SELECT id, email, displayName, organizationId FROM users WHERE id = ?', [decodedToken.uid]);
    if (rows.length === 0) {
      // User exists in Firebase Auth but not in our users table yet
      // Return a specific status or message, or create a basic profile here if desired.
      // For now, indicating not found in local DB. Client might then trigger a POST.
      return NextResponse.json({ error: 'User profile not found in application database. Please complete setup.' }, { status: 404 });
    }
    return NextResponse.json(rows[0]);
  } catch (error) {
    console.error("Error fetching user profile:", error);
    return NextResponse.json({ error: 'Failed to fetch user profile' }, { status: 500 });
  }
}

// POST: Create or update user's profile in MySQL (e.g., on first login or to set/change organization)
export async function POST(request: NextRequest) {
  const token = request.headers.get('Authorization')?.split('Bearer ')[1];
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const decodedToken = await verifyFirebaseToken(token);
  if (!decodedToken || !decodedToken.uid || !decodedToken.email) {
    return NextResponse.json({ error: 'Unauthorized or invalid token data' }, { status: 401 });
  }

  let connection;
  try {
    const data = await request.json();
    const validatedData = userProfileCreateSchema.parse(data);

    const userUid = decodedToken.uid;
    const userEmail = decodedToken.email;
    const displayName = validatedData.displayName || decodedToken.name || userEmail.split('@')[0]; // Default display name

    let organizationIdToLink = validatedData.organizationId;

    connection = await pool.getConnection();
    await connection.beginTransaction();

    // Check if user already exists
    const [existingUserRows]:any = await connection.query('SELECT id, organizationId FROM users WHERE id = ?', [userUid]);
    let isUpdate = existingUserRows.length > 0;
    let currentOrgId = isUpdate ? existingUserRows[0].organizationId : null;


    if (!organizationIdToLink && validatedData.newOrganizationName) {
      // Create a new organization
      organizationIdToLink = uuidv4();
      await connection.query('INSERT INTO organizations (id, name) VALUES (?, ?)', [organizationIdToLink, validatedData.newOrganizationName]);
      console.log(`Organization created: ${organizationIdToLink} with name ${validatedData.newOrganizationName}`);
    } else if (!organizationIdToLink && !isUpdate) {
        // If no org specified and it's a new user, this is an issue unless you have a default org logic
        await connection.rollback();
        return NextResponse.json({ error: 'Organization ID or new organization name is required for new user setup.' }, { status: 400 });
    } else if (organizationIdToLink && isUpdate && organizationIdToLink !== currentOrgId) {
        // Potentially handle organization change logic here if allowed
        // For now, we assume org change is a more complex operation not handled by simple profile update
        console.warn(`User ${userUid} attempting to change organization from ${currentOrgId} to ${organizationIdToLink}. This is not fully supported in this basic setup.`);
        // To fully support, you'd need to check if the target org exists, user has rights to join, etc.
        // For this example, we'll allow updating the orgId directly if provided.
    }


    if (isUpdate) {
      // Update existing user
      // Only update org if a new one was explicitly provided and is different, or if it's the initial setup of orgId for the user.
      const finalOrganizationId = organizationIdToLink && organizationIdToLink !== currentOrgId ? organizationIdToLink : currentOrgId;
      if (!finalOrganizationId) { // Should not happen if logic above is correct for new users
          await connection.rollback();
          return NextResponse.json({ error: 'Organization assignment failed.' }, { status: 500 });
      }
      await connection.query(
        'UPDATE users SET displayName = ?, email = ?, organizationId = ? WHERE id = ?',
        [displayName, userEmail, finalOrganizationId, userUid]
      );
    } else {
      // Create new user
      if (!organizationIdToLink) { // Should be set by new org creation or provided
          await connection.rollback();
          return NextResponse.json({ error: 'Organization ID is required for new user.' }, { status: 400 });
      }
      await connection.query(
        'INSERT INTO users (id, email, displayName, organizationId) VALUES (?, ?, ?, ?)',
        [userUid, userEmail, displayName, organizationIdToLink]
      );
    }

    await connection.commit();
    // @ts-ignore
    return NextResponse.json({ id: userUid, email: userEmail, displayName, organizationId: organizationIdToLink || currentOrgId });

  } catch (error: any) {
    if (connection) await connection.rollback();
    console.error("Error creating/updating user profile:", error);
    if (error.name === 'ZodError') {
      return NextResponse.json({ error: 'Invalid input data', details: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to create/update user profile' }, { status: 500 });
  } finally {
    if (connection) connection.release();
  }
}
