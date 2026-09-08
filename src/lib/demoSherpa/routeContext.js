import { NAVIGATION_CONFIG } from '@/config/navigation';
import { getLearningModuleById, getLearningModuleIdForView } from '@/lib/learning/moduleRouting';
import { sherpaPathToView } from '@/lib/demoSherpa/hostRoutes';

const VIEW_GUIDANCE = {
  home: {
    title: 'Healthcare Data Lab Overview',
    talkTrack: [
      'Use Home to orient new users around the workspace before diving into individual tools.',
      'Call out the split between Healthcare Data Lab as the control plane and Kehrnel as the execution runtime.',
    ],
    journeySteps: [
      'Start with workspace health and recent activity so the user knows the current system state.',
      'Point to the next section in the journey: strategy, models, data factory, retrieval, and APIs.',
    ],
  },
  learn: {
    title: 'Learning Center',
    talkTrack: [
      'Use Learning Center when a user needs guided context before they start configuring the platform.',
    ],
    journeySteps: [
      'Pick the relevant module for the user role or capability they want to learn next.',
    ],
  },
  'workspace-health': {
    title: 'Workspace Health',
    talkTrack: [
      'Workspace Health is the quickest way to verify whether the environment, runtime, and data services are ready.',
    ],
    journeySteps: [
      'Review failing checks first, then use the linked actions to fix setup gaps.',
    ],
  },
  strategies: {
    title: 'Strategy Studio',
    talkTrack: [
      'Strategy Studio defines how each domain is persisted and executed in the active environment.',
    ],
    journeySteps: [
      'Review the active strategy, inspect the model, and explain what the runtime will do with that configuration.',
    ],
  },
  'deploy-strategies': {
    title: 'Deploy Your Strategy',
    talkTrack: [
      'Deployment turns a strategy definition into a runtime contract the environment can activate.',
    ],
    journeySteps: [
      'Validate the manifest, inspect capabilities, and activate the strategy on the target environment.',
    ],
  },
  templates: {
    title: 'Data Model Catalog',
    talkTrack: [
      'Data Model Catalog is where imported clinical models are reviewed and managed before they are used elsewhere in the workspace.',
    ],
    journeySteps: [
      'Browse the catalog, inspect a template, and highlight the fields that will matter later in queries, mappings, or apps.',
    ],
  },
  contextObjects: {
    title: 'ContextObjects Builder',
    talkTrack: [
      'ContextObjects Builder lets the team define reusable semantic products that sit above raw template structure.',
    ],
    journeySteps: [
      'Create or edit a context object, then show how it becomes reusable across downstream retrieval and copilots.',
    ],
  },
  'context-blocks': {
    title: 'ContextObjects Building Blocks',
    talkTrack: [
      'Building Blocks are the reusable pieces that keep ContextObjects consistent across teams and domains.',
    ],
    journeySteps: [
      'Show a reusable block, explain where it is consumed, and connect it back to higher-level semantic products.',
    ],
  },
  synthetic: {
    title: 'Synthetic Data',
    talkTrack: [
      'Synthetic Data is where users prove the model and strategy can generate realistic operational test data.',
    ],
    journeySteps: [
      'Pick the environment, choose the model scope, run generation, and validate the resulting workload.',
    ],
  },
  mapping: {
    title: 'Mapping Studio',
    talkTrack: [
      'Mapping Studio is the bridge from external source data into the target semantic model.',
    ],
    journeySteps: [
      'Upload a source document, configure mappings, and explain how the transformation aligns with the target model.',
    ],
  },
  history: {
    title: 'Jobs History',
    talkTrack: [
      'Jobs History is the operational audit trail for generation, mapping, and other long-running tasks.',
    ],
    journeySteps: [
      'Review the latest run, show status details, and use history to explain reliability and troubleshooting.',
    ],
  },
  queries: {
    title: 'Library',
    talkTrack: [
      'Library is the reusable query surface where validated AQL assets are managed.',
    ],
    journeySteps: [
      'Open a saved query, explain the semantic intent, and connect it to the downstream runtime or application experience.',
    ],
  },
  lab: {
    title: 'Query Lab',
    talkTrack: [
      'Query Lab is where users translate retrieval intent into executable runtime behavior.',
    ],
    journeySteps: [
      'Select the active environment, compose a query, and validate the generated output before saving.',
    ],
  },
  builder: {
    title: 'Query Builder',
    talkTrack: [
      'Query Builder guides users through constructing AQL queries without hand-authoring the full query.',
    ],
    journeySteps: [
      'Build the query shape step by step, then compare the generated result with the final executable form.',
    ],
  },
  'api-docs': {
    title: 'API Documentation',
    talkTrack: [
      'API Documentation shows how the configured environment and strategy surface operational endpoints to downstream clients.',
    ],
    journeySteps: [
      'Review the API shape, choose an operation, and connect it back to the strategy that powers it.',
    ],
  },
  sandbox: {
    title: 'API Sandbox',
    talkTrack: [
      'Sandbox is the proving ground for runtime calls before they are embedded into external apps or workflows.',
    ],
    journeySteps: [
      'Run a request, inspect the payload and response, and explain which environment and strategy handled it.',
    ],
  },
  'app-gallery': {
    title: 'App Gallery',
    talkTrack: [
      'App Gallery shows which downstream applications can light up once the semantic and runtime layers are in place.',
    ],
    journeySteps: [
      'Pick an app, explain compatibility, and connect it to the strategy and model assets already configured.',
    ],
  },
  environments: {
    title: 'Environment Settings',
    talkTrack: [
      'Environment Settings is where the workspace connects HDL to live runtime infrastructure.',
    ],
    journeySteps: [
      'Review connection details, check runtime configuration, and confirm which environment is active.',
    ],
  },
  'theme-config': {
    title: 'Theme Customization',
    talkTrack: [
      'Theme Customization lets the workspace brand the experience without changing the underlying platform contract.',
    ],
    journeySteps: [
      'Update theme properties, preview the branding change, and explain how team-level settings propagate.',
    ],
  },
  'data-organization': {
    title: 'Data Organization',
    talkTrack: [
      'Data Organization keeps saved assets discoverable as the workspace grows.',
    ],
    journeySteps: [
      'Use folders and tags to show how teams keep queries, models, and assets manageable over time.',
    ],
  },
};

const SECTION_VALUE_STORY = {
  home: [
    'MongoDB keeps the control plane and runtime loosely coupled so teams can evolve workflows without rewriting the database layer.',
    'The workspace centralizes operational context, which is critical for onboarding new teams quickly.',
  ],
  strategy: [
    'MongoDB supports multiple persistence strategies without forcing a single rigid schema pattern.',
    'Teams can activate and compare strategies per environment instead of rebuilding the whole stack.',
  ],
  models: [
    'MongoDB fits evolving healthcare models because nested, heterogeneous structures can stay close to the source semantics.',
    'Semantic assets remain reusable across import, retrieval, and application experiences.',
  ],
  factory: [
    'MongoDB can absorb generated or mapped clinical data at operational scale while staying flexible as inputs change.',
    'The same platform supports both synthetic workload validation and ingestion of transformed source data.',
  ],
  query: [
    'MongoDB makes it practical to turn semantic questions into executable retrieval patterns over complex healthcare data.',
    'The platform can support curated question libraries, generated queries, and downstream copilots from the same data foundation.',
  ],
  api: [
    'MongoDB-backed runtime APIs let teams expose stable contracts while the underlying strategies keep evolving.',
    'Testing APIs in-context reduces the gap between data design and application delivery.',
  ],
  apps: [
    'A shared MongoDB-backed semantic layer makes it easier to light up multiple downstream apps from the same foundation.',
  ],
  workspace: [
    'MongoDB Atlas plus HDL environment management gives teams a repeatable path from setup to runtime execution.',
  ],
  default: [
    'This part of the workspace builds on the same MongoDB-backed semantic and runtime foundation used across Healthcare Data Lab.',
  ],
};

function normalizeCopy(value) {
  return String(value || '')
    .replace(/\{\s*'\{kehrnel\}'\s*\}/gi, 'Kehrnel')
    .replace(/\{kehrnel\}/gi, 'Kehrnel')
    .replace(/\{\{KEHRNEL_DOCS_URL\}\}/g, 'Kehrnel documentation')
    .replace(/\s+/g, ' ')
    .trim();
}

function dedupeStrings(values = []) {
  const seen = new Set();
  return values
    .map(normalizeCopy)
    .filter((value) => {
      if (!value) return false;
      const key = value.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function toParagraphsHtml(values = []) {
  const items = dedupeStrings(values);
  return items.length
    ? items.map((item) => `<p>${escapeHtml(item)}</p>`).join('')
    : '';
}

function toListHtml(values = []) {
  const items = dedupeStrings(values);
  return items.length
    ? `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`
    : '';
}

function getNavigationItem(viewId) {
  for (const section of NAVIGATION_CONFIG.sections || []) {
    const match = (section.items || []).find((item) => item.viewId === viewId || item.id === viewId);
    if (match) return { item: match, section };
  }
  return { item: null, section: null };
}

function sectionKeyForView(viewId) {
  if (!viewId || viewId === 'home' || viewId === 'learn') return 'home';
  if (['workspace-health', 'environments', 'theme-config', 'data-organization', 'team', 'join-team'].includes(viewId)) {
    return 'workspace';
  }
  if (['strategies', 'deploy-strategies'].includes(viewId)) return 'strategy';
  if (['templates', 'contextObjects', 'context-blocks', 'context-views'].includes(viewId)) return 'models';
  if (['synthetic', 'mapping', 'history'].includes(viewId)) return 'factory';
  if (['queries', 'lab', 'builder', 'copilot-questions', 'copilot-products', 'copilot-tools', 'copilot-answers', 'copilot-control'].includes(viewId)) {
    return 'query';
  }
  if (['api-docs', 'api', 'sandbox'].includes(viewId)) return 'api';
  if (viewId === 'app-gallery') return 'apps';
  return 'default';
}

function getManualSection(module, sectionId) {
  return (module?.manual?.sections || []).find((section) => section?.id === sectionId) || null;
}

function buildModuleGuidance(module) {
  const purpose = getManualSection(module, 'purpose')?.paragraphs || [];
  const workflow = getManualSection(module, 'workflow')?.steps || [];
  const capabilities = getManualSection(module, 'you-can')?.bullets || [];
  const concepts = (getManualSection(module, 'concepts')?.terms || [])
    .map((entry) => {
      const term = normalizeCopy(entry?.term);
      const definition = normalizeCopy(entry?.definition);
      if (!term || !definition) return '';
      return `${term}: ${definition}`;
    })
    .filter(Boolean);

  return {
    purpose: dedupeStrings(purpose),
    workflow: dedupeStrings(workflow),
    capabilities: dedupeStrings(capabilities),
    concepts: dedupeStrings(concepts),
  };
}

export function getSherpaRouteContext(pathname = '/') {
  const resolvedView = sherpaPathToView(pathname) || 'home';
  const baseView = resolvedView.startsWith('learn:') ? 'learn' : resolvedView;
  const moduleId = resolvedView.startsWith('learn:')
    ? resolvedView.slice('learn:'.length)
    : getLearningModuleIdForView(baseView);
  const module = getLearningModuleById(moduleId);
  const moduleGuide = buildModuleGuidance(module);
  const { item: navItem } = getNavigationItem(baseView);
  const explicit = VIEW_GUIDANCE[baseView] || {};
  const title = normalizeCopy(module?.title || explicit.title || navItem?.label || 'Healthcare Data Lab');
  const talkTrack = dedupeStrings([
    ...(explicit.talkTrack || []),
    module?.description,
    ...moduleGuide.purpose,
  ]);
  const journeySteps = dedupeStrings([
    ...(explicit.journeySteps || []),
    ...moduleGuide.workflow,
    ...((module?.steps || []).map((step) => step?.description || step?.title)),
  ]);
  const whyMongo = dedupeStrings([
    ...(explicit.whyMongo || []),
    ...(SECTION_VALUE_STORY[sectionKeyForView(baseView)] || SECTION_VALUE_STORY.default),
  ]);
  const learningGoals = dedupeStrings([
    ...moduleGuide.capabilities,
    ...moduleGuide.concepts,
  ]);

  return {
    title,
    talkTrack: talkTrack.length
      ? talkTrack
      : [`Use ${title} to explain how this part of Healthcare Data Lab fits into the onboarding journey.`],
    journeySteps: journeySteps.length
      ? journeySteps
      : [`Walk through the main actions available in ${title}.`],
    whyMongo,
    narration: talkTrack[0] || `Explain ${title} before moving into the detailed workflow.`,
    overviewTitle: title,
    overviewNarrationHtml: toParagraphsHtml(talkTrack.slice(0, 3)),
    overviewStepOutlineHtml: toListHtml(journeySteps.slice(0, 5)),
    overviewWhyMongoHtml: toListHtml(whyMongo.slice(0, 4)),
    overviewSections: learningGoals.length
      ? [
          {
            id: 'learning-goals',
            label: 'Learning goals',
            items: learningGoals.slice(0, 4),
          },
        ]
      : [],
  };
}
