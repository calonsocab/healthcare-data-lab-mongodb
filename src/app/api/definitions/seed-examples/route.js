import { requireAuthenticatedUser } from '@/lib/security/api';
// POST /api/definitions/seed-examples
// Seeds the database with example Semantic Objects

import { NextResponse } from 'next/server';
import { getCoreDb } from '@/lib/db/coreDb';
import { getAllExamples } from '@/lib/definitions/examples';

const COLLECTION_NAME = 'reusable_definitions';

export async function POST(request) {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;
    const session = auth.session;

    const coreDb = await getCoreDb();
    const collection = coreDb.collection(COLLECTION_NAME);

    // Get all example definitions
    const examples = getAllExamples();

    const results = {
      created: [],
      skipped: [],
      errors: []
    };

    // Insert each example if it doesn't exist
    for (const example of examples) {
      try {
        // Check if already exists
        const existing = await collection.findOne({ id: example.id });

        if (existing) {
          results.skipped.push({
            id: example.id,
            name: example.name,
            reason: 'Already exists'
          });
        } else {
          // Insert new example
          await collection.insertOne(example);
          results.created.push({
            id: example.id,
            name: example.name
          });
        }
      } catch (err) {
        results.errors.push({
          id: example.id,
          name: example.name,
          error: err.message
        });
      }
    }

    return NextResponse.json({
      message: `Seeded ${results.created.length} examples`,
      total: examples.length,
      ...results
    });

  } catch (error) {
    console.error('Error seeding examples:', error);
    return NextResponse.json(
      { error: 'Failed to seed examples', details: error.message },
      { status: 500 }
    );
  }
}
