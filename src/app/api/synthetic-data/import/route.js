// src/app/api/synthetic-data/import/route.js

import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { promises as fs } from 'fs';
import path from 'path';
import { createReadStream } from 'fs';
import { createInterface } from 'readline';
import { requireAuthenticatedUser, safeErrorResponse } from '@/lib/security/api';
import { getCoreDb } from '@/lib/db/coreDb';
import {
  enforceApiRateLimit,
  enforceNumericLimit,
  resolvePolicyContext
} from '@/lib/security/teamPolicy';
import { enforceEnvironmentControl, ENV_CONTROL_CAPABILITY } from '@/lib/security/environmentControls';
import { parseFormDataWithLimit } from '@/lib/uploads/bodyLimit';
import { getSyntheticDataRootDir } from '@/lib/synthetic-data/storage';

function getMaxImportFileSize() {
  const raw = Number.parseInt(process.env.SYNTHETIC_IMPORT_MAX_FILE_SIZE_MB || '50', 10);
  const maxMb = Number.isFinite(raw) && raw > 0 ? raw : 50;
  return maxMb * 1024 * 1024;
}

/**
 * Import custom composition data for synthetic data generation
 * @route POST /api/synthetic-data/import
 */
export async function POST(req) {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;
    const coreDb = await getCoreDb();
    const policyContext = await resolvePolicyContext(coreDb, auth.session?.user?.email);
    await enforceApiRateLimit(coreDb, policyContext, 'synthetic-import:post');

    // Best-effort: if the client provides an active environment header, enforce controls.
    const activeEnvId = (
      req.headers.get('x-active-env')
      || req.headers.get('x-env-id')
      || req.headers.get('x-environment-id')
      || ''
    ).toString().trim();
    if (activeEnvId) {
      const envGate = await enforceEnvironmentControl(coreDb, activeEnvId, ENV_CONTROL_CAPABILITY.WRITE);
      if (envGate) return envGate;
    }
    
    // Compute max file size (policy/env) before reading the body to prevent DoS.
    const envMaxFileSize = getMaxImportFileSize();
    const policyMaxFileSize = policyContext?.policy?.limits?.maxUploadFileBytes;
    const maxFileSize =
      Number.isFinite(policyMaxFileSize) && policyMaxFileSize > 0
        ? Math.min(envMaxFileSize, policyMaxFileSize)
        : envMaxFileSize;

    // Process form data (bounded)
    const formData = await parseFormDataWithLimit(req, maxFileSize + (1 * 1024 * 1024));
    const file = formData.get('file');
    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }
    
    // Check file size
    enforceNumericLimit(
      maxFileSize,
      file.size,
      {
        code: 'TEAM_UPLOAD_FILE_TOO_LARGE',
        status: 413,
        message: `File size exceeds maximum allowed (${Math.round(maxFileSize / (1024 * 1024))}MB)`,
        details: { fileSize: file.size, maxFileSize }
      }
    );
    
    // Sanitize and validate filename to prevent path traversal
    const originalFileName = file.name;
    
    // Extract only the base filename
    const fileName = path.basename(originalFileName);
    
    if (fileName !== originalFileName || 
        fileName.includes('..') || 
        fileName.includes('/') || 
        fileName.includes('\\') ||
        fileName.includes('\0') ||
        !fileName || 
        fileName.length === 0) {
      return NextResponse.json({ 
        error: 'Invalid filename detected' 
      }, { status: 400 });
    }
    
    // Strict file extension validation - prevent double extensions
    const lowerFileName = fileName.toLowerCase();
    
    // Check for valid single extension only (no double extensions like .exe.json)
    const jsonExtRegex = /^[a-zA-Z0-9_\-]+\.json$/;
    const jsonlExtRegex = /^[a-zA-Z0-9_\-]+\.jsonl$/;
    
    if (!jsonExtRegex.test(lowerFileName) && !jsonlExtRegex.test(lowerFileName)) {
      return NextResponse.json({ 
        error: 'Only JSON (.json) or JSON Lines (.jsonl) files are supported' 
      }, { status: 400 });
    }
    
    const validMimeTypes = ['application/json', 'application/x-ndjson', 'application/jsonl', 'text/plain'];
    if (file.type && !validMimeTypes.includes(file.type.toLowerCase())) {
      return NextResponse.json({ 
        error: 'Invalid file type detected' 
      }, { status: 400 });
    }
    
    // Create a unique ID for this import
    const importId = uuidv4();
    
    // Ensure temporary directory exists
    const tmpDir = path.join(process.cwd(), 'tmp');
    const syntheticDataRoot = getSyntheticDataRootDir();
    const importDir = path.join(syntheticDataRoot, 'imports', importId);
    
    await fs.mkdir(tmpDir, { recursive: true });
    await fs.mkdir(importDir, { recursive: true });
    
    // Save the uploaded file to temp directory
    const uploadedFilePath = path.join(tmpDir, `import_${importId}_${fileName}`);
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await fs.writeFile(uploadedFilePath, buffer);
    
    // Use try-finally to ensure temp file cleanup even on errors
    try {
      // Process the file - determine if it's JSON or JSONL
      const isJsonl = fileName.endsWith('.jsonl');
      
      // Track summary data
      const summary = {
        compositionCount: 0,
        patientCount: 0,
        templateCount: 0,
        archetypeCount: 0,
        importId
      };
      
      // Set to track unique values
      const ehrIds = new Set();
      const templateIds = new Set();
      const archetypeIds = new Set();
      
      // Validate and process file based on type
      if (isJsonl) {
        // Process line by line for JSONL
        let lineNumber = 0;
        const rl = createInterface({
          input: createReadStream(uploadedFilePath)
        });
        
        // Process each line
        for await (const line of rl) {
          lineNumber++;
          try {
            if (line.trim()) {
              const patientData = JSON.parse(line);
              
              // Validate each patient object has the required format
              if (!validatePatientObject(patientData)) {
                throw new Error(`Invalid patient data format at line ${lineNumber}`);
              }
              
              // Process patient data
              processPatient(patientData, summary, ehrIds, templateIds, archetypeIds);
              
              // Save patient file
              await savePatientFile(patientData, importDir);
            }
          } catch (error) {
            console.error(`Error processing line ${lineNumber}:`, error);
            return NextResponse.json({ 
              error: 'Error processing file data'
            }, { status: 400 });
          }
        }
        
      } else {
        // Process regular JSON file
        try {
          const fileContent = await fs.readFile(uploadedFilePath, 'utf8');
          const patientData = JSON.parse(fileContent);
          
          // Validate patient object has the required format
          if (!validatePatientObject(patientData)) {
            throw new Error('Invalid patient data format');
          }
          
          // Process patient data
          processPatient(patientData, summary, ehrIds, templateIds, archetypeIds);
          
          // Save patient file
          await savePatientFile(patientData, importDir);
          
        } catch (error) {
          console.error('Error processing JSON file:', error);
          return NextResponse.json({ 
            error: 'Error processing file data'
          }, { status: 400 });
        }
      }
      
      // Update summary with counts from sets
      summary.patientCount = ehrIds.size;
      summary.templateCount = templateIds.size;
      summary.archetypeCount = archetypeIds.size;
      
      // Save import metadata
      await fs.writeFile(
        path.join(importDir, 'import_metadata.json'), 
        JSON.stringify({
          importId,
          fileName,
          importDate: new Date().toISOString(),
          summary,
          ehrIds: Array.from(ehrIds),
          templateIds: Array.from(templateIds),
          archetypeIds: Array.from(archetypeIds)
        }, null, 2)
      );
      
      // Update global metadata with this import
      await updateGlobalMetadata(importId, summary);
      
      return NextResponse.json({
        success: true,
        importId,
        summary,
        importDate: new Date().toISOString(),
        message: `Successfully imported ${summary.compositionCount} compositions from ${summary.patientCount} patients`
      });
      
    } finally {
      // Always clean up temp file, even on error
      try {
        await fs.unlink(uploadedFilePath);
      } catch (unlinkError) {
        console.error('Error cleaning up temporary file:', unlinkError);
        // Continue - don't fail the request just because cleanup failed
      }
    }
    
  } catch (error) {
    console.error('Error importing composition data:', error);
    return safeErrorResponse(error, 'Failed to import composition data');
  }
}

/**
 * Validate that a patient object has the required format
 * @param {Object} patient - Patient data object
 * @returns {boolean} - True if valid, false otherwise
 */
function validatePatientObject(patient) {
  // Check for required fields
  if (!patient.ehr_id) {
    throw new Error('Missing required field: ehr_id');
  }
  
  if (!patient.compositions || !Array.isArray(patient.compositions) || patient.compositions.length === 0) {
    throw new Error('Missing or empty compositions array');
  }
  
  // Validate each composition
  for (let i = 0; i < patient.compositions.length; i++) {
    const comp = patient.compositions[i];
    
    if (!comp._id) {
      throw new Error(`Composition at index ${i} is missing _id field`);
    }
    
    if (!comp.ehr_id) {
      throw new Error(`Composition at index ${i} is missing ehr_id field`);
    }
    
    if (comp.ehr_id !== patient.ehr_id) {
      throw new Error(`Composition at index ${i} has different ehr_id than the patient`);
    }
    
    if (!comp.archetype_node_id) {
      throw new Error(`Composition at index ${i} is missing archetype_node_id field`);
    }
    
    // Either template_id or template_name is required
    if (!comp.template_id && !comp.template_name) {
      throw new Error(`Composition at index ${i} is missing both template_id and template_name fields`);
    }
  }
  
  return true;
}

/**
 * Process a patient object and update tracking data
 * @param {Object} patient - Patient data object
 * @param {Object} summary - Summary statistics to update
 * @param {Set} ehrIds - Set of unique EHR IDs
 * @param {Set} templateIds - Set of unique template IDs
 * @param {Set} archetypeIds - Set of unique archetype IDs
 */
function processPatient(patient, summary, ehrIds, templateIds, archetypeIds) {
  // Add patient EHR ID to set
  ehrIds.add(patient.ehr_id);
  
  // Process each composition
  for (const comp of patient.compositions) {
    // Add template ID/name to set
    if (comp.template_id) {
      templateIds.add(comp.template_id);
    } else if (comp.template_name) {
      templateIds.add(comp.template_name);
    }
    
    // Add archetype node ID to set
    if (comp.archetype_node_id) {
      archetypeIds.add(comp.archetype_node_id);
    }
    
    // Increment composition count
    summary.compositionCount++;
  }
}

/**
 * Save a patient object to a file
 * @param {Object} patient - Patient data object
 * @param {string} importDir - Directory to save the file in
 */
async function savePatientFile(patient, importDir) {
  // Never use user-provided identifiers directly in file paths.
  // Keep a stable but safe filename segment.
  const safeEhrId = String(patient?.ehr_id || '')
    .trim()
    .replace(/[^a-zA-Z0-9_\-]/g, '_')
    .slice(0, 80) || 'unknown';
  const patientFileName = `patient_${safeEhrId}.json`;
  const patientFilePath = path.join(importDir, patientFileName);
  
  await fs.writeFile(
    patientFilePath,
    JSON.stringify(patient, null, 2)
  );
}

/**
 * Update global metadata file with new import information
 */
async function updateGlobalMetadata(importId, summary) {
  try {
    const metadataPath = path.join(
      getSyntheticDataRootDir(),
      'global_metadata.json'
    );
    
    let metadata;
    try {
      const metadataContent = await fs.readFile(metadataPath, 'utf8');
      metadata = JSON.parse(metadataContent);
    } catch (error) {
      // Create new metadata if file doesn't exist
      metadata = {
        summary: {
          patient_count: 0,
          composition_count: 0,
          avg_compositions_per_patient: 0,
          directory_count: 0
        },
        templates: {},
        imports: {},
        collection_date: new Date().toISOString()
      };
    }
    
    // Add the import information
    metadata.imports = metadata.imports || {};
    metadata.imports[importId] = {
      importId,
      importDate: new Date().toISOString(),
      patientCount: summary.patientCount,
      compositionCount: summary.compositionCount,
      templateCount: summary.templateCount,
      archetypeCount: summary.archetypeCount
    };
    
    // Update the global summary
    metadata.summary.patient_count += summary.patientCount;
    metadata.summary.composition_count += summary.compositionCount;
    metadata.summary.avg_compositions_per_patient = 
      metadata.summary.composition_count / metadata.summary.patient_count;
    
    // Save updated metadata
    await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));
    
  } catch (error) {
    console.error('Error updating global metadata:', error);
    // Continue despite metadata update failure
  }
}
