# Migration Guide: Adding FHIR & Genomics Strategies

## Issue

If the `/api/persistence-strategies` endpoint is hanging, it's because the old `ensureSystemStrategies` function is comparing large JSON objects on every request.

## Quick Fix (Recommended)

**Option 1: Delete old system strategies from MongoDB**

```javascript
// In MongoDB Compass or mongosh:
use openehr; // or your database name

// Delete all old system strategies
db.persistence_strategies.deleteMany({ ownerType: 'system' });

// Restart your app - new strategies will be auto-inserted
```

**Option 2: Use MongoDB Compass UI**

1. Open MongoDB Compass
2. Connect to your database
3. Navigate to `persistence_strategies` collection
4. Filter: `{ "ownerType": "system" }`
5. Select all documents and delete
6. Restart your Next.js app (`npm run dev`)

**Option 3: Keep old strategies, manually add new ones**

If you want to keep the existing 4 openEHR strategies:

```javascript
// The app will detect only 4 exist (expects 6)
// It will auto-insert the 2 missing ones:
// - FHIR Resource-First
// - Genomics Variant-First
```

## Verification

After clearing/updating:

1. Restart app: `npm run dev`
2. Navigate to Strategy Studio
3. You should see:
   - 4 openEHR strategies (🏥 teal)
   - 1 FHIR strategy (🔥 red)
   - 1 Genomics strategy (🧬 purple)

## Performance Note

The optimized `ensureSystemStrategies` function now:
- ✅ **Fast path**: Exits immediately if 6 strategies exist
- ✅ **No JSON.stringify**: Removed expensive comparisons
- ✅ **Insert-only**: New strategies are inserted, old ones are NOT updated

This means the API call completes in <100ms instead of timing out.
