# Scripts

This directory contains utility scripts for database maintenance and data management.

## Generate Template Descriptions

### Overview
The `generateTemplateDescriptions.js` script automatically generates intelligent, human-readable descriptions for sample templates based on their metadata.

### What It Does
- Analyzes template metadata (entry types, archetypes, languages, terminologies, complexity)
- Generates coherent, descriptive sentences that explain what each template is for
- Updates the database with generated descriptions
- Skips templates that already have descriptions

### Example Descriptions Generated

**Before:** No description

**After:** "A persistent template for capturing Medication order, Medication statement, and Medication action (+2 more) including 45 archetypes. Available in en, de, sv. Uses SNOMED-CT terminology. Moderate complexity."

### Usage

1. **Set environment variables** (or use defaults):
   ```bash
   export CORE_DB_URI="mongodb://localhost:27017"
   export CORE_DB_NAME="healthcareDataLab"
   ```

2. **Run the script**:
   ```bash
   npm run generate-descriptions
   ```

   Or directly:
   ```bash
   node scripts/generateTemplateDescriptions.js
   ```

### Output
The script will:
- Connect to your database
- Fetch all templates from `sample-templates` collection
- Generate descriptions for templates without one
- Update the database
- Print a summary report

Example output:
```
🚀 Starting template description generation...

Connecting to database...
Fetching templates...
Found 50 templates

Template: Vaccination summary
Generated: A persistent template for capturing Medication action including 8 archetypes. Available in en. Simple and straightforward.

Template: Vital signs
Generated: An encounter template for capturing Blood pressure, Body temperature, and Pulse/Heart beat (+3 more) including 15 archetypes. Available in en, de, sv. Uses SNOMED-CT terminology. Moderate complexity.

============================================================
✅ Update complete!
   Updated: 45 templates
   Skipped: 5 templates (already had descriptions)
   Total: 50 templates
============================================================
```

### How Descriptions Are Generated

The script analyzes the following metadata:

1. **Composition Kind**: Event, persistent, episode, etc.
2. **Entry Types**: Main clinical concepts (observations, actions, evaluations)
3. **Archetype Count**: Number of archetypes included
4. **Languages**: Available translations
5. **Terminologies**: Supported terminology systems (SNOMED-CT, LOINC, etc.)
6. **Complexity**: Based on node count (simple, moderate, complex)

### Configuration

Edit the `generateDescription()` function in the script to customize:
- Description format
- Which metadata fields to include
- Complexity thresholds
- Language formatting

### Safety Features

- **Non-destructive**: Only updates templates without descriptions
- **Audit trail**: Updates `audit.updatedAt` and `audit.updatedBy` fields
- **Preview mode**: Check console output before confirming changes
- **Error handling**: Gracefully handles missing or incomplete metadata

### Database Schema

Updates the following fields:
```javascript
{
  metadata: {
    description: "Generated description..."
  },
  audit: {
    updatedAt: ISODate("..."),
    updatedBy: "system-description-generator"
  }
}
```

### Troubleshooting

**Connection Error:**
- Verify CORE_DB_URI is correct
- Ensure MongoDB is running
- Check network connectivity

**No Templates Updated:**
- All templates may already have descriptions
- Check the "Skipped" count in output
- Verify collection name is correct

**Permission Error:**
- Ensure database user has write permissions
- Check MongoDB user roles

### Advanced Usage

**Update Only Specific Templates:**
Modify the script to add a filter:
```javascript
const templates = await collection.find({
  name: { $regex: /vaccination/i }
}).toArray();
```

**Regenerate All Descriptions:**
Remove the skip condition:
```javascript
// Comment out or remove this block:
// if (template.metadata?.description) {
//   skippedCount++;
//   continue;
// }
```

**Dry Run (Preview Only):**
Comment out the update operation:
```javascript
// await collection.updateOne(...);
console.log(`Would update: ${template.name}`);
```
