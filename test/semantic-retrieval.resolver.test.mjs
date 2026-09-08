import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const { compileOpenEhrSemanticArtifacts } = await import('../src/lib/contextObjects/openehrSemanticArtifacts.js');
const { resolveSemanticRetrievalQuestion } = await import('../src/lib/contextObjects/semanticRetrieval/resolver.js');

const FIXED_NOW = '2026-04-19T16:30:57.514Z';

async function buildAlcoholArtifacts(contextContract = {}) {
  const raw = await readFile(new URL('../testData/web-templates/addiction.json', import.meta.url), 'utf8');
  const nativeDefinition = JSON.parse(raw);
  const definition = {
    sourceModel: {
      family: 'openEHR',
      sourceFormat: 'webtemplate',
      templateId: nativeDefinition.templateId,
      nativeDefinition
    }
  };
  return compileOpenEhrSemanticArtifacts(definition, {
    templateId: nativeDefinition.templateId,
    contextContract
  });
}

function resolveQuestion(artifacts, question) {
  return resolveSemanticRetrievalQuestion({
    question,
    queryShapeLibrary: artifacts.queryShapeLibrary,
    contractCatalog: artifacts.contractCatalog,
    semanticUnits: artifacts.semanticUnits,
    terminologySurface: artifacts.terminologySurface,
    contextContract: artifacts.contextContract,
    semanticContract: artifacts.semanticContract,
    now: FIXED_NOW
  });
}

test('compiler carries semantic contract metadata into semantic artifacts', async () => {
  const artifacts = await buildAlcoholArtifacts({
    semanticContract: {
      contractType: 'data_product',
      subject: 'patient',
      focus: 'alcohol_use',
      resultShape: 'record_set',
      executionTargets: ['mql']
    }
  });

  assert.equal(artifacts.semanticContract?.contractType, 'data_product');
  assert.equal(artifacts.semanticContract?.focus, 'alcohol_use');
  assert.deepEqual(artifacts.semanticContract?.executionTargets, ['mql']);
  assert.ok(
    (artifacts.warnings || []).some((warning) => /allow AQL as an execution target/i.test(warning))
  );
});

test('average use frequency threshold requires confirmation until the unit is explicit', async () => {
  const artifacts = await buildAlcoholArtifacts();
  const result = resolveQuestion(
    artifacts,
    'patients with Alcohol Use Average Use Frequency above 10 in the last 24 hours'
  );

  assert.equal(result.bestCandidate?.contract?.contractKind, 'numeric_threshold');
  assert.equal(result.bestCandidate?.validation?.valid, false);
  assert.ok(result.bestCandidate?.validation?.errors?.includes('unit required for semantic unit'));
  assert.equal(result.confidence?.decision, 'confirm_contract');
  assert.equal(result.renderedAql, '');
});

test('average use frequency range requires confirmation until the unit is explicit', async () => {
  const artifacts = await buildAlcoholArtifacts();
  const result = resolveQuestion(
    artifacts,
    'patients with Alcohol Use Average Use Frequency between 10 and 15 in the last 24 hours'
  );

  assert.equal(result.processedIntent?.range?.minValue, 10);
  assert.equal(result.processedIntent?.range?.maxValue, 15);
  assert.deepEqual(result.processedIntent?.values, [10, 15]);
  assert.equal(result.bestCandidate?.contract?.contractKind, 'numeric_range');
  assert.equal(result.bestCandidate?.validation?.valid, false);
  assert.ok(result.bestCandidate?.validation?.errors?.includes('unit required for semantic unit'));
  assert.equal(result.confidence?.decision, 'confirm_contract');
  assert.equal(result.renderedAql, '');
});

test('resolves alcohol frequency query with normalized unit and calendar period', async () => {
  const artifacts = await buildAlcoholArtifacts();
  const result = resolveQuestion(
    artifacts,
    'patients drinking alcohol more than 3 times a day as average during this year'
  );

  assert.equal(result.processedIntent?.time?.kind, 'calendar_year');
  assert.deepEqual(result.processedIntent?.values, [3]);
  assert.ok(result.processedIntent?.units?.includes('/d'));
  assert.equal(result.bestCandidate?.contract?.contractKind, 'numeric_threshold');
  assert.equal(result.bestCandidate?.validation?.valid, true);
  assert.equal(result.bestCandidate?.params?.unit, '/d');
  assert.ok(['confirm_contract', 'auto_execute'].includes(result.confidence?.decision));
  assert.match(result.renderedAql, /value\/magnitude > 3/);
  assert.match(result.renderedAql, /value\/units = '\/d'/);
  assert.match(result.renderedAql, /events\[at0002\]\/time\/value >= '2026-01-01T00:00:00\.000Z'/);
});

test('resolver respects semantic contract execution targets before AQL rendering', async () => {
  const artifacts = await buildAlcoholArtifacts({
    semanticContract: {
      contractType: 'data_product',
      subject: 'patient',
      focus: 'alcohol_use',
      resultShape: 'record_set',
      executionTargets: ['mql']
    }
  });
  const result = resolveQuestion(
    artifacts,
    'patients with Alcohol Use Average Use Frequency above 10 /d in the last 24 hours'
  );

  assert.equal(result.bestCandidate?.contract?.contractKind, 'numeric_threshold');
  assert.equal(result.bestCandidate?.validation?.valid, true);
  assert.equal(result.renderedAql, '');
  assert.match(result.renderedAqlError, /do not allow AQL rendering/i);
});

test('multi-unit quantities require confirmation until the unit is explicit', async () => {
  const artifacts = await buildAlcoholArtifacts();
  const ambiguous = resolveQuestion(
    artifacts,
    'patients with Alcohol Use Grams Consumed above 10 in the last 24 hours'
  );

  assert.equal(ambiguous.bestCandidate?.contract?.contractKind, 'numeric_threshold');
  assert.equal(ambiguous.bestCandidate?.validation?.valid, false);
  assert.ok(ambiguous.bestCandidate?.validation?.errors?.includes('unit required for semantic unit'));
  assert.equal(ambiguous.confidence?.decision, 'confirm_contract');
  assert.equal(ambiguous.renderedAql, '');

  const deterministic = resolveQuestion(
    artifacts,
    'patients with Alcohol Use Grams Consumed above 10 gm/d in the last 24 hours'
  );

  assert.equal(deterministic.bestCandidate?.contract?.contractKind, 'numeric_threshold');
  assert.equal(deterministic.bestCandidate?.validation?.valid, true);
  assert.equal(deterministic.bestCandidate?.params?.unit, 'gm/d');
  assert.ok(['confirm_contract', 'auto_execute'].includes(deterministic.confidence?.decision));
  assert.match(deterministic.renderedAql, /value\/units = 'gm\/d'/);
});

test('generated example queries include the quantity unit when the semantic unit allows multiple units', async () => {
  const artifacts = await buildAlcoholArtifacts();
  const thresholdContract = artifacts.contractCatalog.find((contract) => contract.label === 'Grams Consumed threshold');
  const shape = artifacts.queryShapeLibrary.find((candidate) => candidate.contractId === thresholdContract?.contractId && candidate.role === 'doctor');

  assert.ok(shape);
  assert.match(shape.exampleText || '', /gm\/d/);
  assert.match(shape.normalizedShape || '', /\bunit\b/);
});
