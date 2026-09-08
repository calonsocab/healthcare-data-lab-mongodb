// src/lib/syntheticDataGenerator.js

/**
 * Generates synthetic data based on selected templates and patient count
 */
export async function generateSyntheticData(options) {
  const { 
    templates, 
    patientCount, 
    strategy, 
    strategyConfig,
    environment,
    batchSize = 100,
    onProgress 
  } = options;
  
  // Get archetype IDs from selected templates
  const archetypeIds = templates.map(t => t.archetypeId);
  
  // Find available patient files with matching compositions
  const sourcePatients = await findEligiblePatientFiles(archetypeIds);
  
  if (sourcePatients.length === 0) {
    throw new Error('No eligible source patients found for the selected templates');
  }
  
  // Track progress
  let processedCount = 0;
  
  // Process in batches
  for (let i = 0; i < patientCount; i += batchSize) {
    const currentBatchSize = Math.min(batchSize, patientCount - i);
    
    // Report progress
    onProgress({
      phase: 'duplicating',
      processed: processedCount,
      total: patientCount,
      currentBatch: i / batchSize + 1,
      totalBatches: Math.ceil(patientCount / batchSize)
    });
    
    // Create batch of synthetic patients
    const syntheticBatch = await duplicatePatientsBatch(
      sourcePatients, 
      currentBatchSize,
      archetypeIds
    );
    
    // Denormalize batch if needed
    onProgress({ phase: 'denormalizing' });
    
    if (strategy === 'SingleCollection' && strategyConfig.denormalize) {
      await denormalizeBatch(syntheticBatch, strategyConfig);
    }
    
    // Upload to MongoDB
    onProgress({ phase: 'uploading' });
    await uploadToMongoDB(syntheticBatch, environment);
    
    processedCount += currentBatchSize;
    
    // Report completion of this batch
    onProgress({
      phase: 'completed',
      processed: processedCount,
      total: patientCount
    });
  }
  
  return {
    patientsGenerated: processedCount,
    templatesUsed: templates.length,
    environment: environment
  };
}

/**
 * Finds patient files that contain compositions for all specified archetypeIds
 */
async function findEligiblePatientFiles(archetypeIds) {
  const globalMetadata = await loadGlobalMetadata();
  const directories = globalMetadata.directory_structure.directories;
  const eligiblePatients = [];
  
  // Check each directory
  for (const dir of directories) {
    const dirPath = path.join(process.env.SYNTHETIC_DATA_FOLDER, dir);
    const files = await fs.readdir(dirPath);
    
    // Check each patient file
    for (const file of files) {
      if (!file.startsWith('patient_') || (!file.endsWith('.json') && !file.endsWith('.json.gz'))) {
        continue;
      }
      
      const filePath = path.join(dirPath, file);
      const patientData = await loadPatientFile(filePath);
      
      // Check if patient has compositions for all required archetypes
      const patientArchetypes = new Set(
        patientData.compositions.map(comp => comp.archetype_node_id)
      );
      
      const hasAllArchetypes = archetypeIds.every(id => patientArchetypes.has(id));
      
      if (hasAllArchetypes) {
        eligiblePatients.push({
          path: filePath,
          ehrId: patientData.ehr_id,
          compositionCount: patientData.composition_count
        });
      }
    }
  }
  
  return eligiblePatients;
}

/**
 * Duplicates a batch of patients with new IDs
 */
async function duplicatePatientsBatch(sourcePatients, batchSize, archetypeIds) {
  const batch = [];
  
  for (let i = 0; i < batchSize; i++) {
    // Choose a random source patient
    const sourceIndex = Math.floor(Math.random() * sourcePatients.length);
    const sourcePatient = sourcePatients[sourceIndex];
    
    // Load patient data
    const patientData = await loadPatientFile(sourcePatient.path);
    
    // Generate new patient ID
    const newEhrId = `patient-${uuid.v4()}`;
    
    // Clone and modify compositions
    const newCompositions = patientData.compositions
      // Filter to include only compositions with matching archetype IDs
      .filter(comp => archetypeIds.includes(comp.archetype_node_id))
      // Clone and modify each composition
      .map(comp => {
        const newComp = {...comp};
        newComp._id = uuid.v4();
        newComp.ehr_id = newEhrId;
        newComp.last_processed = new Date();
        return newComp;
      });
    
    batch.push({
      ehrId: newEhrId,
      compositions: newCompositions
    });
  }
  
  return batch;
}

/**
 * Denormalizes a batch of patients
 */
async function denormalizeBatch(batch, strategyConfig) {
  // Create temporary config file
  const tempDir = path.join(process.cwd(), 'tmp');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
  
  const configPath = path.join(tempDir, `batch_${Date.now()}.json`);
  const config = {
    mongo_uri: process.env.MONGODB_URI,
    source_db: "openehr_dataLab",
    target_db: "openehr_dataLab",
    compositions_collection: "compositions",
    meta_collection: "metaIndex",
    patient_batch_size: batch.length,
    strategy: "SingleCollection",
    strategy_config: strategyConfig,
    patient_filter: {
      ehr_id: { $in: batch.map(p => p.ehrId) }
    }
  };
  
  fs.writeFileSync(configPath, JSON.stringify(config));
  
  // Run denormalizer
  const pythonScript = path.join(process.cwd(), 'scripts', 'denormalizer.py');
  
  return new Promise((resolve, reject) => {
    const process = spawn('python', [pythonScript, '--config', configPath]);
    
    process.on('close', (code) => {
      // Clean up
      fs.unlinkSync(configPath);
      
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Denormalizer exited with code ${code}`));
      }
    });
  });
}

/**
 * Uploads a batch of patients to MongoDB
 */
async function uploadToMongoDB(batch, environment) {
  const { client, db } = await connectToDatabase(environment);
  
  try {
    const compositionsCollection = db.collection('compositions');
    const metaIndexCollection = db.collection('metaIndex');
    
    // Prepare bulk operations
    const compositionOps = [];
    const metaOps = [];
    
    for (const patient of batch) {
      // Add compositions
      patient.compositions.forEach(comp => {
        compositionOps.push({
          insertOne: { document: comp }
        });
      });
      
      // Create metaIndex document
      metaOps.push({
        insertOne: {
          document: {
            ehr_id: patient.ehrId,
            created: new Date(),
            document_count: patient.compositions.length,
            documents: patient.compositions.map(comp => ({
              id: comp._id,
              archetype_id: comp.archetype_node_id,
              template_id: comp.template_id
            }))
          }
        }
      });
    }
    
    // Execute bulk operations
    if (compositionOps.length > 0) {
      await compositionsCollection.bulkWrite(compositionOps);
    }
    
    if (metaOps.length > 0) {
      await metaIndexCollection.bulkWrite(metaOps);
    }
  } finally {
    client.close();
  }
}

/**
 * Loads a patient file, handling compression if needed
 */
async function loadPatientFile(filePath) {
  const fileData = await fs.readFile(filePath);
  
  // Check if the file is compressed
  if (filePath.endsWith('.gz')) {
    // Decompress the file
    const decompressed = await util.promisify(zlib.gunzip)(fileData);
    return JSON.parse(decompressed.toString());
  } else {
    // File is not compressed
    return JSON.parse(fileData.toString());
  }
}