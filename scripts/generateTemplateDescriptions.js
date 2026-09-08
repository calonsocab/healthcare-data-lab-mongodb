// scripts/generateTemplateDescriptions.js
/**
 * Script to generate intelligent descriptions for sample templates
 * based on their metadata and update the database
 */

const { MongoClient } = require('mongodb');
const path = require('path');

// Load environment variables from .env.local
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

// Use MONGODB_URI directly (CORE_MONGODB_URL has shell variable substitution which dotenv doesn't support)
let CORE_DB_URI = process.env.MONGODB_URI;
const CORE_DB_NAME = process.env.CORE_DATABASE_NAME || 'openehr_core';

if (!CORE_DB_URI) {
  console.error('❌ Error: MONGODB_URI environment variable is not set');
  console.log('\nPlease set it in your .env.local file at the root of the project');
  console.log('MONGODB_URI=mongodb://username:password@host:port/database');
  process.exit(1);
}

// Remove quotes if present
CORE_DB_URI = CORE_DB_URI.replace(/^["']|["']$/g, '');

// Validate the connection string format
if (!CORE_DB_URI.startsWith('mongodb://') && !CORE_DB_URI.startsWith('mongodb+srv://')) {
  console.error('❌ Error: Invalid MongoDB connection string format');
  console.log(`\nReceived: ${CORE_DB_URI}`);
  console.log('\nExpected format: mongodb://... or mongodb+srv://...');
  process.exit(1);
}

/**
 * Generate a human-readable description from template metadata
 */
function generateDescription(template) {
  const metadata = template.metadata || {};
  const name = template.name || 'Unnamed Template';

  // Build description parts
  const parts = [];

  // Start with template type and purpose
  if (metadata.compositionKind) {
    const kind = metadata.compositionKind.toLowerCase();
    parts.push(`A ${kind} template`);
  } else {
    parts.push('An openEHR clinical template');
  }

  // Add entry types information
  if (metadata.entryTypes && metadata.entryTypes.length > 0) {
    const entryNames = metadata.entryTypes
      .slice(0, 3)
      .map(e => e.name || e.nodeId)
      .filter(Boolean)
      .map(name => {
        // Clean up entry names
        return name.replace(/openEHR-EHR-/gi, '')
                   .replace(/\.v\d+$/i, '')
                   .replace(/_/g, ' ');
      });

    if (entryNames.length === 1) {
      parts.push(`designed for ${entryNames[0].toLowerCase()}`);
    } else if (entryNames.length === 2) {
      parts.push(`for ${entryNames[0].toLowerCase()} and ${entryNames[1].toLowerCase()}`);
    } else if (entryNames.length >= 3) {
      const last = entryNames.pop();
      const first = entryNames.map(n => n.toLowerCase()).join(', ');
      parts.push(`for ${first}, and ${last.toLowerCase()}`);
      if (metadata.entryTypes.length > 3) {
        const remaining = metadata.entryTypes.length - 3;
        parts.push(`plus ${remaining} additional clinical concept${remaining > 1 ? 's' : ''}`);
      }
    }
  } else {
    // If no entry types, try to infer from name
    parts.push(`for clinical data capture`);
  }

  // Add archetype count if significant
  if (metadata.archetypes && metadata.archetypes.length > 0) {
    const count = metadata.archetypes.length;
    if (count > 20) {
      parts.push(`Built with ${count} archetypes for comprehensive data collection`);
    } else if (count > 10) {
      parts.push(`Includes ${count} structured archetypes`);
    } else if (count > 1) {
      parts.push(`Uses ${count} clinical archetypes`);
    }
  }

  // Add language support
  if (metadata.languages && metadata.languages.length > 0) {
    const langs = metadata.languages.map(l => l.toUpperCase());
    const langList = langs.slice(0, 3).join(', ');
    if (langs.length === 1) {
      parts.push(`Available in ${langList}`);
    } else if (langs.length <= 3) {
      parts.push(`Multi-language support: ${langList}`);
    } else {
      parts.push(`Multi-language support: ${langList} (+${langs.length - 3} more)`);
    }
  }

  // Add terminology information
  if (metadata.terminologies && metadata.terminologies.length > 0) {
    const termList = metadata.terminologies.slice(0, 2).join(', ');
    if (metadata.terminologies.length === 1) {
      parts.push(`Coded with ${termList}`);
    } else if (metadata.terminologies.length <= 2) {
      parts.push(`Supports ${termList} terminologies`);
    } else {
      parts.push(`Multi-terminology support including ${termList}`);
    }
  }

  // Add complexity indicator
  if (metadata.counts) {
    const nodeCount = metadata.counts.nodeCount || 0;
    const valueNodes = metadata.counts.valueNodeCount || 0;

    if (nodeCount > 100 || valueNodes > 50) {
      parts.push('Comprehensive template with extensive data points');
    } else if (nodeCount > 50 || valueNodes > 25) {
      parts.push('Moderately detailed template');
    } else if (nodeCount > 0) {
      parts.push('Streamlined and focused template');
    }
  }

  // Join parts into a coherent sentence
  let description = parts.join('. ');

  // Ensure it ends with a period
  if (!description.endsWith('.')) {
    description += '.';
  }

  // Capitalize first letter
  description = description.charAt(0).toUpperCase() + description.slice(1);

  return description;
}

/**
 * Main function to update all templates
 */
async function updateTemplateDescriptions() {
  const client = new MongoClient(CORE_DB_URI);

  try {
    console.log('Connecting to database...');
    await client.connect();
    const db = client.db(CORE_DB_NAME);
    const collection = db.collection('sample-templates');

    // Find all templates
    console.log('Fetching templates...');
    const templates = await collection.find({}).toArray();
    console.log(`Found ${templates.length} templates`);

    let updatedCount = 0;
    let skippedCount = 0;

    for (const template of templates) {
      // Skip if already has a meaningful description
      const currentDescription = template.metadata?.description?.trim() || '';
      const hasValidDescription = currentDescription.length > 0 &&
                                   currentDescription !== 'No description available' &&
                                   !currentDescription.toLowerCase().includes('no description');

      if (hasValidDescription) {
        console.log(`Skipping "${template.name}" - already has description`);
        skippedCount++;
        continue;
      }

      // Generate description
      const description = generateDescription(template);
      console.log(`\nTemplate: ${template.name}`);
      console.log(`Generated: ${description}`);

      // Update the template
      await collection.updateOne(
        { _id: template._id },
        {
          $set: {
            'metadata.description': description,
            'audit.updatedAt': new Date(),
            'audit.updatedBy': 'system-description-generator'
          }
        }
      );

      updatedCount++;
    }

    console.log('\n' + '='.repeat(60));
    console.log(`✅ Update complete!`);
    console.log(`   Updated: ${updatedCount} templates`);
    console.log(`   Skipped: ${skippedCount} templates (already had descriptions)`);
    console.log(`   Total: ${templates.length} templates`);
    console.log('='.repeat(60));

  } catch (error) {
    console.error('Error updating templates:', error);
    process.exit(1);
  } finally {
    await client.close();
    console.log('\nDatabase connection closed.');
  }
}

// Run the script
console.log('🚀 Starting template description generation...\n');
updateTemplateDescriptions();
