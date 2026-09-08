import { NextResponse } from 'next/server';
import { getCoreDb } from '@/lib/db/coreDb';
import { createKehrnelService } from '@/lib/kehrnel/KehrnelService';
import { requireAuthenticatedUser, safeErrorResponse } from '@/lib/security/api';

export const dynamic = 'force-dynamic';

/**
 * Default agentic configurations for various domains
 * Used as fallback when Kehrnel is unavailable
 *
 * Schema: agentic/1
 */
const DEFAULT_AGENTIC_CONFIGS = {
  X12: {
    schema: 'agentic/1',
    agentId: 'co.builder.x12.v1',
    version: '1.0.0',
    domain: 'X12',
    hints: {
      preferredBlocks: [
        'block.Address.v1',
        'block.Name.v1',
        'block.Contact.v1',
        'block.Diagnosis.v1',
        'block.Procedure.v1'
      ],
      // Emit defaults by data type (v1 expanded policies)
      emitDefaults: {
        code: 'code',        // Emit when type is code
        reference: 'ref',    // Emit when type is reference
        date: 'date',        // Emit when type is date/datetime
        datetime: 'date',
        string: 'auto',      // Auto-decide based on semantic context
        number: 'value',     // Emit when has value
        quantity: 'value',
        boolean: 'never'     // Don't emit booleans by default
      },
      avoid: [
        'storing FHIR/openEHR paths in definitions (compute on export)',
        'deeply nested structures (prefer flat with role:block references)',
        'redundant terminology bindings'
      ],
      naming: {
        attributes: 'camelCase',
        blocks: 'block.PascalCase.v1',
        nodeIds: 'n-<random9>'
      },
      // v1: Explicit role guidance
      roles: {
        section: 'Top-level logical grouping (e.g., PatientInfo, ServiceLine)',
        group: 'Container for related fields (e.g., address fields, name parts)',
        field: 'Leaf value node',
        event: 'Temporal occurrence with timestamp',
        event_series: 'Container for repeating events',
        block: 'Reference to reusable block (requires blockId + versionRange)'
      }
    },
    prompts: {
      proposeFromInstance: `Given a JSON instance, propose a ContextObject (co/1 schema) with:
1. Appropriate scope (business_object, event, document)
2. Meaningful node names and attributes (camelCase)
3. Correct data types and occurrences
4. emit: 'code' for codes, 'ref' for references, 'date' for dates
5. Suggest reusable blocks for repeated structures (role: 'block')
6. Use timeRole: 'timestamp' for event dates`,

      suggestBlocks: `Analyze the node tree and recommend blocks to extract:
1. Subtrees that appear more than once (DRY principle)
2. Common healthcare patterns (Address, Name, Contact)
3. Domain-specific structures (Diagnosis, Procedure)
Return block suggestions with:
- Proposed blockId (format: block.Name.v1)
- COQL path to extract
- Description of the block's purpose`,

      extractBlock: `Extract the subtree at the specified COQL path as a block/1 document:
1. Create a new root node (parentNodeId: null)
2. Preserve all child nodes with updated parent references
3. Generate blockId following format block.Name.v1
4. Set defaultEmit based on node types
5. Add appropriate metadata and description`,

      validateModel: `Review the ContextObject definition for:
1. Proper tree structure (exactly one root with parentNodeId: null)
2. Valid roles: section, group, field, event, event_series, block
3. Appropriate emit policies (auto, never, always, code, ref, date, value)
4. role: 'block' nodes must have blockId and versionRange
5. Events should have a child with timeRole: 'timestamp'
6. Unique nodeIds across all nodes`
    },
    examples: {
      scope: {
        business_object: 'Patient demographics, Provider info, Claim summary',
        event: 'Service line, Lab result event, Prescription fill',
        document: 'Complete 837P claim, Eligibility response, Remittance advice',
        block: 'Address, Diagnosis, Procedure code'
      },
      emit: {
        'code': "emit: 'code' - emits when dataType is 'code'",
        'ref': "emit: 'ref' - emits when dataType is 'reference'",
        'date': "emit: 'date' - emits for date/datetime types",
        'value': "emit: 'value' - emits when field has non-null value",
        'always': "emit: 'always' - always emits regardless of value",
        'never': "emit: 'never' - never emits to context"
      }
    }
  },

  FHIR: {
    schema: 'agentic/1',
    agentId: 'co.builder.fhir.v1',
    version: '1.0.0',
    domain: 'FHIR',
    hints: {
      preferredBlocks: [
        'block.HumanName.v1',
        'block.Address.v1',
        'block.ContactPoint.v1',
        'block.Identifier.v1',
        'block.CodeableConcept.v1'
      ],
      emitDefaults: {
        code: 'code',
        reference: 'ref',
        date: 'date',
        datetime: 'date',
        string: 'auto'
      },
      avoid: [
        'storing structural bindings (compute on export via Kehrnel strategies)',
        'duplicate resource mappings',
        'FHIR paths in node definitions'
      ],
      roles: {
        section: 'Resource backbone element',
        group: 'Complex type container',
        field: 'Primitive value',
        block: 'FHIR data type as reusable block'
      }
    },
    prompts: {
      proposeFromInstance: 'Given a FHIR resource JSON, propose a ContextObject (co/1) that captures the semantic structure while remaining format-agnostic. Use role: block for FHIR data types.',
      suggestBlocks: 'Identify FHIR data types that should be extracted as reusable blocks (HumanName, Address, etc.).',
      extractBlock: 'Extract the subtree as a block/1, mapping to FHIR data type conventions.',
      validateModel: 'Validate the model follows FHIR patterns and uses appropriate emit policies.'
    }
  },

  openEHR: {
    schema: 'agentic/1',
    agentId: 'co.builder.openehr.v1',
    version: '1.0.0',
    domain: 'openEHR',
    hints: {
      preferredBlocks: [
        'block.DvQuantity.v1',
        'block.DvCodedText.v1',
        'block.DvDateTime.v1',
        'block.DvText.v1',
        'block.Cluster.v1'
      ],
      emitDefaults: {
        code: 'code',
        reference: 'ref',
        datetime: 'date'
      },
      avoid: [
        'deep archetype nesting',
        'storing ADL paths in definitions (compute via strategy)',
        'embedding rm_types in node data'
      ],
      roles: {
        section: 'Archetype root',
        group: 'Cluster container',
        field: 'Element value',
        event: 'Event in an event_series',
        block: 'Reusable archetype pattern'
      }
    },
    prompts: {
      proposeFromInstance: 'Given an openEHR composition JSON, propose a ContextObject (co/1) that captures the clinical semantics.',
      suggestBlocks: 'Identify archetype patterns that should be blocks (DV_QUANTITY, DV_CODED_TEXT, etc.).',
      extractBlock: 'Extract as a block/1 following openEHR cluster conventions.',
      validateModel: 'Validate event structures have proper timeRole timestamps.'
    }
  },

  generic: {
    schema: 'agentic/1',
    agentId: 'co.builder.generic.v1',
    version: '1.0.0',
    domain: 'generic',
    hints: {
      preferredBlocks: [
        'block.Address.v1',
        'block.Name.v1',
        'block.Contact.v1'
      ],
      emitDefaults: {
        code: 'code',
        reference: 'ref',
        date: 'date'
      },
      avoid: [],
      roles: {
        section: 'Top-level grouping',
        group: 'Container for fields',
        field: 'Leaf value',
        block: 'Reusable structure'
      }
    },
    prompts: {
      proposeFromInstance: 'Analyze the JSON structure and propose a ContextObject (co/1) definition with appropriate roles and emit policies.',
      suggestBlocks: 'Find repeated structures that could be extracted as blocks.',
      extractBlock: 'Extract the subtree as a reusable block/1.',
      validateModel: 'Validate the model structure and emit policies.'
    }
  }
};

/**
 * GET /api/kehrnel/agentic/[domain] - Get agentic config for a domain
 *
 * Tries Kehrnel first, falls back to local defaults if unavailable.
 */
export async function GET(request, { params }) {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;

    const { domain } = await params;
    const decodedDomain = decodeURIComponent(domain);

    // Try Kehrnel first
    try {
      const coreDb = await getCoreDb();
      const service = createKehrnelService(coreDb);
      const config = await service.getAgenticConfig(decodedDomain);

      return NextResponse.json({
        ...config,
        _source: 'kehrnel'
      });
    } catch (kehrnelError) {
      console.warn(`Kehrnel agentic config unavailable for ${decodedDomain}:`, kehrnelError.message);

      // Fall back to local defaults
      const fallbackConfig = DEFAULT_AGENTIC_CONFIGS[decodedDomain] ||
                            DEFAULT_AGENTIC_CONFIGS.generic;

      return NextResponse.json({
        ...fallbackConfig,
        domain: decodedDomain,
        _source: 'fallback',
        _fallbackReason: kehrnelError.message
      });
    }
  } catch (error) {
    console.error('Error fetching agentic config:', error);
    return safeErrorResponse(error, 'Failed to fetch agentic config');
  }
}
