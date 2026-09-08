import fs from 'node:fs';
import path from 'node:path';

const SEMVER_RE = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function toNodeId(templateId, suffix) {
  return `${templateId}.${suffix}`;
}

function groupBlueprint(group) {
  if (group === 'clinicalContent') {
    return { rmType: 'SECTION', name: 'Clinical Content', aqlPath: '/content[clinicalContent]', min: 0, max: 1 };
  }
  if (group === 'claimsContent') {
    return { rmType: 'SECTION', name: 'Claims Content', aqlPath: '/content[claimsContent]', min: 0, max: 1 };
  }
  if (group === 'genomicsContent') {
    return { rmType: 'SECTION', name: 'Genomics Content', aqlPath: '/content[genomicsContent]', min: 0, max: 1 };
  }
  if (group === 'events') {
    return { rmType: 'OBSERVATION', name: 'Events', aqlPath: '/content[events]', min: 0, max: -1 };
  }
  if (group === 'assessment') {
    return { rmType: 'SECTION', name: 'Assessment', aqlPath: '/content[assessment]', min: 0, max: 1 };
  }
  return { rmType: 'SECTION', name: 'Content', aqlPath: `/content[${group}]`, min: 0, max: 1 };
}

function makeLeaf({ name, rmType, aqlPath, min = 0, max = 1, inputs = [{ type: 'TEXT' }] }) {
  return {
    name,
    localizedName: name,
    rmType,
    nodeId: '',
    min,
    max,
    localizedNames: { en: name },
    localizedDescriptions: {},
    aqlPath,
    children: [],
    inputs
  };
}

function buildContextHeader(pack) {
  const requiredAnchors = Array.isArray(pack.requiredAnchors) ? pack.requiredAnchors : [];
  const anchorLeaves = requiredAnchors.map((anchor) => makeLeaf({
    name: anchor,
    rmType: 'DV_TEXT',
    min: 1,
    max: 1,
    aqlPath: `/content[contextHeader]/items[${anchor}]/value`
  }));

  const governanceLeaves = [
    makeLeaf({ name: 'status', rmType: 'DV_TEXT', aqlPath: '/content[contextHeader]/items[status]/value' }),
    makeLeaf({ name: 'recordedAt', rmType: 'DV_DATE_TIME', aqlPath: '/content[contextHeader]/items[recordedAt]/value', inputs: [{ type: 'DATETIME' }] }),
    makeLeaf({ name: 'updatedAt', rmType: 'DV_DATE_TIME', aqlPath: '/content[contextHeader]/items[updatedAt]/value', inputs: [{ type: 'DATETIME' }] }),
    makeLeaf({ name: 'headerProfileId', rmType: 'DV_TEXT', aqlPath: '/content[contextHeader]/items[headerProfileId]/value' })
  ];

  return {
    name: 'Context Header',
    localizedName: 'Context Header',
    rmType: 'CLUSTER',
    nodeId: toNodeId(pack.templateId, 'context_header.v1'),
    min: 1,
    max: 1,
    localizedNames: { en: 'Context Header' },
    localizedDescriptions: {},
    aqlPath: '/content[contextHeader]',
    children: [...anchorLeaves, ...governanceLeaves]
  };
}

function buildGroupNode(pack, group, index) {
  const spec = groupBlueprint(group);
  const base = {
    name: spec.name,
    localizedName: spec.name,
    rmType: spec.rmType,
    nodeId: toNodeId(pack.templateId, `${group}.v1`),
    min: spec.min,
    max: spec.max,
    localizedNames: { en: spec.name },
    localizedDescriptions: {},
    aqlPath: spec.aqlPath,
    children: []
  };

  if (group === 'events') {
    base.children = [
      {
        name: 'Any event',
        localizedName: 'Any event',
        rmType: 'EVENT',
        nodeId: '',
        min: 0,
        max: 1,
        localizedNames: { en: 'Any event' },
        localizedDescriptions: {},
        aqlPath: `${spec.aqlPath}/data/events[event]`,
        children: [
          makeLeaf({ name: 'eventTime', rmType: 'DV_DATE_TIME', aqlPath: `${spec.aqlPath}/data/events[event]/items[eventTime]/value`, min: 1, max: 1, inputs: [{ type: 'DATETIME' }] }),
          makeLeaf({ name: 'value', rmType: 'DV_TEXT', aqlPath: `${spec.aqlPath}/data/events[event]/items[value]/value` })
        ]
      }
    ];
    return base;
  }

  base.children = [
    makeLeaf({
      name: `${group}Note`,
      rmType: 'DV_TEXT',
      aqlPath: `${spec.aqlPath}/items[note]/value`,
      min: index === 0 ? 1 : 0,
      max: 1
    })
  ];
  return base;
}

function collectStats(root) {
  let nodeCount = 0;
  let valueNodeCount = 0;
  let repeatingNodeCount = 0;
  const datatypes = new Set();
  const paths = [];

  const walk = (node) => {
    nodeCount += 1;
    if (typeof node.aqlPath === 'string') paths.push(node.aqlPath);
    if (typeof node.max === 'number' && (node.max === -1 || node.max > 1)) repeatingNodeCount += 1;
    if (/^DV_/.test(node.rmType || '')) {
      valueNodeCount += 1;
      datatypes.add(node.rmType);
    }
    (node.children || []).forEach(walk);
  };
  walk(root);

  return {
    counts: { nodeCount, valueNodeCount, repeatingNodeCount },
    datatypes: Array.from(datatypes).sort(),
    paths
  };
}

function computePathSignature(paths = []) {
  return paths
    .filter((item) => typeof item === 'string')
    .sort()
    .join('\n');
}

export function exportPackToWebTemplate(pack, dictionary = null) {
  const children = [
    makeLeaf({
      name: 'Category',
      rmType: 'DV_CODED_TEXT',
      min: 1,
      max: 1,
      aqlPath: '/category',
      inputs: [{ terminology: 'openehr', list: [{ code: '433', label: 'event' }] }]
    }),
    {
      name: 'Event context',
      localizedName: 'Event context',
      rmType: 'EVENT_CONTEXT',
      nodeId: '',
      min: 1,
      max: 1,
      localizedNames: { en: 'Event context' },
      localizedDescriptions: {},
      aqlPath: '/context',
      children: [
        makeLeaf({ name: 'Report ID', rmType: 'DV_TEXT', aqlPath: '/context/other_context/items[reportId]/value' }),
        makeLeaf({ name: 'Status', rmType: 'DV_TEXT', aqlPath: '/context/other_context/items[status]/value' })
      ]
    },
    buildContextHeader(pack),
    ...((pack.skeletonGroups || []).map((group, index) => buildGroupNode(pack, group, index)))
  ];

  const tree = {
    id: pack.templateId,
    name: pack.name,
    localizedName: pack.name,
    rmType: 'COMPOSITION',
    nodeId: `openEHR-EHR-COMPOSITION.${pack.templateId}.v1`,
    min: 1,
    max: 1,
    localizedNames: { en: pack.name },
    localizedDescriptions: {},
    aqlPath: '',
    children
  };

  const stats = collectStats(tree);
  const metadata = {
    templateId: pack.templateId,
    version: pack.version,
    intent: pack.intent,
    primaryAnchor: pack.primaryAnchor,
    headerProfileId: pack.headerProfileId,
    terminologyProfileId: pack.terminologyProfileId || '',
    dictionaryId: dictionary?.dictionaryId || pack.dictionaryId || '',
    datatypes: stats.datatypes,
    counts: stats.counts,
    pathSignature: computePathSignature(stats.paths)
  };

  return { ...tree, metadata };
}

export function discoverTemplatePackDirs(baseDir) {
  if (!fs.existsSync(baseDir)) return [];
  return fs.readdirSync(baseDir)
    .map((name) => path.join(baseDir, name))
    .filter((entryPath) => fs.statSync(entryPath).isDirectory())
    .sort();
}

export function loadTemplatePacks(baseDir) {
  const folders = discoverTemplatePackDirs(baseDir);
  return folders.map((folderPath) => {
    const packPath = path.join(folderPath, 'pack.json');
    const dictionaryPath = path.join(folderPath, 'dictionary.json');
    if (!fs.existsSync(packPath)) {
      throw new Error(`Missing pack.json in ${folderPath}`);
    }
    return {
      folderPath,
      folderName: path.basename(folderPath),
      pack: readJson(packPath),
      dictionary: fs.existsSync(dictionaryPath) ? readJson(dictionaryPath) : null
    };
  });
}

export function validateTemplatePacks(loadedPacks) {
  const issues = [];
  const seenTemplateIds = new Set();

  loadedPacks.forEach(({ folderName, pack, dictionary }) => {
    if (!pack.templateId || typeof pack.templateId !== 'string') {
      issues.push(`[${folderName}] templateId is required`);
    }
    if (pack.templateId !== folderName) {
      issues.push(`[${folderName}] templateId must match folder name`);
    }
    if (!SEMVER_RE.test(`${pack.version || ''}`)) {
      issues.push(`[${folderName}] version must be valid semver`);
    }
    if (seenTemplateIds.has(pack.templateId)) {
      issues.push(`[${folderName}] duplicate templateId: ${pack.templateId}`);
    }
    seenTemplateIds.add(pack.templateId);
    if (pack.dictionaryId && dictionary?.dictionaryId && pack.dictionaryId !== dictionary.dictionaryId) {
      issues.push(`[${folderName}] dictionaryId mismatch between pack.json and dictionary.json`);
    }
  });

  return issues;
}

export function parseSemver(version) {
  const m = `${version || ''}`.match(SEMVER_RE);
  if (!m) return null;
  return { major: Number(m[1]), minor: Number(m[2]), patch: Number(m[3]) };
}

export function compareVersioningAgainstSnapshots(exportsByTemplateId, snapshotsByTemplateId) {
  const issues = [];

  for (const [templateId, exported] of exportsByTemplateId.entries()) {
    const snapshot = snapshotsByTemplateId.get(templateId);
    if (!snapshot) continue;

    const prevVersion = parseSemver(snapshot?.metadata?.version);
    const nextVersion = parseSemver(exported?.metadata?.version);
    if (!prevVersion || !nextVersion) continue;

    const pathChanged = `${snapshot?.metadata?.pathSignature || ''}` !== `${exported?.metadata?.pathSignature || ''}`;
    if (pathChanged && nextVersion.major <= prevVersion.major) {
      issues.push(
        `[${templateId}] breaking path change detected but major version did not increase (${snapshot.metadata.version} -> ${exported.metadata.version})`
      );
    }
  }

  return issues;
}

export function loadSnapshotExports(snapshotDir) {
  if (!fs.existsSync(snapshotDir)) return new Map();
  const files = fs.readdirSync(snapshotDir).filter((file) => file.endsWith('.json')).sort();
  const map = new Map();
  files.forEach((file) => {
    const full = path.join(snapshotDir, file);
    const json = readJson(full);
    const templateId = json?.metadata?.templateId || json?.id;
    if (templateId) map.set(templateId, json);
  });
  return map;
}

export function exportAllTemplatePacks({ baseDir, outDir }) {
  const loaded = loadTemplatePacks(baseDir);
  const validationIssues = validateTemplatePacks(loaded);
  if (validationIssues.length > 0) {
    throw new Error(`Template pack validation failed:\n- ${validationIssues.join('\n- ')}`);
  }

  fs.mkdirSync(outDir, { recursive: true });

  const exported = loaded.map(({ pack, dictionary }) => exportPackToWebTemplate(pack, dictionary));
  exported.forEach((template) => {
    const file = path.join(outDir, `${template.metadata.templateId}.json`);
    fs.writeFileSync(file, `${JSON.stringify(template, null, 2)}\n`, 'utf8');
  });

  return exported;
}
