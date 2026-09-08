#!/usr/bin/env node

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';
import { MongoClient } from 'mongodb';
import validateAQL from '../src/lib/aqlToMql/parser/validateAql.js';
import { openSecret } from '../src/lib/crypto/secrets.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const TEAM_NAME = 'CatSalut';
const ENV_NAME = 'Informational-DEV';
const QUERY_FOLDER_ID = '69e8a3151a78f483a4aaa90e';
const USER_EMAIL = 'francesc.mateu@mongodb.com';

function resolveCoreUri() {
  let uri = process.env.CORE_MONGODB_URL;
  if (uri?.includes('${MONGODB_URI}')) {
    uri = process.env.MONGODB_URI;
  }
  if (!uri) {
    throw new Error('CORE_MONGODB_URL or MONGODB_URI is required');
  }
  return uri;
}

function q(alias, expr) {
  return { alias, expr };
}

function a(name, p, rmType) {
  return { name, path: p, rmType };
}

function meta(alias, expr) {
  return { query: [q(alias, expr)], analytics: [] };
}

function coded(aliasBase, queryBase, analyticsBase, name) {
  return {
    query: [
      q(`${aliasBase}Codi`, `${queryBase}/value/defining_code/code_string`),
      q(`${aliasBase}Valor`, `${queryBase}/value/value`),
    ],
    analytics: [
      a(`${name} (Code)`, `${analyticsBase}/value/defining_code/code_string`, 'DV_CODED_TEXT'),
    ],
  };
}

function textValue(alias, queryBase, analyticsBase, name, rmType = 'DV_TEXT') {
  return {
    query: [q(alias, `${queryBase}/value/value`)],
    analytics: [a(`${name} (Value)`, `${analyticsBase}/value`, rmType)],
  };
}

function dateValue(alias, queryBase, analyticsBase, name, rmType = 'DV_DATE_TIME') {
  return {
    query: [q(alias, `${queryBase}/value/value`)],
    analytics: [a(`${name} (Value)`, `${analyticsBase}/value`, rmType)],
  };
}

function booleanValue(alias, queryBase, analyticsBase, name) {
  return {
    query: [q(alias, `${queryBase}/value/value`)],
    analytics: [a(`${name} (Value)`, `${analyticsBase}/value`, 'DV_BOOLEAN')],
  };
}

function durationValue(alias, queryBase, analyticsBase, name) {
  return {
    query: [q(alias, `${queryBase}/value/value`)],
    analytics: [a(`${name} (Value)`, `${analyticsBase}/value`, 'DV_DURATION')],
  };
}

function countValue(alias, queryBase, analyticsBase, name) {
  return {
    query: [q(alias, `${queryBase}/value/magnitude`)],
    analytics: [a(`${name} (Count)`, `${analyticsBase}/value/magnitude`, 'DV_COUNT')],
  };
}

function quantityValue(aliasBase, queryBase, analyticsBase, name) {
  return {
    query: [
      q(`${aliasBase}Magnitud`, `${queryBase}/value/magnitude`),
      q(`${aliasBase}Unitat`, `${queryBase}/value/units`),
    ],
    analytics: [a(`${name} (Magnitude)`, `${analyticsBase}/value/magnitude`, 'DV_QUANTITY')],
  };
}

function identifierValue(alias, queryBase, analyticsBase, name) {
  return {
    query: [q(alias, `${queryBase}/value/id`)],
    analytics: [a(`${name} (Value)`, `${analyticsBase}/value`, 'DV_IDENTIFIER')],
  };
}

function identifierOrText(aliasBase, queryBase, analyticsBase, name) {
  return {
    query: [
      q(`${aliasBase}Id`, `${queryBase}/value/id`),
      q(`${aliasBase}Valor`, `${queryBase}/value/value`),
    ],
    analytics: [a(`${name} (Value)`, `${analyticsBase}/value`, 'DV_IDENTIFIER')],
  };
}

function flattenQueryFields(defs) {
  return defs.flatMap((def) => def.query || []);
}

function flattenAnalyticsFields(defs) {
  const unique = new Map();
  for (const field of defs.flatMap((def) => def.analytics || [])) {
    if (!field?.path) continue;
    unique.set(field.path, field);
  }
  return Array.from(unique.values());
}

function buildSelectClause(fields) {
  return fields.map((field) => `    ${field.expr} AS ${field.alias}`).join(',\n');
}

function buildDeltaQuery({ fields, fromClause, templateId }) {
  return `SELECT
${buildSelectClause(fields)}
FROM
${fromClause}
WHERE
    c/archetype_details/template_id/value = '${templateId}'
    AND v/commit_audit/time_committed/value >= $fromCommitted
    AND v/commit_audit/time_committed/value < $toCommitted
ORDER BY
    v/commit_audit/time_committed/value,
    c/uid/value`;
}

function assertValidAql(name, aqlText) {
  const result = validateAQL(aqlText);
  const errors = Array.isArray(result?.errors) ? result.errors.filter(Boolean) : [];
  if (errors.length) {
    throw new Error(`Invalid AQL for "${name}": ${errors.join('; ')}`);
  }
}

function buildRefreshState(fieldCount, nowIso) {
  return {
    required: true,
    reason: 'analytics-template-updated',
    flaggedAt: nowIso,
    flaggedBy: USER_EMAIL,
    source: {
      type: 'analytics-template',
      dataModelId: null,
      dataModelName: 'AiR analytics templates',
      templateId: null,
      fieldCount,
    },
  };
}

const XDS = "c/context/other_context[at0001]/items[openEHR-EHR-CLUSTER.xds_metadata.v0]";
const ADMIN = "c/context/other_context[at0001]/items[openEHR-EHR-CLUSTER.admin_salut.v0]/items[at0005]";
const UPDATE_REASON = "c/context/other_context[at0001]/items[openEHR-EHR-CLUSTER.motiu_actualitzacio_registre.v0]";
const SCREEN = "c/content[openEHR-EHR-OBSERVATION.adverse_reaction_screening.v0]";
const SCREEN_DATA = `${SCREEN}/data[at0001]/events[at0002]/data[at0003]`;
const KN_SECTION = "c/content[openEHR-EHR-SECTION.adverse_reaction_list.v0]";

const A_XDS = "/context/other_context[at0001]/items[openEHR-EHR-CLUSTER.xds_metadata.v0]";
const A_ADMIN = "/context/other_context[at0001]/items[openEHR-EHR-CLUSTER.admin_salut.v0]/items[at0005]";
const A_UPDATE_REASON = "/context/other_context[at0001]/items[openEHR-EHR-CLUSTER.motiu_actualitzacio_registre.v0]";
const A_SCREEN_DATA = "/content[openEHR-EHR-OBSERVATION.adverse_reaction_screening.v0]/data[at0001]/events[at0002]/data[at0003]";
const A_KN_SECTION = "/content[openEHR-EHR-SECTION.adverse_reaction_list.v0]";

const PATIENT_SECTION = "c/content[openEHR-EHR-SECTION.adhoc.v1]";
const A_PATIENT_SECTION = "/content[openEHR-EHR-SECTION.adhoc.v1,'Patient details']";
const AGE = `${PATIENT_SECTION}/items[openEHR-EHR-OBSERVATION.age_assertion.v1]/data[at0001]/events[at0002]/data[at0003]/items[at0004]`;
const WEIGHT = `${PATIENT_SECTION}/items[openEHR-EHR-OBSERVATION.body_weight.v2]/data[at0002]/events[at0003]/data[at0001]/items[at0004]`;
const HEIGHT = `${PATIENT_SECTION}/items[openEHR-EHR-OBSERVATION.height.v2]/data[at0001]/events[at0002]/data[at0003]/items[at0004]`;
const GENDER = `${PATIENT_SECTION}/items[openEHR-EHR-EVALUATION.gender.v1]/data[at0002]/items[at0022]`;

const A_AGE = `${A_PATIENT_SECTION}/items[openEHR-EHR-OBSERVATION.age_assertion.v1]/data[at0001]/events[at0002]/data[at0003]/items[at0004]`;
const A_WEIGHT = `${A_PATIENT_SECTION}/items[openEHR-EHR-OBSERVATION.body_weight.v2]/data[at0002]/events[at0003]/data[at0001]/items[at0004]`;
const A_HEIGHT = `${A_PATIENT_SECTION}/items[openEHR-EHR-OBSERVATION.height.v2]/data[at0001]/events[at0002]/data[at0003]/items[at0004]`;
const A_GENDER = `${A_PATIENT_SECTION}/items[openEHR-EHR-EVALUATION.gender.v1]/data[at0002]/items[at0022]`;

const AR = 'ar/data[at0001]';
const EV = 'ev';
const A_AR = "/content[openEHR-EHR-SECTION.adverse_reaction_list.v0,'Adverse reaction details']/items[openEHR-EHR-EVALUATION.adverse_reaction_risk.v2]";
const A_EV = `${A_AR}/data[at0001]/items[openEHR-EHR-CLUSTER.adverse_reaction_event.v1]`;
const PV = "c/context/other_context[at0001]/items[openEHR-EHR-CLUSTER.pharmacovigilance_notification_details.v0]";
const A_PV = "/context/other_context[at0001]/items[openEHR-EHR-CLUSTER.pharmacovigilance_notification_details.v0]";

const knownDefs = [
  meta('StartTime', 'c/context/start_time/value'),
  meta('compositionId', 'c/uid/value'),
  meta('ehrId', 'e/ehr_id/value'),
  meta('DataRegistre', 'v/commit_audit/time_committed/value'),
  meta('IdProfessional', `${SCREEN}/other_participations/performer/identifiers/id`),
  meta('NomProfessional', `${SCREEN}/other_participations/performer/name`),
  coded('CategoriaProfessional', `${XDS}/items[at0001]`, `${A_XDS}/items[at0001]`, 'Author specialty'),
  coded('Servei', `${XDS}/items[at0009]`, `${A_XDS}/items[at0009]`, 'Practice setting code'),
  coded('Centre', `${ADMIN}/items[at0011]`, `${A_ADMIN}/items[at0011]`, 'Performing centre'),
  coded('UP', `${ADMIN}/items[at0013]`, `${A_ADMIN}/items[at0013]`, 'Performing UP'),
  coded('EP', `${ADMIN}/items[at0026]`, `${A_ADMIN}/items[at0026]`, 'Performing EP'),
  coded('AnyKnownAllergy', `${SCREEN_DATA}/items[at0028]`, `${A_SCREEN_DATA}/items[at0028]`, 'Any known allergy?'),
  coded(
    'GlobalExclusionStatement',
    `${KN_SECTION}/items[openEHR-EHR-EVALUATION.exclusion_global.v1]/data[at0001]/items[at0002]`,
    `${A_KN_SECTION}/items[openEHR-EHR-EVALUATION.exclusion_global.v1]/data[at0001]/items[at0002]`,
    'Global exclusion of adverse reactions'
  ),
  coded(
    'AbsenceStatement',
    `${KN_SECTION}/items[openEHR-EHR-EVALUATION.absence.v2]/data[at0001]/items[at0002]`,
    `${A_KN_SECTION}/items[openEHR-EHR-EVALUATION.absence.v2]/data[at0001]/items[at0002]`,
    'Absence statement'
  ),
  textValue(
    'MotiuModificacio',
    `${UPDATE_REASON}/items[at0004]`,
    `${A_UPDATE_REASON}/items[at0004]`,
    'Modification reason'
  ),
];

const adverseDefs = [
  meta('StartTime', 'c/context/start_time/value'),
  meta('compositionId', 'c/uid/value'),
  meta('ehrId', 'e/ehr_id/value'),
  meta('DataRegistre', 'v/commit_audit/time_committed/value'),
  meta('IdProfessional', 'ar/other_participations/performer/identifiers/id'),
  meta('NomProfessional', 'ar/other_participations/performer/name'),
  coded('CategoriaProfessional', `${XDS}/items[at0001]`, `${A_XDS}/items[at0001]`, 'Author specialty'),
  coded('Servei', `${XDS}/items[at0009]`, `${A_XDS}/items[at0009]`, 'Practice setting code'),
  coded('Centre', `${ADMIN}/items[at0011]`, `${A_ADMIN}/items[at0011]`, 'Performing centre'),
  coded('UP', `${ADMIN}/items[at0013]`, `${A_ADMIN}/items[at0013]`, 'Performing UP'),
  coded('EP', `${ADMIN}/items[at0026]`, `${A_ADMIN}/items[at0026]`, 'Performing EP'),
  durationValue('Edat', AGE, A_AGE, 'Chronological age'),
  quantityValue('Pes', WEIGHT, A_WEIGHT, 'Weight'),
  quantityValue('Alcada', HEIGHT, A_HEIGHT, 'Height/Length'),
  coded('Sexe', GENDER, A_GENDER, 'Administrative gender'),
  coded('MecanismeReaccio', `${AR}/items[at0058]`, `${A_AR}/data[at0001]/items[at0058]`, 'Reaction mechanism'),
  coded('CategoriaEventAdvers', `${AR}/items[at0120]`, `${A_AR}/data[at0001]/items[at0120]`, 'Category'),
  coded('Substance', `${AR}/items[at0002]`, `${A_AR}/data[at0001]/items[at0002]`, 'Substance'),
  coded('SpecificSubstance', `${EV}/items[at0001]`, `${A_EV}/items[at0001]`, 'Specific substance'),
  coded(
    'MedicationName',
    `${EV}/items[openEHR-EHR-CLUSTER.medication.v2]/items[at0132]`,
    `${A_EV}/items[openEHR-EHR-CLUSTER.medication.v2]/items[at0132]`,
    'Name'
  ),
  identifierOrText(
    'Lot',
    `${EV}/items[openEHR-EHR-CLUSTER.medication.v2]/items[at0150]`,
    `${A_EV}/items[openEHR-EHR-CLUSTER.medication.v2]/items[at0150]`,
    'Batch ID'
  ),
  quantityValue(
    'Dose',
    `${EV}/items[openEHR-EHR-CLUSTER.dosage.v2]/items[at0144]`,
    `${A_EV}/items[openEHR-EHR-CLUSTER.dosage.v2]/items[at0144]`,
    'Dose'
  ),
  durationValue(
    'IntervalAdministracio',
    `${EV}/items[openEHR-EHR-CLUSTER.dosage.v2]/items[openEHR-EHR-CLUSTER.timing_daily.v1]/items[at0014]`,
    `${A_EV}/items[openEHR-EHR-CLUSTER.dosage.v2]/items[openEHR-EHR-CLUSTER.timing_daily.v1]/items[at0014]`,
    'Interval'
  ),
  textValue(
    'PosologiaNoEstructurada',
    `${EV}/items[at0024]`,
    `${A_EV}/items[at0024 and name/value='Non-structured dosage']`,
    'Non-structured dosage'
  ),
  dateValue(
    'DataIniciTractament',
    `${EV}/items[openEHR-EHR-CLUSTER.administration_details.v0]/items[at0011]`,
    `${A_EV}/items[openEHR-EHR-CLUSTER.administration_details.v0]/items[at0011]`,
    'Onset of use'
  ),
  dateValue(
    'DataFiTractament',
    `${EV}/items[openEHR-EHR-CLUSTER.administration_details.v0]/items[at0012]`,
    `${A_EV}/items[openEHR-EHR-CLUSTER.administration_details.v0]/items[at0012]`,
    'Cessation of use'
  ),
  countValue(
    'NumeroDosi',
    `${EV}/items[openEHR-EHR-CLUSTER.administration_details.v0]/items[at0014]/items[at0009]`,
    `${A_EV}/items[openEHR-EHR-CLUSTER.administration_details.v0]/items[at0014]/items[at0009]`,
    'Sequence number'
  ),
  dateValue(
    'DataVacunacio',
    `${EV}/items[openEHR-EHR-CLUSTER.administration_details.v0]/items[at0014]/items[at0010]`,
    `${A_EV}/items[openEHR-EHR-CLUSTER.administration_details.v0]/items[at0014]/items[at0010]`,
    'Administration date'
  ),
  coded(
    'BodySite',
    `${EV}/items[openEHR-EHR-CLUSTER.administration_details.v0]/items[openEHR-EHR-CLUSTER.anatomical_location.v1]/items[at0001]`,
    `${A_EV}/items[openEHR-EHR-CLUSTER.administration_details.v0]/items[openEHR-EHR-CLUSTER.anatomical_location.v1]/items[at0001]`,
    'Body site name'
  ),
  coded(
    'Laterality',
    `${EV}/items[openEHR-EHR-CLUSTER.administration_details.v0]/items[openEHR-EHR-CLUSTER.anatomical_location.v1]/items[at0002]`,
    `${A_EV}/items[openEHR-EHR-CLUSTER.administration_details.v0]/items[openEHR-EHR-CLUSTER.anatomical_location.v1]/items[at0002]`,
    'Laterality'
  ),
  coded(
    'ViaAdministracio',
    `${EV}/items[openEHR-EHR-CLUSTER.administration_details.v0]/items[at0001]`,
    `${A_EV}/items[openEHR-EHR-CLUSTER.administration_details.v0]/items[at0001]`,
    'Route'
  ),
  coded('ManifestacioClinica', `${EV}/items[at0006]`, `${A_EV}/items[at0006]`, 'Manifestation'),
  dateValue('DataIniciSimptomes', `${EV}/items[at0008]`, `${A_EV}/items[at0008]`, 'Onset of reaction'),
  durationValue('DuradaReaccio', `${EV}/items[at0009]`, `${A_EV}/items[at0009]`, 'Duration of reaction'),
  coded(
    'Desenllac',
    `${EV}/items[openEHR-EHR-CLUSTER.problem_qualifier.v2]/items[at0102]`,
    `${A_EV}/items[openEHR-EHR-CLUSTER.problem_qualifier.v2]/items[at0102]`,
    'Progression'
  ),
  coded('Severitat', `${AR}/items[at0101]`, `${A_AR}/data[at0001]/items[at0101]`, 'Criticality'),
  coded('Estat', `${AR}/items[at0130]`, `${A_AR}/data[at0001]/items[at0130 and name/value='Status']`, 'Status'),
  coded('NivellCertesa', `${AR}/items[at0063]`, `${A_AR}/data[at0001]/items[at0063]`, 'Verification status'),
  textValue('Comentari', `${AR}/items[at0006]`, `${A_AR}/data[at0001]/items[at0006]`, 'Comment'),
  booleanValue(
    'NotificatFarmacovigilancia',
    `${PV}/items[at0001]`,
    `${A_PV}/items[at0001]`,
    'Notified to Pharmacovigilance?'
  ),
  identifierValue(
    'NumeroNotificacio',
    `${PV}/items[at0002]`,
    `${A_PV}/items[at0002]`,
    'Notification ID'
  ),
  dateValue('DataNotificacio', `${PV}/items[at0003]`, `${A_PV}/items[at0003]`, 'Notification date'),
  coded(
    'HaRequeritAtencio',
    `${EV}/items[openEHR-EHR-CLUSTER.adverse_reaction_additional_details.v0]/items[at0001]/items[at0002]`,
    `${A_EV}/items[openEHR-EHR-CLUSTER.adverse_reaction_additional_details.v0]/items[at0001]/items[at0002]`,
    'Has the adverse drug reaction required medical attention?'
  ),
  coded(
    'TipusAtencioRequerida',
    `${EV}/items[openEHR-EHR-CLUSTER.adverse_reaction_additional_details.v0]/items[at0001]/items[at0003]`,
    `${A_EV}/items[openEHR-EHR-CLUSTER.adverse_reaction_additional_details.v0]/items[at0001]/items[at0003]`,
    'Attention required'
  ),
  booleanValue(
    'HaRequeritTractament',
    `${EV}/items[openEHR-EHR-CLUSTER.adverse_reaction_additional_details.v0]/items[at0007]/items[at0008]`,
    `${A_EV}/items[openEHR-EHR-CLUSTER.adverse_reaction_additional_details.v0]/items[at0007]/items[at0008]`,
    'Has the adverse drug reaction required any treatment?'
  ),
  coded(
    'IntervencioRequerida',
    `${EV}/items[openEHR-EHR-CLUSTER.adverse_reaction_additional_details.v0]/items[at0007]/items[at0009]`,
    `${A_EV}/items[openEHR-EHR-CLUSTER.adverse_reaction_additional_details.v0]/items[at0007]/items[at0009]`,
    'Treatment required'
  ),
  dateValue(
    'DataMort',
    `${EV}/items[openEHR-EHR-CLUSTER.adverse_reaction_additional_details.v0]/items[at0014]/items[at0015]`,
    `${A_EV}/items[openEHR-EHR-CLUSTER.adverse_reaction_additional_details.v0]/items[at0014]/items[at0015]`,
    'Date/time of death'
  ),
  booleanValue(
    'Autopsia',
    `${EV}/items[openEHR-EHR-CLUSTER.adverse_reaction_additional_details.v0]/items[at0014]/items[at0016]`,
    `${A_EV}/items[openEHR-EHR-CLUSTER.adverse_reaction_additional_details.v0]/items[at0014]/items[at0016]`,
    'Autopsy'
  ),
  coded(
    'Sospita',
    `${EV}/items[openEHR-EHR-CLUSTER.adverse_reaction_additional_details.v0]/items[at0017]`,
    `${A_EV}/items[openEHR-EHR-CLUSTER.adverse_reaction_additional_details.v0]/items[at0017]`,
    'Certainty - Additional details'
  ),
  booleanValue(
    'EsVacuna',
    `${EV}/items[openEHR-EHR-CLUSTER.adverse_reaction_additional_details.v0]/items[at0007]/items[at0010]/items[at0012]`,
    `${A_EV}/items[openEHR-EHR-CLUSTER.adverse_reaction_additional_details.v0]/items[at0007]/items[at0010]/items[at0012]`,
    'Is the causative agent a vaccine?'
  ),
  coded(
    'MesuresPreses',
    `${EV}/items[openEHR-EHR-CLUSTER.adverse_reaction_additional_details.v0]/items[at0007]/items[at0010]/items[at0019]`,
    `${A_EV}/items[openEHR-EHR-CLUSTER.adverse_reaction_additional_details.v0]/items[at0007]/items[at0010]/items[at0019]`,
    'Actions taken'
  ),
  coded(
    'MotiuPrescripcioVacunacio',
    `${EV}/items[openEHR-EHR-CLUSTER.adverse_reaction_additional_details.v0]/items[at0007]/items[at0010]/items[at0011]`,
    `${A_EV}/items[openEHR-EHR-CLUSTER.adverse_reaction_additional_details.v0]/items[at0007]/items[at0010]/items[at0011]`,
    'Prescription/vaccination indication'
  ),
  textValue(
    'MedicationPlan',
    `${EV}/items[openEHR-EHR-CLUSTER.adverse_reaction_additional_details.v0]/items[at0007]/items[at0010]/items[at0013]`,
    `${A_EV}/items[openEHR-EHR-CLUSTER.adverse_reaction_additional_details.v0]/items[at0007]/items[at0010]/items[at0013]`,
    'Medication plan'
  ),
  textValue(
    'Observacions',
    `${EV}/items[openEHR-EHR-CLUSTER.adverse_reaction_additional_details.v0]/items[at0020]`,
    `${A_EV}/items[openEHR-EHR-CLUSTER.adverse_reaction_additional_details.v0]/items[at0020]`,
    'Observations'
  ),
  dateValue('DataPrimeraReaccio', `${AR}/items[at0133]`, `${A_AR}/data[at0001]/items[at0133]`, 'Onset of first reaction'),
  dateValue(
    'DataDescart',
    'ar/protocol[at0042]/items[openEHR-EHR-CLUSTER.clinical_evidence.v1]/items[at0006]',
    `${A_AR}/protocol[at0042]/items[openEHR-EHR-CLUSTER.clinical_evidence.v1]/items[at0006 and name/value='Date refuted']`,
    'Date refuted'
  ),
  textValue(
    'MotiuModificacio',
    `${UPDATE_REASON}/items[at0004]`,
    `${A_UPDATE_REASON}/items[at0004]`,
    'Modification reason'
  ),
  coded(
    'MotiuDescart',
    `${UPDATE_REASON}/items[at0005]`,
    `${A_UPDATE_REASON}/items[at0005]`,
    'Inactivation reason'
  ),
  meta('MotiuEliminacio', 'v/commit_audit/description/value'),
];

const knownTemplateName = 'air_known_allergies_v1';
const adverseTemplateName = 'air_adverse_reaction_record_v1';

const knownQueryFields = flattenQueryFields(knownDefs);
const knownAnalyticsFields = flattenAnalyticsFields(knownDefs);
const adverseQueryFields = flattenQueryFields(adverseDefs);
const adverseAnalyticsFields = flattenAnalyticsFields(adverseDefs);

const knownAql = buildDeltaQuery({
  fields: knownQueryFields,
  fromClause: `    EHR e
        CONTAINS
            VERSION v
                CONTAINS
                    COMPOSITION c[openEHR-EHR-COMPOSITION.adverse_reaction_list.v1]`,
  templateId: knownTemplateName,
});

const adverseAql = buildDeltaQuery({
  fields: adverseQueryFields,
  fromClause: `    EHR e
        CONTAINS
            VERSION v
                CONTAINS
                    COMPOSITION c[openEHR-EHR-COMPOSITION.encounter.v1]
                        CONTAINS
                            SECTION s[openEHR-EHR-SECTION.adverse_reaction_list.v0]
                                CONTAINS
                                    EVALUATION ar[openEHR-EHR-EVALUATION.adverse_reaction_risk.v2]
                                        CONTAINS
                                            CLUSTER ev[openEHR-EHR-CLUSTER.adverse_reaction_event.v1]`,
  templateId: adverseTemplateName,
});

const QUERY_DEFINITIONS = [
  {
    name: 'AiR Known Allergies - Delta export query',
    description: 'Exports daily deltas for the AiR known allergies template using the $fromCommitted and $toCommitted VERSION commit window. Includes the known-allergy summary state, exclusion/absence statements, and the common authoring centre metadata required by the AiR model.',
    folderId: QUERY_FOLDER_ID,
    tags: ['AiR', 'export', 'Allergies'],
    templateName: knownTemplateName,
    aqlText: knownAql,
    analyticsTemplate: {
      id: knownTemplateName,
      templateId: knownTemplateName,
      fields: knownAnalyticsFields,
    },
  },
  {
    name: 'AiR Adverse Reaction Record - Delta export query',
    description: 'Exports daily deltas for the AiR adverse reaction record template using the $fromCommitted and $toCommitted VERSION commit window. The result set is one row per adverse reaction event so repeated reaction entries inside one composition are exported deterministically together with patient, reaction, pharmacovigilance, and authoring centre metadata.',
    folderId: QUERY_FOLDER_ID,
    tags: ['AiR', 'export', 'Adverse reactions'],
    templateName: adverseTemplateName,
    aqlText: adverseAql,
    analyticsTemplate: {
      id: adverseTemplateName,
      templateId: adverseTemplateName,
      fields: adverseAnalyticsFields,
    },
  },
];

async function getTenantContext(coreDb) {
  const team = await coreDb.collection('teams').findOne(
    { name: TEAM_NAME },
    { projection: { _id: 1, name: 1, environments: 1 } }
  );
  if (!team) {
    throw new Error(`Team "${TEAM_NAME}" not found`);
  }

  const env = (team.environments || []).find((item) => item.name === ENV_NAME);
  if (!env) {
    throw new Error(`Environment "${ENV_NAME}" not found on team "${TEAM_NAME}"`);
  }

  const secret = await coreDb.collection('environment_secrets').findOne({
    envId: env.id,
    ownerType: 'team',
    ownerId: String(team._id),
  });
  if (!secret?.sealedUri) {
    throw new Error(`No environment secret found for envId=${env.id}`);
  }

  return {
    team,
    env,
    tenantUri: openSecret(secret.sealedUri),
  };
}

async function upsertQuery(db, queryDoc, templateModel) {
  const now = new Date();
  const existing = await db.collection('aql-queries').findOne(
    { name: queryDoc.name },
    { projection: { _id: 1, createdAt: 1, createdBy: 1 } }
  );

  const payload = {
    name: queryDoc.name,
    description: queryDoc.description,
    uuid: '',
    folderId: queryDoc.folderId,
    tags: queryDoc.tags,
    aqlText: queryDoc.aqlText,
    normalizedAQL: '',
    affectedTemplates: [
      {
        id: templateModel._id.toString(),
        name: templateModel.name,
      },
    ],
    strategyValidations: {},
    updatedAt: now,
    updatedBy: USER_EMAIL,
  };

  if (existing) {
    await db.collection('aql-queries').updateOne(
      { _id: existing._id },
      {
        $set: payload,
      }
    );
    return { action: 'updated', id: existing._id.toString() };
  }

  const result = await db.collection('aql-queries').insertOne({
    ...payload,
    createdAt: now,
    createdBy: USER_EMAIL,
  });
  return { action: 'inserted', id: result.insertedId.toString() };
}

async function updateAnalyticsTemplate(db, templateModel, analyticsTemplate) {
  const nowIso = new Date().toISOString();
  await db.collection('user-data-models').updateOne(
    { _id: templateModel._id },
    {
      $set: {
        analyticsTemplate,
        'audit.lastModified': nowIso,
        'audit.lastModifiedBy': USER_EMAIL,
      },
    }
  );
}

async function flagSearchRefresh(coreDb, team, env, fieldCount) {
  const environments = Array.isArray(team.environments) ? [...team.environments] : [];
  const envIndex = environments.findIndex((item) => item.id === env.id);
  if (envIndex < 0) return false;

  const nowIso = new Date().toISOString();
  const strategyLinks = Array.isArray(environments[envIndex].strategyLinks)
    ? [...environments[envIndex].strategyLinks]
    : [];

  let changed = false;
  const refreshState = buildRefreshState(fieldCount, nowIso);
  const nextLinks = strategyLinks.map((link) => {
    const domain = String(link?.domain || '').trim().toLowerCase();
    const strategyId = String(link?.kehrnel?.strategyId || link?.strategyId || '').trim();
    const searchEnabled = link?.mergedConfig?.collections?.search?.enabled === true;
    const supported = domain === 'openehr'
      && (strategyId === 'openehr.rps_dual' || strategyId === 'openehr.rps_dual_ibm' || searchEnabled);

    if (!supported) return link;

    changed = true;
    return {
      ...link,
      searchRefresh: refreshState,
    };
  });

  if (!changed) return false;

  environments[envIndex] = {
    ...environments[envIndex],
    strategyLinks: nextLinks,
    updatedAt: nowIso,
  };

  await coreDb.collection('teams').updateOne(
    { _id: team._id },
    { $set: { environments } }
  );

  return true;
}

async function main() {
  for (const query of QUERY_DEFINITIONS) {
    assertValidAql(query.name, query.aqlText);
  }

  const coreClient = new MongoClient(resolveCoreUri());
  await coreClient.connect();

  try {
    const coreDb = coreClient.db(process.env.CORE_DATABASE_NAME || 'openehr_core');
    const { team, env, tenantUri } = await getTenantContext(coreDb);

    const tenantClient = new MongoClient(tenantUri);
    await tenantClient.connect();

    try {
      const tenantDb = tenantClient.db(env.database);
      const summaries = [];

      for (const query of QUERY_DEFINITIONS) {
        const templateModel = await tenantDb.collection('user-data-models').findOne(
          { name: query.templateName },
          { projection: { _id: 1, name: 1, metadata: 1 } }
        );
        if (!templateModel) {
          throw new Error(`Template model "${query.templateName}" not found in user-data-models`);
        }

        await updateAnalyticsTemplate(tenantDb, templateModel, query.analyticsTemplate);
        const queryResult = await upsertQuery(tenantDb, query, templateModel);

        summaries.push({
          template: query.templateName,
          modelId: templateModel._id.toString(),
          queryId: queryResult.id,
          queryAction: queryResult.action,
          analyticsFieldCount: query.analyticsTemplate.fields.length,
        });
      }

      const totalFieldCount = summaries.reduce((acc, item) => acc + item.analyticsFieldCount, 0);
      const refreshFlagged = await flagSearchRefresh(coreDb, team, env, totalFieldCount);

      console.log(JSON.stringify({
        team: TEAM_NAME,
        environment: ENV_NAME,
        database: env.database,
        refreshFlagged,
        queries: summaries,
      }, null, 2));
    } finally {
      await tenantClient.close();
    }
  } finally {
    await coreClient.close();
  }
}

main().catch((error) => {
  console.error(error.stack || error.message || String(error));
  process.exit(1);
});
