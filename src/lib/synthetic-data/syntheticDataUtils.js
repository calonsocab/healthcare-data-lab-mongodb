// src/lib/syntheticDataUtils.js
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs/promises';
import { existsSync, writeFileSync, mkdirSync } from 'fs';
import { gunzip } from 'zlib';
import { promisify } from 'util';

const gunzipAsync = promisify(gunzip);

/**
 * Run the Python denormalization script
 * @param {string} jobId - Job identifier
 * @param {object} config - Configuration for the denormalizer
 * @returns {Promise<object>} - Result of the denormalization process
 */
export async function runDenormalization(jobId, config) {
  return new Promise((resolve, reject) => {
    try {
      const pythonBin = process.env.PYTHON_BINARY || 'python';
      // Ensure tmp directory exists
      const tmpDir = path.join(process.cwd(), 'tmp');
      if (!existsSync(tmpDir)) {
        mkdirSync(tmpDir, { recursive: true });
      }

      // Create a temporary config file for this job
      const configPath = path.join(tmpDir, `${jobId}_config.json`);
      writeFileSync(configPath, JSON.stringify(config, null, 2));

      // Path to Python script
      const scriptPath = path.join(process.cwd(), 'src', 'scripts', 'denormalizer.py');

      console.log(`[Denormalizer] Running script at ${scriptPath} with config ${configPath}`);

      // Spawn Python process
      const pythonProcess = spawn(pythonBin, [scriptPath, '--config', configPath]);

      // Collect output
      let output = '';
      let errorOutput = '';

      pythonProcess.stdout.on('data', (data) => {
        const message = data.toString();
        output += message;
        console.log(`[Denormalizer] ${message}`);
      });

      pythonProcess.stderr.on('data', (data) => {
        const message = data.toString();
        errorOutput += message;
        console.error(`[Denormalizer Error] ${message}`);
      });

      pythonProcess.on('close', (code) => {
        // Clean up temporary config file
        try {
          fs.unlink(configPath);
        } catch (err) {
          console.error(`[Denormalizer] Error removing temp config: ${err.message}`);
        }

        if (code === 0) {
          resolve({ success: true, output });
        } else {
          reject(new Error(`Denormalizer process exited with code ${code}: ${errorOutput}`));
        }
      });
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Group synthetic composition files by patient
 * @param {string} syntheticDataFolder - Path to synthetic data folder
 * @returns {Promise<Array>} - Array of patient data sets
 */
export async function groupCompositionsByPatient(syntheticDataFolder) {
  try {
    const patientMap = new Map();
    await traverseSyntheticFolder(syntheticDataFolder, patientMap);

    return Array.from(patientMap.entries()).map(([ehrId, compositions]) => ({
      ehrId,
      compositions
    }));
  } catch (error) {
    console.error('Error grouping compositions by patient:', error);
    return [];
  }
}

async function traverseSyntheticFolder(currentPath, patientMap) {
  const entries = await fs.readdir(currentPath, { withFileTypes: true });
  for (const entry of entries) {
    const entryPath = path.join(currentPath, entry.name);
    if (entry.isDirectory()) {
      await traverseSyntheticFolder(entryPath, patientMap);
      continue;
    }

    const isJson = entry.name.endsWith('.json');
    const isJsonGz = entry.name.endsWith('.json.gz');
    if (!entry.isFile() || (!isJson && !isJsonGz)) continue;

    try {
      const patientRecords = await readSyntheticFile(entryPath);
      for (const record of patientRecords) {
        if (!patientMap.has(record.ehrId)) {
          patientMap.set(record.ehrId, []);
        }
        patientMap.get(record.ehrId).push(...record.compositions);
      }
    } catch (err) {
      console.error(`Error reading synthetic file ${entryPath}:`, err);
    }
  }
}

async function readSyntheticFile(filePath) {
  const raw = await fs.readFile(filePath);
  const buffer = filePath.endsWith('.gz') ? await gunzipAsync(raw) : raw;
  const payload = JSON.parse(buffer.toString('utf8'));

  if (Array.isArray(payload)) {
    return payload
      .map(normalizePatientRecord)
      .filter(Boolean);
  }

  const normalized = normalizePatientRecord(payload);
  return normalized ? [normalized] : [];
}

function normalizePatientRecord(patient) {
  if (!patient) return null;

  const ehrId = patient.ehr_id || patient.ehrId;
  if (!ehrId) return null;

  if (Array.isArray(patient.compositions) && patient.compositions.length) {
    const compositions = patient.compositions
      .map(normalizeComposition)
      .filter(Boolean);
    if (!compositions.length) return null;
    return { ehrId, compositions };
  }

  const singleComp = normalizeComposition(patient);
  if (!singleComp) return null;
  return { ehrId, compositions: [singleComp] };
}

function normalizeComposition(comp) {
  if (!comp) return null;
  const archetypeNodeId = comp.archetype_node_id || comp.archetypeNodeId;
  if (!archetypeNodeId) return null;
  return {
    composition: comp,
    archetypeNodeId
  };
}

/**
 * Filter patient data sets by archetype IDs
 * @param {Array} patientDataSets - Array of patient data sets
 * @param {Array} archetypeIds - Array of archetype IDs to filter by
 * @returns {Array} - Filtered array of patient data sets
 */
export function filterPatientDataSetsByArchetype(patientDataSets, archetypeIds) {
  // If no archetype IDs provided, return all patient data sets
  if (!archetypeIds || !archetypeIds.length) {
    return patientDataSets;
  }

  return patientDataSets.map(patientSet => {
    // Filter compositions: include if archetype matches OR if composition has no archetypeNodeId
    // (compositions without archetype were already matched by template_id in fetchSamplePatients)
    const filteredCompositions = patientSet.compositions.filter(comp => {
      // If composition has no archetypeNodeId, include it (matched by template_id)
      if (!comp.archetypeNodeId) {
        return true;
      }
      // Otherwise, check if archetype matches
      return archetypeIds.includes(comp.archetypeNodeId);
    });

    return {
      ...patientSet,
      compositions: filteredCompositions
    };
  }).filter(patientSet => patientSet.compositions.length > 0);
}
