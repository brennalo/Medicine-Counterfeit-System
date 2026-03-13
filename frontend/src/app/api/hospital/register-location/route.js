// frontend/app/api/hospital/register-location/route.js
import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import db from '@/lib/db';

async function handler(request) {
  try {
    const { name, address, latitude, longitude } = await request.json();

    if (!name || !address || latitude == null || longitude == null) {
      return NextResponse.json(
        { error: 'name, address, latitude, longitude are required' },
        { status: 400 },
      );
    }

    const hospitalId = request.user.userId;

    // Check if this hospital already has a location registered
    const [existing] = await db.execute(
      "SELECT id FROM locations WHERE manufacturer_id = ? AND type = 'HOSPITAL'",
      [hospitalId],
    );

    if (existing.length > 0) {
      // Update existing hospital location
      await db.execute(
        "UPDATE locations SET name = ?, address = ?, latitude = ?, longitude = ? WHERE manufacturer_id = ? AND type = 'HOSPITAL'",
        [name, address, latitude, longitude, hospitalId],
      );
      return NextResponse.json({
        success: true,
        locationId: existing[0].id,
        message: 'Hospital location updated',
      });
    }

    // Insert new hospital location — reuses same table as manufacturer locations
    const [result] = await db.execute(
      "INSERT INTO locations (name, type, address, latitude, longitude, manufacturer_id) VALUES (?, 'HOSPITAL', ?, ?, ?, ?)",
      [name, address, latitude, longitude, hospitalId],
    );

    return NextResponse.json({
      success: true,
      locationId: result.insertId,
      message: 'Hospital location registered',
    });
  } catch (err) {
    console.error('[Hospital Register Location]', err);
    return NextResponse.json(
      { error: err.message || 'Internal error' },
      { status: 500 },
    );
  }
}

export const POST = withAuth(handler, 'HOSPITAL');
