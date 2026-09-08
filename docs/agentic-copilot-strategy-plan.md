# Agentic Copilots Strategy Plan for Healthcare Data Lab

## Purpose

This document proposes how to add a new strategy family to Healthcare Data Lab (HDL) that operationalizes the full copilot process we have been evolving in the battery and Leafy Hospital projects:

1. understand the question space and personas
2. define ideal human answers
3. define semantic products
4. define tools and governed query plans
5. define answer models
6. evaluate and improve through a control plane

The key extension proposed here is to use **ContextObjects** as a first-class modeling layer for data design, generation, mapping, retrieval, and agentic execution.

This is not only a healthcare idea. It should become a multi-domain strategy pattern that HDL and `{kehrnel}` can support together.

---

## Executive Summary

HDL already contains most of the major surfaces we need:

- Strategy Studio
- ContextObject Builder
- Synthetic Data
- Mapping Studio
- Query Library / Query Lab / Query Builder
- Deploy Your Strategy
- App Gallery

`{kehrnel}` already contains much of the runtime substrate we need:

- strategy manifests and activation
- transform / map / validate / ingest / query execution
- synthetic job runtime
- environment-scoped operations

What is missing is not another isolated tool. What is missing is a **single end-to-end strategy model** that connects:

- ContextObject design
- Object mapping
- synthetic generation
- query compilation and execution
- semantic products
- answer models
- evaluation libraries
- example functional apps

The right move is to add a new HDL strategy family, for example:

- `agentic_copilots`

with a concrete first specialization such as:

- `agentic.healthcare.context_objects`

This strategy should treat HDL as the control-plane and authoring UX, and `{kehrnel}` as the execution/runtime substrate.

---

## Current State Assessment

## HDL Already Has the Right Product Skeleton

The current HDL navigation already implies the right lifecycle:

- [navigation.js](/Users/francesc.mateu/Documents/GitHub/HealthcareDataLab/src/config/navigation.js)
- [learningModules.json](/Users/francesc.mateu/Documents/GitHub/HealthcareDataLab/src/config/learningModules.json)

The most relevant existing HDL surfaces are:

- [StrategyManager.jsx](/Users/francesc.mateu/Documents/GitHub/HealthcareDataLab/src/components/views/strategyStudio/StrategyManager.jsx)
- [contextObjectBuilder.jsx](/Users/francesc.mateu/Documents/GitHub/HealthcareDataLab/src/components/views/contextObjectBuilder/contextObjectBuilder.jsx)
- [contextObjectEditor.jsx](/Users/francesc.mateu/Documents/GitHub/HealthcareDataLab/src/components/views/contextObjectBuilder/contextObjectEditor.jsx)
- [CreationWizard.jsx](/Users/francesc.mateu/Documents/GitHub/HealthcareDataLab/src/components/views/contextObjectBuilder/CreationWizard.jsx)
- [SyntheticDataWorkflow.jsx](/Users/francesc.mateu/Documents/GitHub/HealthcareDataLab/src/components/views/syntheticData/SyntheticDataWorkflow.jsx)
- [MappingStudio.jsx](/Users/francesc.mateu/Documents/GitHub/HealthcareDataLab/src/components/views/mappingStudio/MappingStudio.jsx)
- [QueryBuilder.jsx](/Users/francesc.mateu/Documents/GitHub/HealthcareDataLab/src/components/views/queryBuilder/QueryBuilder.jsx)
- [AppGallery.jsx](/Users/francesc.mateu/Documents/GitHub/HealthcareDataLab/src/components/views/appGallery/AppGallery.jsx)
- [DeployStrategies.jsx](/Users/francesc.mateu/Documents/GitHub/HealthcareDataLab/src/components/views/deployStrategies/DeployStrategies.jsx)

This means HDL already has the UX shell for the full story.

## `{kehrnel}` Already Has the Right Runtime Substrate

Relevant runtime and contract material:

- [README.md](/Users/francesc.mateu/Documents/GitHub/kehrnel/README.md)
- [hdl-contract.md](/Users/francesc.mateu/Documents/GitHub/kehrnel/docs/hdl-contract.md)
- [hdl-kehrnel-contextobjects-contract.md](/Users/francesc.mateu/Documents/GitHub/kehrnel/docs/hdl-kehrnel-contextobjects-contract.md)
- [hdl-kehrnel-synthetic-contract-v2.md](/Users/francesc.mateu/Documents/GitHub/kehrnel/docs/hdl-kehrnel-synthetic-contract-v2.md)
- [folder_structure.txt](/Users/francesc.mateu/Documents/GitHub/kehrnel/folder_structure.txt)

The runtime is already strategy-oriented, environment-scoped, and compatible with:

- catalog / manifest discovery
- activation
- query
- compile-only query preview
- synthetic jobs
- strategy-specific ops
- validation and transform flows

This is a strong fit for the proposed agentic strategy.

---

## What the ContextObject Builder Already Does Well

The current builder is already strong at **structural modeling**:

- node tree editing
- mind map / fields table / block composition
- AI-assisted bootstrap
- starter examples
- linting
- JSON Schema generation from semantic nodes

Relevant files:

- [contextObjectEditor.jsx](/Users/francesc.mateu/Documents/GitHub/HealthcareDataLab/src/components/views/contextObjectBuilder/contextObjectEditor.jsx)
- [NodeMindMap.jsx](/Users/francesc.mateu/Documents/GitHub/HealthcareDataLab/src/components/views/contextObjectBuilder/NodeMindMap.jsx)
- [IntegratedBlockComposer.jsx](/Users/francesc.mateu/Documents/GitHub/HealthcareDataLab/src/components/views/contextObjectBuilder/IntegratedBlockComposer.jsx)
- [LintPanel.jsx](/Users/francesc.mateu/Documents/GitHub/HealthcareDataLab/src/components/views/contextObjectBuilder/LintPanel.jsx)
- [linting.js](/Users/francesc.mateu/Documents/GitHub/HealthcareDataLab/src/lib/contextObjects/linting.js)
- [starterExamples.js](/Users/francesc.mateu/Documents/GitHub/HealthcareDataLab/src/components/views/contextObjectBuilder/starterExamples.js)

It also already contains early agentic/domain hints:

- [route.js](/Users/francesc.mateu/Documents/GitHub/HealthcareDataLab/src/app/api/kehrnel/agentic/[domain]/route.js)

That route already encodes domain-specific modeling guidance for:

- X12
- FHIR
- openEHR
- generic

This is a very important sign: HDL is already close to a multi-domain agentic modeling system.

---

## What Is Still Lacking in the ContextObject Builder

The current builder is still mostly a **schema builder**. It is not yet a full **context contract builder**.

The main gaps are:

### 1. ContextObject Type Semantics Are Too Implicit

The builder is good at nodes, but weak at explicitly modeling:

- subject anchor
- population anchor
- cross-subject scope
- temporal span
- episode / investigation / journey semantics
- statefulness
- governance / provenance
- update cadence
- lifecycle policy
- retrieval policy
- materialization policy

These should become first-class sections of a ContextObject type, not inferred indirectly from nodes.

### 2. No First-Class Context Maps

There is Mapping Studio, but the ContextObject Builder does not appear to own or expose:

- how an existing source document maps into a ContextObject type
- how multiple sources contribute to one ContextObject
- how field-level provenance is tracked
- how source-specific ambiguity is represented

We need first-class **Context Maps**.

### 3. No First-Class Instances

A ContextObject type should define:

- its canonical composition
- its realized instances
- patient-scoped instances
- cross-patient instances
- agent-facing instances

Today this is not surfaced as a first-class design step.

### 4. No First-Class Query / Context Request Layer

Today HDL has query tools, but the ContextObject flow does not clearly model:

- Con2L or context request definitions
- query form families
- retrieval intents
- allowed scopes
- aggregate vs subject vs cohort behavior
- expected output shapes

### 5. No First-Class Semantic Product Layer

The builder currently stops too early.

For an agentic strategy, we need a layer that says:

- what governed answers exist over these ContextObjects
- what each answer is for
- what context it requires
- what tools/plans it can invoke
- how it should answer

### 6. No First-Class Answer Model Layer

The final UX layer is missing from HDL’s current authoring story:

- question forms
- main narrative role
- structured widgets
- panel handoff
- role/persona expectations

### 7. Starter Examples Are Too Structure-Oriented

Current starter examples like vitals and lab are good for structure, but weak for full context composition.

We need starters like:

- Oncology episode context
- Diagnostic workup context
- Follow-up leakage context
- Trial eligibility review context
- Imaging-pathology concordance context
- Program operations overview context
- Suspicious-case worklist context
- Multi-patient pathway bottleneck context

---

## Proposed Conceptual Stack

The recommended stack for the new strategy is:

1. `Source standards / source records`
2. `SemanticObjects`
3. `ContextObject types`
4. `Context Maps`
5. `ContextObject instances`
6. `Instances`
7. `Con2L / Request IR`
8. `Semantic products`
9. `Tools + query plans`
10. `Answer models`
11. `Evaluation libraries`
12. `Functional apps`
13. `Control plane`

### Key Layer Boundaries

#### SemanticObjects

Reusable semantic building blocks.

Examples:

- Observation fragment
- Identifier block
- Temporal event
- Device status fragment
- Risk signal block
- Lab analyte block

#### ContextObject Types

Bounded situation or case templates.

Examples:

- `OncologyEpisodeContext`
- `DiagnosticWorkupContext`
- `FollowupDelayPopulationContext`
- `BatteryInvestigationContext`

#### Context Maps

How source documents and source models map into ContextObject types.

Examples:

- CDA -> DiagnosticWorkupContext
- FHIR Patient + Observation + Encounter -> EpisodeContext
- openEHR Composition -> FollowupContext
- CSV operational data -> ProgramOverviewContext

#### Instances

Realized context shapes for:

- subject context
- population context
- agent working context

#### Semantic Products

Governed answer contracts built over ContextObjects and instances.

Examples:

- `patient_case_summary`
- `followup_delay_distribution`
- `trial_protocol_alignment_review`
- `center_benchmark_summary`

#### Answer Models

How the final answer is composed:

- narrative lead
- support details
- widgets
- panel handoff

---

## Proposed New HDL Strategy Family

## Strategy Family

- `agentic_copilots`

## First Concrete Strategy

- `agentic.healthcare.context_objects`

This strategy should be packaged like existing strategy families, but with a broader contract.

### Strategy Responsibilities

The strategy should own:

- ContextObject type definitions
- SemanticObject library
- Context Maps
- Instances
- synthetic generation config
- query forms / Con2L
- semantic products
- tools and query plans
- answer models
- evaluation sets
- example apps

### Where It Lives

#### HDL owns

- authoring UX
- catalog / explorer
- environment binding
- control plane
- evaluation library
- app gallery
- teaching / pattern

#### `{kehrnel}` owns

- strategy manifest and execution
- validation
- mapping runtime
- synthetic generation runtime
- query compilation and execution
- materialized view building
- strategy ops

---

## Proposed HDL Product Flow for Agentic Copilots

The end-to-end HDL workflow should become:

1. **Choose or create strategy**
2. **Define SemanticObjects**
3. **Compose ContextObject types**
4. **Define Context Maps**
5. **Define Instances**
6. **Define synthetic generation recipes**
7. **Define query forms / Con2L**
8. **Define semantic products**
9. **Define tools + query plans**
10. **Define answer models**
11. **Define evaluation library**
12. **Generate sample data**
13. **Run mappings**
14. **Run queries**
15. **Open sample functional apps**
16. **Observe evaluation and improve**

This should be one coherent strategy journey.

---

## Proposed HDL Information Architecture

The current HDL navigation is already close, but it is still organized around older product categories:

- [navigation.js](/Users/francesc.mateu/Documents/GitHub/HealthcareDataLab/src/config/navigation.js)

Today it has:

- Strategy Studio
- Deploy Your Strategy
- Data Model Catalog
- ContextObject Builder
- Synthetic Data
- Mapping Studio
- Jobs History
- Query Library
- Query Lab
- Query Builder
- API
- Sandbox
- App Gallery

This is a strong base, but for the `ContextObjects + Con2L + Copilot` story it should become more explicit and more modular.

## Recommended Top-Level HDL IA

### 1. Strategy

Purpose:

- define and activate strategy families
- understand what a strategy can do
- publish and deploy strategy packs

Keep:

- `Strategy Studio`
- `Deploy Your Strategy`

Extend:

- Strategy details should show capability sections for:
  - ContextObjects
  - Context Maps
  - Instances
  - Con2L
  - Semantic products
  - Answer models
  - Evaluation
  - Example apps

### 2. ContextObjects

Purpose:

- define the contextual data universe

Recommended entries:

- `ContextObject Catalog`
- `ContextObject Builder`
- `Views`
- `Blocks`
- `Instances` (optional later)

Current HDL mapping:

- `Data Model Catalog` should evolve toward `ContextObject Catalog`
- `ContextObject Builder` stays, but becomes richer

Why:

The current `Data Model Catalog` language is too generic for the new model. The central concept should be ContextObjects, not just models.

### 3. Factory

Purpose:

- build data from models
- map external data
- generate synthetic populations
- run batch jobs

Recommended entries:

- `Synthetic Data`
- `Mapping Studio`
- `Jobs History`

Extend:

- add `View Builder` as a submode or explicit step inside Factory
- add `Context Maps` authoring and test harness

### 4. Retrieval

Purpose:

- define and execute context retrieval

Recommended entries:

- `Query Library`
- `Query Lab`
- `Query Builder`

Current HDL mapping:

- `Query Library` remains the top-level library for retrieval assets
- `Query Lab` remains the main execution workbench
- `Query Builder` remains the builder entry point

Important:

This area should become the umbrella for all retrieval styles:

- openEHR / AQL
- FHIR retrieval
- ContextObject retrieval
- Con2L
- future domain retrieval models

So `Con2L` should be introduced **inside Retrieval**, not as a separate top-level product area.

### 5. Copilots

Purpose:

- model the full question-to-answer governance stack on top of ContextObjects

Recommended entries:

- `Question Library`
- `Semantic Products`
- `Tools and Plans`
- `Answer Models`
- `Control Plane`

This is a new major area.

It should be a separate module from ContextObjects and Con2L, even if it uses them deeply.

### 6. Apps

Purpose:

- showcase full strategy-powered apps

Keep:

- `App Gallery`

Extend:

- show which apps are powered by:
  - ContextObjects
  - Con2L
  - Copilot contracts

---

## Recommended Navigation Map

If we redesign the HDL sidebar around the new system, the cleanest version would be:

### Home

- Overview
- Learn
- `{kehrnel}` Docs

### Strategy

- Strategy Studio
- Deploy Your Strategy

### ContextObjects

- Catalog
- Builder
- Views
- Blocks

### Factory

- Synthetic Data
- Mapping Studio
- Jobs History

### Retrieval

- Con2L Library
- Con2L Lab
- Con2L Builder

### Copilots

- Question Library
- Semantic Products
- Tools and Plans
- Answer Models
- Control Plane

### Apps

- App Gallery

---

## What Should Be New vs Extensions of Current HDL

## New Major Sections

These should be created as new first-class product surfaces:

### 1. Views

For authoring and browsing instances.

This is currently missing as a clear first-class surface.

### 2. Blocks

For reusable ContextObject blocks.

These exist conceptually inside the builder, but should be explorable and reusable as their own catalog.

### 3. Copilots

A whole new family of copilot surfaces:

- Question Library
- Semantic Products
- Tools and Plans
- Answer Models
- Control Plane

## Existing Surfaces That Should Be Extended

### Strategy Studio

Extend it to understand:

- multi-asset strategy families
- context and copilot capabilities
- strategy dependency graph

### ContextObject Builder

Extend it from schema/tree building to:

- context contract
- retrieval policy
- view definitions
- product usage

### Mapping Studio

Extend it to support:

- Context Maps
- multi-source-to-context mapping
- provenance preview
- view build preview

### Synthetic Data

Extend it to support:

- ContextObject instance generation
- linked population generation
- agentic working context generation
- evaluation scenario packs

### Query Library / Query Lab / Query Builder

Keep these as the visible HDL product area, but evolve them so they support multiple retrieval paradigms:

- AQL / openEHR
- FHIR retrieval
- ContextObject retrieval
- Con2L

In other words:

- `Con2L` becomes the strategic retrieval contract language
- `Retrieval` remains the user-facing umbrella

### App Gallery

Extend it so every reference app declares:

- required strategy
- required ContextObjects
- required Con2L assets
- required copilot contracts

---

## Recommended Product Boundaries in HDL

To avoid mixing concerns, the boundaries should be:

### ContextObjects

Own:

- definitions
- blocks
- instances
- instances

### Copilots

Own:

- question library
- semantic products
- tools / plans
- answer models
- evaluation
- control plane

This is important because:

- ContextObjects should be valuable without copilots
- retrieval contracts should be valuable without copilots
- Copilots should be able to run on top of ContextObjects + Con2L, but remain their own module

---

## Recommended First Menu Evolution

To keep the change manageable, the first HDL menu pass should be:

### Rename / reframe

- `Data Models` -> `ContextObjects`
- `Query Studio` -> `Retrieval`

### Keep

- Strategy Studio
- Deploy Your Strategy
- Synthetic Data
- Mapping Studio
- Jobs History
- App Gallery

### Add

- `Views`
- `Blocks`
- `Question Library`
- `Semantic Products`
- `Tools and Plans`
- `Answer Models`
- `Control Plane`

### Do later

- `Instances`
- `Context Maps` as separate nav if Mapping Studio becomes too crowded

---

## What Needs To Be Added to HDL

## Workstream A: Strategy Model Upgrade

### Goal

Extend HDL strategy concept so a strategy can define the full copilot/context lifecycle.

### Needed additions

- richer strategy blueprint types
- explicit strategy sections for:
  - context modeling
  - mapping
  - synthetic generation
  - query / retrieval
  - semantic products
  - answer models
  - apps
  - evaluation

### Current relevant files

- [StrategyManager.jsx](/Users/francesc.mateu/Documents/GitHub/HealthcareDataLab/src/components/views/strategyStudio/StrategyManager.jsx)
- [persistenceStrategy.js](/Users/francesc.mateu/Documents/GitHub/HealthcareDataLab/src/lib/validation/persistenceStrategy.js)
- [engines.js](/Users/francesc.mateu/Documents/GitHub/HealthcareDataLab/src/lib/kehrnel/engines.js)

### New proposal

Each strategy manifest should include sections like:

```json
{
  "id": "agentic.healthcare.context_objects",
  "domain": ["ContextObjects", "openEHR", "FHIR", "generic"],
  "capabilities": {
    "semantic_objects": true,
    "context_objects": true,
    "context_maps": true,
    "context_instances": true,
    "synthetic_generation": true,
    "query_forms": true,
    "semantic_products": true,
    "answer_models": true,
    "evaluation_library": true,
    "example_apps": true
  }
}
```

---

## Workstream B: ContextObject Builder Evolution

### Goal

Turn the builder from node/schema editor into a full context contract editor.

### Add first-class sections

#### 1. Context type

- subject context
- population context
- agentic working context

#### 2. Anchor and scope

- primary anchor
- allowed anchors
- subject key fields
- cross-subject keys
- scope rules

#### 3. Temporal model

- point-in-time
- interval
- episode
- longitudinal series
- validity / freshness

#### 4. Governance

- provenance policy
- sensitivity / PHI / access tier
- retention
- auditability
- approval requirements

#### 5. Retrieval policy

- direct lookup
- cohort aggregate
- semantic retrieval
- mixed retrieval
- fallback policy
- materialization preference

#### 6. Composition policy

- reusable SemanticObjects
- reusable blocks
- nested ContextObjects
- merge policy for source contributions

#### 7. Output and instance policy

- default instance families
- subject / population / agent instances
- response payload guidance

### Builder UI additions

- `Context contract` tab
- `Instances` tab
- `Context Maps` tab
- `Generation` tab
- `Query forms` tab
- `Product usage` tab

---

## Workstream C: SemanticObjects Library

### Goal

Add a reusable lego layer inspired by openEHR archetype thinking.

### Needed functionality

- author SemanticObjects
- version them
- tag them by domain
- compose them into ContextObjects
- browse usage across ContextObjects

### Example SemanticObjects

- `Identifier`
- `Address`
- `HumanName`
- `ContactPoint`
- `TemporalEvent`
- `ClinicalObservation`
- `RiskSignal`
- `WorkflowStep`
- `DiagnosticResult`
- `MedicationAdministration`
- `EligibilityCriterion`

### HDL UX

- semantic object catalog
- dependency graph
- where-used explorer
- AI suggestion for extraction into reusable blocks

---

## Workstream D: Context Maps

### Goal

Make source-to-context mapping a first-class artifact.

### Needed functionality

- map a source doc or source collection into ContextObject type(s)
- support multi-source composition
- support field-level provenance
- support mapping confidence
- support transform previews
- support reverse trace from ContextObject field to source path

### HDL UX

Add to Mapping Studio:

- target ContextObject selector
- source-to-context field mapping grid
- multi-source merge editor
- provenance preview
- validation rules
- mapping test harness

### `{kehrnel}` runtime support

Use strategy ops for:

- map source docs to context objects
- build instances
- validate mappings
- run dry-run previews

---

## Workstream E: Synthetic Data Generation

### Goal

Generate realistic ContextObject instances and linked populations, not just isolated records.

### Needed functionality

#### Subject generation

- patient-level context instances
- longitudinal event series
- realistic missingness and data quality

#### Population generation

- centers
- cohorts
- suspicious-case groups
- pathway delays
- eligibility pools

#### Agentic generation

- case review sessions
- unresolved demand queues
- evaluation runs
- trace histories

### HDL UX

Extend Synthetic Data workflow so the user can define:

- ContextObject types to generate
- generation distributions
- inter-object links
- population rules
- edge cases
- evaluation scenario packs

### `{kehrnel}` support

Use and extend:

- synthetic job APIs
- strategy-specific synthetic ops
- plan-only estimation
- model-source + links support

This is directionally consistent with:

- [SyntheticDataWorkflow.jsx](/Users/francesc.mateu/Documents/GitHub/HealthcareDataLab/src/components/views/syntheticData/SyntheticDataWorkflow.jsx)
- [hdl-kehrnel-synthetic-contract-v2.md](/Users/francesc.mateu/Documents/GitHub/kehrnel/docs/hdl-kehrnel-synthetic-contract-v2.md)

---

## Workstream F: Querying and Retrieval

### Goal

Support subject, cross-subject, and agentic queries over the same strategy.

### We need 3 query surfaces

#### 1. Context lookup

- get one subject / one case / one investigation

#### 2. Cross-context analytics

- cohort / center / population / program questions

#### 3. Agentic retrieval

- assemble the right context bundle for a question or workflow step

### Add first-class request artifacts

- Con2L request definitions
- request families
- persona-aware query forms
- scope constraints
- allowed outputs

### HDL UX

#### Query Library

Should store:

- persona
- question
- expected human answer
- expected request shape
- expected context object / view
- expected semantic product
- expected answer model

#### Query Builder

Needs to evolve beyond pure AQL thinking.

Current state:

- [QueryBuilder.jsx](/Users/francesc.mateu/Documents/GitHub/HealthcareDataLab/src/components/views/queryBuilder/QueryBuilder.jsx)

This should gain strategy-specific builders for:

- Context lookup query
- Population aggregate query
- Agentic context assembly request

### `{kehrnel}` support

Compile and execute:

- Con2L / context query
- view query
- subject query
- cross-patient aggregate
- semantic retrieval

---

## Workstream G: Semantic Products and Answer Models

### Goal

Bring the battery / healthcare copilot pattern directly into HDL.

### Semantic products should be first-class HDL artifacts

Each one defines:

- purpose
- required context
- allowed scopes
- retrieval modes
- primary tool
- candidate tools
- primary plan
- candidate plans
- grounding policy
- panel route
- presentation kind

### Answer models should also be first-class HDL artifacts

Each one defines:

- question forms
- narrative role
- widget types
- panel handoff
- example answer shape

### HDL UX

Add dedicated explorers for:

- Semantic products
- Tools
- Query plans
- Answer models

This mirrors what worked in battery and Leafy Hospital.

---

## Workstream H: Evaluation and Control Plane

### Goal

Make the whole lifecycle inspectable and improvable.

### Needed functionality

- question library
- expected human answer
- expected request shape
- expected semantic product
- expected answer model
- eval scoring
- missing / extra / matched parameters
- answer gap diagnostics
- product readiness
- trace inspection
- unresolved demand

### HDL implication

HDL should gain a strategy-level control plane, not only query/mapping tools.

This could mirror the work already done in:

- battery project
- Leafy Hospital project

But generalized around:

- ContextObject strategy health
- view freshness
- mapping coverage
- synthetic coverage
- semantic product quality
- answer-model quality

---

## Workstream I: Example Functional Apps

### Goal

Show that the strategy is real and reusable.

### We should ship examples in App Gallery

At least:

#### 1. Patient Case Copilot

- single subject context
- semantic products
- answer models

#### 2. Program Operations Copilot

- cross-patient analytics
- bottlenecks / delays / distributions

#### 3. ContextObject Workbench

- open one ContextObject instance
- inspect provenance, instances, generated answer products

#### 4. Mapping + Retrieval Playground

- source document
- mapped ContextObject
- resulting instances
- sample queries

#### 5. Multi-Agent Investigation Demo

- agentic working context
- task memory
- unresolved demand
- evaluation loop

These should be published in:

- [AppGallery.jsx](/Users/francesc.mateu/Documents/GitHub/HealthcareDataLab/src/components/views/appGallery/AppGallery.jsx)

---

## Proposed Strategy Artifact Model

For the new strategy family, the authored assets should be:

- `semantic_objects/*.json`
- `context_object_types/*.json`
- `context_maps/*.yaml|json`
- `context_instances/*.json`
- `generation_recipes/*.json`
- `query_forms/*.json`
- `semantic_products/*.json`
- `tools.json`
- `query_plans.json`
- `answer_models.json`
- `evaluation_library.json`
- `apps/*.json`

HDL should author and browse these.

`{kehrnel}` should execute them.

---

## Worked Example: Healthcare

### ContextObject Type

- `DiagnosticWorkupContext`

### Composed SemanticObjects

- Identifier
- Subject anchor
- Temporal event
- Imaging finding
- Pathology result
- Clinical note summary
- Risk signal

### Context Maps

- DICOM metadata -> imaging portion
- pathology report -> pathology portion
- appointment data -> follow-up portion
- clinic note -> assessment portion

### Instances

- patient detail view
- suspicious-case worklist view
- center delay aggregate view

### Semantic products over it

- `diagnostic_risk_summary`
- `protocol_guidance`
- `patient_followup_readiness`
- `care_pathway_bottleneck_review`

### Answer models

- status explanation
- guidance answer
- worklist summary
- bottleneck analysis

### Example app

- Diagnostic Copilot

---

## Worked Example: Battery

### ContextObject Type

- `BatteryInvestigationContext`

### Composed SemanticObjects

- asset identity
- manufacturing batch
- quality event
- genealogy defect
- usage snapshot
- recall relation

### Instances

- profile view
- quality workbench view
- fleet ranking view

### Semantic products

- `quality_status`
- `battery_profile`
- `recall_scope_estimate`
- `analytics_ranking`

### Answer models

- status answer
- profile answer
- scope estimate
- ranking answer

### Example app

- Battery Copilot

---

## Implementation Roadmap

## Phase 1: Strategy and Contract Foundation

### Deliverables

- new strategy family definition for `agentic_copilots`
- richer strategy manifest shape
- first draft artifact folders
- HDL explorer updates for strategy sections

### Outcome

HDL can recognize agentic strategies as more than persistence/query strategies.

## Phase 2: ContextObject Builder Upgrade

### Deliverables

- context contract sections
- view authoring
- map authoring hooks
- improved starter examples
- SemanticObjects catalog

### Outcome

ContextObjects become true context contracts.

## Phase 3: Mapping + Synthetic + Query Integration

### Deliverables

- Context Maps support
- generation recipe support
- Con2L / query form support inside Retrieval
- view build ops

### Outcome

The strategy can materialize real data and query it.

## Phase 4: Semantic Product Layer

### Deliverables

- product contracts
- answer model contracts
- evaluation library
- control plane

### Outcome

We can build and improve deterministic copilots on top of the strategy.

## Phase 5: Example Apps

### Deliverables

- patient copilot
- operations copilot
- mapping/retrieval playground
- multi-agent investigation demo

### Outcome

The strategy becomes demonstrable and teachable.

---

## Recommended First Implementation Slice

If we want the smallest high-value first slice, build:

1. `agentic.healthcare.context_objects` strategy manifest
2. ContextObject Builder upgrades for:
   - context type
   - anchor/scope
   - temporal model
   - retrieval policy
   - view definitions
3. Context Maps MVP in Mapping Studio
4. generation recipe MVP in Synthetic Data
5. query form / Con2L MVP
6. semantic product + answer model MVP
7. one example app:
   - Diagnostic Copilot

This is enough to prove the end-to-end model.

---

## Final Recommendation

The most important architectural decision is:

**Do not build ContextObjects as an isolated schema toy.**

Instead, make them the center of a full strategy family that includes:

- modeling
- mapping
- generation
- querying
- semantic products
- answer models
- evaluation
- apps

HDL already has the right product surfaces.
`{kehrnel}` already has the right runtime substrate.

The next step is to unify them around one explicit strategy family:

- `agentic_copilots`

with:

- `ContextObjects` as the core context contract layer
- `Retrieval` as the umbrella for AQL, FHIR retrieval, ContextObject retrieval, and Con2L
- `Copilots` as the governed answer layer on top
