import { createDefaultCustomDefinition } from '@/lib/definitions/types';
import { ensureDefinitionContextContract } from '@/lib/contextObjects/contextContract';
import {
  DEFINITION_CANONICAL_SOURCES,
  HIERARCHICAL_DEFINITION_FORMAT,
  createPreservedFHIRDefinition,
  createPreservedOpenEHRDefinition,
  flattenHierarchicalDefinition,
} from '@/lib/contextObjects/hierarchicalDefinition';

export const CONTEXT_OBJECT_IMPORT_SESSION_KEY = 'hdl-contextobject-import-draft';

function isObjectRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function asNonEmptyString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : '';
}

function uniqueStrings(values = []) {
  return Array.from(
    new Set(
      (Array.isArray(values) ? values : [])
        .map((value) => `${value || ''}`.trim())
        .filter(Boolean)
    )
  );
}

function resolveDomain(model) {
  const domain = `${model?.domain || ''}`.trim().toLowerCase();
  if (domain === 'context') return 'contextobject';
  return domain || null;
}

function extractOpenEhrTemplateEnvelope(model) {
  const domainData = isObjectRecord(model?.domainData) ? model.domainData : {};
  const rawTemplate = domainData.webTemplate || model?.webTemplate || null;
  if (!isObjectRecord(rawTemplate)) return null;

  const tree = isObjectRecord(rawTemplate?.tree) ? rawTemplate.tree : rawTemplate;
  if (!isObjectRecord(tree)) return null;

  const template = isObjectRecord(rawTemplate?.tree)
    ? { ...rawTemplate }
    : { tree };

  const languages = uniqueStrings([
    ...(Array.isArray(rawTemplate?.languages) ? rawTemplate.languages : []),
    ...(Array.isArray(domainData?.languages) ? domainData.languages : []),
    asNonEmptyString(rawTemplate?.defaultLanguage),
    asNonEmptyString(domainData?.defaultLanguage)
  ]);

  const templateId = asNonEmptyString(domainData?.templateId)
    || asNonEmptyString(model?.metadata?.templateId)
    || asNonEmptyString(rawTemplate?.templateId)
    || asNonEmptyString(tree?.templateId);
  const semVer = asNonEmptyString(domainData?.semVer)
    || asNonEmptyString(model?.metadata?.semVer)
    || asNonEmptyString(rawTemplate?.semVer)
    || asNonEmptyString(tree?.semVer);
  const version = asNonEmptyString(domainData?.version)
    || asNonEmptyString(model?.metadata?.version)
    || asNonEmptyString(rawTemplate?.version)
    || asNonEmptyString(tree?.version);
  const defaultLanguage = asNonEmptyString(domainData?.defaultLanguage)
    || asNonEmptyString(rawTemplate?.defaultLanguage)
    || asNonEmptyString(tree?.defaultLanguage);

  if (templateId) template.templateId = template.templateId || templateId;
  if (semVer) template.semVer = template.semVer || semVer;
  if (version) template.version = template.version || version;
  if (defaultLanguage) template.defaultLanguage = template.defaultLanguage || defaultLanguage;
  if (languages.length > 0) template.languages = Array.isArray(template.languages) && template.languages.length > 0
    ? uniqueStrings([...template.languages, ...languages])
    : languages;

  return template;
}

function extractOpenEhrTree(model) {
  const template = extractOpenEhrTemplateEnvelope(model);
  return template?.tree || template || null;
}

function extractFhirResource(model) {
  return model?.domainData?.resource || model?.data || null;
}

function extractFhirResourceType(model) {
  return (
    asNonEmptyString(model?.domainData?.resourceType)
    || asNonEmptyString(model?.resourceType)
    || asNonEmptyString(model?.domainData?.resource?.resourceType)
    || asNonEmptyString(model?.data?.resourceType)
    || ''
  );
}

export function canImportDataModelAsContextObject(model) {
  const domain = resolveDomain(model);
  if (domain === 'openehr') {
    return !!extractOpenEhrTemplateEnvelope(model);
  }
  if (domain === 'fhir') {
    return extractFhirResourceType(model) === 'StructureDefinition' && !!extractFhirResource(model);
  }
  return false;
}

export function getDataModelContextObjectImportInfo(model) {
  const domain = resolveDomain(model);
  if (domain === 'openehr') {
    const template = extractOpenEhrTemplateEnvelope(model);
    return {
      eligible: !!template,
      label: 'Create ContextObject',
      sourceFamily: 'openEHR',
      sourceFormat: 'openEHR-WEB-TEMPLATE',
    };
  }
  if (domain === 'fhir') {
    const resourceType = extractFhirResourceType(model);
    return {
      eligible: resourceType === 'StructureDefinition' && !!extractFhirResource(model),
      label: 'Create ContextObject',
      sourceFamily: 'FHIR',
      sourceFormat: resourceType === 'StructureDefinition' ? 'FHIR-RESOURCE-DEFINITION' : '',
      resourceType,
    };
  }
  return {
    eligible: false,
    label: 'Create ContextObject',
    sourceFamily: '',
    sourceFormat: '',
  };
}

function buildDefinitionLifecycle(sourceFamily, preservedDefinition, sourceArtifactId) {
  return {
    canonicalSource: DEFINITION_CANONICAL_SOURCES.NATIVE,
    projectionStrategy: 'derived_nodes',
    definitionFormat: HIERARCHICAL_DEFINITION_FORMAT,
    sourceFamily,
    sourceFormat: preservedDefinition?.sourceModel?.sourceFormat || null,
    sourceArtifactType: preservedDefinition?.sourceModel?.artifactType || null,
    sourceArtifactId: sourceArtifactId || null,
  };
}

function buildImportSourceMetadata(model, sourceFamily, sourceArtifactId) {
  return {
    source: 'data_model_catalog',
    dataModelId: `${model?._id || model?.id || ''}`.trim() || null,
    modelName: model?.name || null,
    domain: resolveDomain(model),
    sourceFamily,
    sourceArtifactId: sourceArtifactId || null,
  };
}

export function buildContextObjectDraftFromDataModel(model) {
  if (!canImportDataModelAsContextObject(model)) {
    throw new Error('This data model cannot be imported as a ContextObject');
  }

  const base = createDefaultCustomDefinition();
  const domain = resolveDomain(model);
  const now = new Date().toISOString();
  const existingTags = Array.isArray(model?.metadata?.tags) ? model.metadata.tags : [];

  if (domain === 'openehr') {
    const template = extractOpenEhrTemplateEnvelope(model);
    const tree = template?.tree || template;
    const templateId = asNonEmptyString(model?.metadata?.templateId)
      || asNonEmptyString(template?.templateId)
      || asNonEmptyString(tree?.templateId)
      || asNonEmptyString(tree?.nodeId)
      || asNonEmptyString(model?.name)
      || 'openEHR Template';
    const preservedDefinition = createPreservedOpenEHRDefinition(template || tree, {
      templateId,
      rmType: asNonEmptyString(tree?.rmType) || undefined,
    });
    const nodes = flattenHierarchicalDefinition(preservedDefinition);
    const description = asNonEmptyString(model?.description)
      || asNonEmptyString(model?.metadata?.description)
      || asNonEmptyString(tree?.description)
      || '';
    const lifecycle = buildDefinitionLifecycle('openEHR', preservedDefinition, templateId);

    return ensureDefinitionContextContract({
      ...base,
      name: asNonEmptyString(model?.name) || templateId,
      description,
      kind: 'context_object',
      scope: 'business_object',
      origin: 'standard',
      rmType: asNonEmptyString(tree?.rmType) || null,
      definitionFormat: HIERARCHICAL_DEFINITION_FORMAT,
      definition: preservedDefinition,
      nodes,
      metadata: {
        ...(base.metadata || {}),
        tags: uniqueStrings([...existingTags, 'openEHR', 'imported']),
        createdAt: now,
        updatedAt: now,
        definitionLifecycle: lifecycle,
        importSource: buildImportSourceMetadata(model, 'openEHR', templateId),
      },
    });
  }

  const resource = extractFhirResource(model);
  const resourceType = extractFhirResourceType(model);
  const canonicalUrl = asNonEmptyString(resource?.url)
    || asNonEmptyString(model?.domainData?.url)
    || asNonEmptyString(model?.url)
    || null;
  const preservedDefinition = createPreservedFHIRDefinition(resource, {});
  const nodes = flattenHierarchicalDefinition(preservedDefinition);
  const description = asNonEmptyString(model?.description)
    || asNonEmptyString(resource?.description)
    || asNonEmptyString(resource?.title)
    || '';
  const name = asNonEmptyString(model?.name)
    || asNonEmptyString(resource?.title)
    || asNonEmptyString(resource?.name)
    || asNonEmptyString(resource?.type)
    || 'FHIR StructureDefinition';
  const artifactId = canonicalUrl || asNonEmptyString(resource?.type) || resourceType;
  const lifecycle = buildDefinitionLifecycle('FHIR', preservedDefinition, artifactId);

  return ensureDefinitionContextContract({
    ...base,
    name,
    description,
    kind: 'context_object',
    scope: 'business_object',
    origin: 'standard',
    rmType: asNonEmptyString(resource?.type) || resourceType || null,
    definitionFormat: HIERARCHICAL_DEFINITION_FORMAT,
    definition: preservedDefinition,
    nodes,
    metadata: {
      ...(base.metadata || {}),
      tags: uniqueStrings([...existingTags, 'FHIR', 'imported', resourceType]),
      createdAt: now,
      updatedAt: now,
      definitionLifecycle: lifecycle,
      importSource: buildImportSourceMetadata(model, 'FHIR', artifactId),
    },
  });
}

export function summarizeImportedContextObject(definition) {
  if (!isObjectRecord(definition)) return null;
  const importSource = isObjectRecord(definition?.metadata?.importSource) ? definition.metadata.importSource : null;
  const lifecycle = isObjectRecord(definition?.metadata?.definitionLifecycle) ? definition.metadata.definitionLifecycle : null;

  if (!importSource && !lifecycle) return null;

  return {
    source: importSource?.source || null,
    modelName: importSource?.modelName || definition?.name || null,
    domain: importSource?.domain || null,
    sourceFamily: importSource?.sourceFamily || lifecycle?.sourceFamily || null,
    sourceArtifactId: importSource?.sourceArtifactId || lifecycle?.sourceArtifactId || null,
    canonicalSource: lifecycle?.canonicalSource || null,
    sourceFormat: lifecycle?.sourceFormat || null,
  };
}
