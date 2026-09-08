// src/app/api/synthetic-data/presets/route.js
import { NextResponse } from 'next/server';
import { requireAuthenticatedUser, safeErrorResponse } from '@/lib/security/api';

export const dynamic = 'force-dynamic';

// In a real implementation, these would likely be loaded from a database
const strategyPresets = [
  {
    id: 'single-collection-basic',
    name: 'Single Collection - Basic',
    strategy: 'SingleCollection',
    description: 'Simple configuration for storing all compositions in a single collection',
    config: JSON.stringify({
      compositionCollection: 'compositions',
      metaCollection: 'metaIndex',
      denormalize: false,
      indexes: [
        { field: 'ehrid', type: 'hashed' },
        { field: 'composition_date', type: 'date' }
      ]
    }, null, 2)
  },
  {
    id: 'single-collection-denormalized',
    name: 'Single Collection - Denormalized',
    strategy: 'SingleCollection',
    description: 'Store compositions in a single collection with denormalization for faster queries',
    config: JSON.stringify({
      compositionCollection: 'compositions',
      metaCollection: 'metaIndex',
      denormalize: true,
      flatten: [
        'CanonicalJSON.content.items.value.value',
        'CanonicalJSON.context.other_context.items.items.value.defining_code.code_string'
      ],
      indexes: [
        { field: 'ehrid', type: 'hashed' },
        { field: 'composition_date', type: 'date' },
        { field: 'denormalized.values', type: 'array' }
      ]
    }, null, 2)
  },
  {
    id: 'distributed-collections-basic',
    name: 'Distributed Collections - Basic',
    strategy: 'DistributedCollections',
    description: 'Store data in multiple collections organized by archetype',
    config: JSON.stringify({
      baseCollection: 'compositions',
      metaCollection: 'metaIndex',
      archetypeCollections: {
        'openEHR-EHR-COMPOSITION.vaccination_list.v0': 'vaccinations',
        'openEHR-EHR-COMPOSITION.encounter.v1': 'encounters',
        'openEHR-EHR-COMPOSITION.problem_list.v1': 'problems'
      },
      indexes: [
        { collection: 'vaccinations', field: 'ehrid', type: 'hashed' },
        { collection: 'encounters', field: 'ehrid', type: 'hashed' },
        { collection: 'problems', field: 'ehrid', type: 'hashed' }
      ]
    }, null, 2)
  },
  {
    id: 'distributed-collections-advanced',
    name: 'Distributed Collections - Advanced',
    strategy: 'DistributedCollections',
    description: 'Advanced configuration with type-specific collections and dedicated data structures',
    config: JSON.stringify({
      baseCollection: 'compositions',
      metaCollection: 'metaIndex',
      archetypeCollections: {
        'openEHR-EHR-COMPOSITION.vaccination_list.v0': 'vaccinations',
        'openEHR-EHR-COMPOSITION.encounter.v1': 'encounters',
        'openEHR-EHR-COMPOSITION.problem_list.v1': 'problems'
      },
      // Define specific transformations for each collection
      transformations: {
        'vaccinations': {
          flatten: ['CanonicalJSON.content[openEHR-EHR-SECTION.immunisation_list.v0].items[openEHR-EHR-ACTION.medication.v1]'],
          extract: {
            'vaccine': 'items.activities.description.items[at0003].value.value',
            'date': 'time.value',
            'performer': 'other_participations.performer.name'
          }
        },
        'problems': {
          flatten: ['CanonicalJSON.content[openEHR-EHR-SECTION.problem_list.v0].items'],
          extract: {
            'problem': 'items.data.items[at0002].value.value',
            'onset': 'items.data.items[at0003].value.value'
          }
        }
      },
      indexes: [
        { collection: 'vaccinations', field: 'ehrid', type: 'hashed' },
        { collection: 'vaccinations', field: 'vaccine', type: 'text' },
        { collection: 'vaccinations', field: 'date', type: 'date' },
        { collection: 'problems', field: 'ehrid', type: 'hashed' },
        { collection: 'problems', field: 'problem', type: 'text' }
      ]
    }, null, 2)
  }
];

/**
 * Get available strategy presets for synthetic data generation
 * @route GET /api/synthetic-data/presets
 */
export async function GET() {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;

    return NextResponse.json(strategyPresets);
  } catch (error) {
    console.error('Error fetching strategy presets:', error);
    return safeErrorResponse(error, 'Failed to fetch strategy presets');
  }
}
