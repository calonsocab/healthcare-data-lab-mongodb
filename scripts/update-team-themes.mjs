// scripts/update-team-themes.mjs
// Updates all teams with the MongoDB Healthcare Data Lab theme
// Excludes: "Gustave Roussy Clinical Rep."

import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const NEW_THEME = {
  name: "Dark Mode",
  primary: "#01ec63",
  primaryHover: "#01694a",
  background: "#011e2b",
  surface: "#053e3a",
  surfaceHover: "#011e2b",
  border: "#334155",
  text: "#F1F5F9",
  textSecondary: "#e7ff98",
  success: "#10B981",
  warning: "#F59E0B",
  error: "#EF4444"
};

const EXCLUDED_TEAMS = [
  "Gustave Roussy Clinical Rep."
];

async function updateTeamThemes() {
  const uri = process.env.CORE_MONGODB_URL;
  const dbName = process.env.CORE_DATABASE_NAME || 'openehr_core';

  if (!uri) {
    console.error('CORE_MONGODB_URL is not set in .env.local');
    process.exit(1);
  }

  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('Connected to MongoDB');

    const db = client.db(dbName);
    const teamsCollection = db.collection('teams');

    // Find all teams that are NOT in the excluded list
    const filter = {
      name: { $nin: EXCLUDED_TEAMS }
    };

    // Count teams to be updated
    const countBefore = await teamsCollection.countDocuments(filter);
    console.log(`Found ${countBefore} teams to update (excluding: ${EXCLUDED_TEAMS.join(', ')})`);

    if (countBefore === 0) {
      console.log('No teams to update. Exiting.');
      return;
    }

    // Update all matching teams
    const result = await teamsCollection.updateMany(
      filter,
      {
        $set: {
          theme: NEW_THEME,
          updatedAt: new Date()
        }
      }
    );

    console.log(`Successfully updated ${result.modifiedCount} teams with new theme`);

    // List updated teams
    const updatedTeams = await teamsCollection.find(filter, { projection: { name: 1 } }).toArray();
    console.log('\nUpdated teams:');
    updatedTeams.forEach(team => console.log(`  - ${team.name}`));

  } catch (error) {
    console.error('Error updating teams:', error);
    process.exit(1);
  } finally {
    await client.close();
    console.log('\nDisconnected from MongoDB');
  }
}

updateTeamThemes();
