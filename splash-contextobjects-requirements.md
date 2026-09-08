# Requirements Specification
## SPLASH Studio and ContextObjects Studio Refactor

Version: 0.1
Date: 2026-03-21
Status: Draft for implementation

---

## 1. Decision Summary

The current ContextObject builder should become the starting point for a **shared hierarchical-modeling workbench**, but it should **not** be directly renamed into a SPLASH builder.

Instead, the implementation should split the current product into:

1. **SPLASH Studio**
   - semantic authoring and publication
   - ontology-aligned blocks and definitions
   - operational compilation
   - export of semantic products

2. **ContextObjects Studio**
   - import of SPLASH and other external models
   - runtime wrapping, materialization and retrieval
   - MongoDB-optimized storage and querying
   - Con2L querying and explanation

The current builder already contains a strong shared kernel:
- hierarchical tree authoring
- fields grid
- visual graph / mind map
- validation/lint patterns
- definition metadata and export patterns

These shared capabilities must be extracted into reusable packages and consumed by both studios.

---

## 2. Product Goals

### 2.1 Primary goals

The system must enable:

1. authoring of SPLASH semantic models independently of MongoDB;
2. import of SPLASH, openEHR, FHIR and future models into one uniform runtime;
3. storage and retrieval of all imported models through one common logical runtime model;
4. a single user-facing query interface, `Con2L`, across direct operational queries, cross-subject/cohort queries and AI/evidence queries;
5. deterministic compilation and execution, so the same canonical query over the same artifact versions returns the same ordered results and explanation.

### 2.2 Secondary goals

The system should:
- reuse as much of the current builder UI and code as practical;
- keep SPLASH politically and technically separate from MongoDB-specific runtime concerns;
- allow a demo that proves the full end-to-end workflow with a small healthcare example.

### 2.3 Non-goals for MVP

The first implementation will **not** attempt to:
- cover all SPLASH process and decision-pathway modeling;
- implement full ontology authoring in raw RDF/Turtle UX;
- implement production-grade multi-tenant governance;
- implement full ANN/embedding training pipelines;
- replace source-of-truth operational systems.

---

## 3. Boundary Definition

### 3.1 SPLASH boundary

SPLASH owns anything that answers **“what does this mean?”**

SPLASH must own:
- core ontology layer;
- domain/industry ontology layer;
- local/project extension layer;
- semantic blocks;
- semantic definitions;
- terminology bindings;
- structural bindings;
- semantic relationships;
- data-marking semantics;
- operational definitions compiled from semantic definitions;
- semantic product packaging and export.

SPLASH must **not** own:
- MongoDB partitioning or indexes;
- materialization policy;
- context wrappers;
- context retrieval modes;
- Con2L;
- copilot/runtime eligibility;
- runtime governance slices;
- semi-flattened query nodes as an authored source-of-truth structure.

### 3.2 ContextObjects boundary

ContextObjects owns anything that answers **“how is this materialized, queried and governed at runtime?”**

ContextObjects must own:
- import adapters;
- imported-definition registry;
- context wrappers;
- anchors and temporal contracts;
- materialization and runtime plans;
- MongoDB operational profile;
- object maps;
- context views;
- runtime lint;
- Con2L;
- query explanation and execution trace;
- context instances and instance embeddings.

ContextObjects must **not** own semantic source truth for:
- ontology layers;
- semantic block definitions;
- semantic relationships;
- terminology bindings;
- structural bindings.

It may reference or overlay them, but not author them as the canonical source.

### 3.3 Shared principle

SPLASH must be valid and useful without ContextObjects.
ContextObjects may depend on imported SPLASH artifacts, but SPLASH must not depend on ContextObjects.

---

## 4. Architecture Overview

### 4.1 Monorepo structure

The implementation should use one monorepo containing shared packages and two applications.

Suggested structure:

```text
/apps
  /splash-studio
  /contextobjects-studio
/packages
  /schema-core
  /editor-core
  /lint-core
  /compiler-core
  /export-core
  /import-core
  /query-core
  /ui-core
  /adapter-splash
  /adapter-openehr
  /adapter-fhir
```

### 4.2 Shared package responsibilities

#### `schema-core`
Owns canonical TypeScript types and JSON schemas for:
- hierarchical nodes;
- constraints;
- bindings;
- compiled paths;
- imported definitions;
- context contracts;
- materialization plans;
- Con2L documents.

#### `editor-core`
Owns reusable editors and state logic for:
- tree authoring;
- field grid editing;
- node inspector;
- drag/reorder;
- path preview;
- graph/mind-map visualization.

#### `lint-core`
Owns reusable lint engine with pluggable rule sets:
- SPLASH semantic lint rules;
- ContextObjects runtime lint rules.

#### `compiler-core`
Owns hierarchical compilation logic:
- hierarchy → compiled node registry;
- hierarchy → canonical paths;
- hierarchy → runtime semi-flat plan.

#### `export-core`
Owns packaging and manifest generation for SPLASH export.

#### `import-core`
Owns normalized import pipeline for external models.

#### `query-core`
Owns:
- Canonical Con2L schema;
- Con2L validation;
- query planning contracts;
- explanation model.

#### `ui-core`
Owns theme, common layout shell, form primitives, tables, chips, inspectors and command menus.

---

## 5. Canonical Artifact Model

The system must define and version the following artifacts.

### 5.1 SPLASH Block
Reusable semantic component.

Required fields:
- id
- version
- label
- description
- ontology scope (core/domain/local)
- hierarchical root node
- terminology bindings
- structural bindings
- semantic relationships
- provenance metadata

### 5.2 SPLASH Definition
Assembled semantic structure built from blocks and/or inline nodes.

Required fields:
- id
- version
- label
- description
- definition kind (`information_definition` for MVP)
- root hierarchical tree
- included blocks and overlays
- bindings and semantic relationships
- validation status

### 5.3 SPLASH Operational Definition
Compiled artifact derived from a SPLASH Definition.

Required fields:
- id
- source definition id
- source version
- compiled node registry
- canonical path registry
- datatype/cardinality metadata
- semantic markers
- dependency manifest
- content hash

### 5.4 SPLASH Semantic Product
Versioned package exported by SPLASH Studio.

Required fields:
- product id
- product version
- included ontology layers or references
- included blocks
- included definitions
- included operational definitions
- manifest
- export timestamp
- content hash

### 5.5 Imported Definition
Normalized hierarchical representation stored in ContextObjects after import.

Required fields:
- import id
- source type (`splash`, `openehr`, `fhir`, `json_schema`, `custom`)
- source artifact id
- source version
- imported version
- normalized root hierarchical tree
- normalized node registry
- normalized canonical path registry
- source lineage
- source bindings and semantics copied or mapped from source
- compatibility flags

### 5.6 ContextObject Definition
Runtime wrapper built on top of one or more Imported Definitions.

Required fields:
- id
- version
- label
- description
- imported definition references
- wrapper kind (`source_wrapper` or `composed_context`)
- primary anchor
- temporal contract
- retrieval contract
- governance contract
- materialization contract
- Con2L eligibility
- runtime lint status

### 5.7 Materialization Plan
Compiled runtime plan derived from ContextObject Definition + Imported Definition(s).

Required fields:
- plan id
- context object definition id
- plan version
- runtime semi-flat node projection
- canonical query paths
- path aliases
- index hints
- optimized paths
- partitioning hints
- temporal axes
- supported retrieval modes
- content hash

### 5.8 ContextObject Instance
Runtime instance stored in MongoDB.

Required fields:
- instance id
- context object definition id
- imported definition refs
- source refs
- canonical hierarchical payload or source payload reference
- compiled semi-flat query nodes
- anchor values
- temporal values
- provenance slice
- governance slice
- lifecycle metadata
- optional summary/enrichment fields
- optional embeddings

### 5.9 Con2L Document
Canonical user-facing query representation.

Required fields:
- query id
- version
- intent
- target context types
- subject/anchor filters
- temporal filters
- structural/semantic filters
- output mode
- governance/purpose constraints
- deterministic options

---

## 6. Hierarchy and Compilation Rules

### 6.1 Hierarchical source of truth

All authored definitions and imported models must preserve a full hierarchical representation.
The hierarchical tree is the only source of truth for semantic structure.

### 6.2 Semi-flattening rule

Semi-flat nodes must not be authored directly.
Semi-flat nodes must be generated by compilation from:
- hierarchical tree;
- canonical path rules;
- selected runtime path signals.

### 6.3 Dual representation rule

The system must support both:
- a hierarchical authored/normalized form; and
- a compiled runtime semi-flat form.

### 6.4 Path generation rule

Canonical paths must be deterministically generated from the hierarchy.
Path generation must be stable across repeated compilations of the same definition.

### 6.5 No silent mutation rule

Imported definitions must be immutable by default.
Any local changes must be represented as overlays or wrapper-level annotations.

---

## 7. SPLASH Studio Functional Requirements

### 7.1 Repository and package management

**SP-FR-001** The system must provide a repository browser for SPLASH blocks, definitions, operational definitions and semantic products.

**SP-FR-002** The system must support creation, duplication, versioning and status changes for SPLASH artifacts.

**SP-FR-003** The system must support draft, review and published states.

### 7.2 Ontology workbench

**SP-FR-010** The system must support browsing of ontology layers: core, domain and local.

**SP-FR-011** The system should support RDF-friendly export/publication of ontology data, with separate named-graph-like layers for core/domain/local publication boundaries.

**SP-FR-012** The system must support semantic identifiers, labels, aliases, descriptions and provenance metadata.

**SP-FR-013** The system should support graph navigation of concept relations.

### 7.3 Block authoring

**SP-FR-020** The system must support creation and editing of reusable SPLASH Blocks.

**SP-FR-021** A block editor must allow:
- hierarchical node editing;
- node role assignment;
- datatype assignment;
- cardinality constraints;
- optional descriptions and annotations.

**SP-FR-022** A block must support terminology and structural bindings.

**SP-FR-023** A block must support semantic relationships.

### 7.4 Definition authoring

**SP-FR-030** The system must support creation of SPLASH Definitions from blocks and inline nodes.

**SP-FR-031** For MVP, the system must support at least `information_definition`.

**SP-FR-032** The definition editor must support adding, removing, reordering and constraining included blocks.

**SP-FR-033** The definition editor must support a tree view, field grid view and graph/mind-map view.

### 7.5 Data-marking semantics

**SP-FR-040** The system must support attaching model-element identifiers to hierarchical nodes.

**SP-FR-041** The system must support attaching “is about” semantics / ontology references to nodes where applicable.

**SP-FR-042** The system should support source-provenance markers in semantic definitions where required by SPLASH.

### 7.6 Operational compilation

**SP-FR-050** The system must compile a SPLASH Definition into a SPLASH Operational Definition.

**SP-FR-051** The compiled form must include:
- node registry;
- canonical paths;
- effective cardinalities;
- datatype metadata;
- inherited bindings;
- semantic marker projection.

**SP-FR-052** The compiler must be deterministic.

### 7.7 Semantic lint

**SP-FR-060** The system must provide SPLASH semantic lint with rule categories:
- hierarchy;
- constraints;
- path uniqueness;
- bindings;
- semantic markers;
- operational compileability.

**SP-FR-061** Semantic lint must not contain MongoDB runtime-only checks.

### 7.8 Packaging and export

**SP-FR-070** The system must export a SPLASH Semantic Product package.

**SP-FR-071** The package must include a manifest describing included artifacts and versions.

**SP-FR-072** The package must carry a content hash.

---

## 8. ContextObjects Studio Functional Requirements

### 8.1 Import framework

**CO-FR-001** The system must support import adapters for:
- SPLASH semantic products;
- openEHR artifacts;
- FHIR artifacts;
- JSON Schema;
- custom hierarchical JSON definitions.

**CO-FR-002** Each adapter must normalize imported data into Imported Definition format.

**CO-FR-003** Each import must preserve source lineage and version metadata.

### 8.2 Imported definition registry

**CO-FR-010** The system must provide a browser for Imported Definitions.

**CO-FR-011** Imported Definitions must be read-only by default.

**CO-FR-012** The system must support overlays/annotations without modifying the source-normalized tree.

### 8.3 Wrapper composition

**CO-FR-020** The system must support building ContextObject Definitions from one or more Imported Definitions.

**CO-FR-021** The system must support two wrapper kinds:
- `source_wrapper`
- `composed_context`

**CO-FR-022** A source wrapper must support one imported artifact 1:1.

**CO-FR-023** A composed context must support combining multiple imported artifacts under one runtime contract.

### 8.4 Context contract

**CO-FR-030** The system must support editing of a Context contract with at least:
- context type;
- primary anchor;
- optional secondary anchors;
- temporal mode;
- assertion model;
- retrieval modes;
- materialization policy;
- governance profile;
- provenance requirements;
- cross-subject capability;
- AI/copilot eligibility.

### 8.5 Materialization compiler

**CO-FR-040** The system must compile a ContextObject Definition into a Materialization Plan.

**CO-FR-041** The plan must generate runtime semi-flat query nodes from the imported hierarchy.

**CO-FR-042** The plan must generate:
- canonical runtime query paths;
- path aliases;
- optimized paths;
- partitioning hints;
- temporal axes;
- index hints.

**CO-FR-043** The plan must be deterministic.

### 8.6 Runtime lint

**CO-FR-050** The system must provide ContextObjects runtime lint with rule categories:
- anchor completeness;
- temporal completeness;
- lifecycle metadata;
- provenance requirements;
- deterministic queryability;
- retrieval mode compatibility;
- Con2L compatibility.

**CO-FR-051** Runtime lint must not report SPLASH semantic-authoring-only issues as blocking runtime errors.

### 8.7 Object maps

**CO-FR-060** The system must support declarative object maps from source payloads to imported canonical paths.

**CO-FR-061** Object maps must support:
- field mapping;
- transforms;
- unit normalization;
- terminology normalization;
- provenance capture;
- merge/update policy.

### 8.8 Instance explorer

**CO-FR-070** The system must display materialized ContextObject instances.

**CO-FR-071** The instance view must show:
- wrapper definition used;
- imported definition source(s);
- hierarchical payload;
- runtime semi-flat nodes;
- anchor values;
- time values;
- provenance/governance slices.

### 8.9 Query studio

**CO-FR-080** The system must provide a Con2L playground.

**CO-FR-081** The playground must show:
- natural language input;
- draft Con2L;
- canonical Con2L;
- internal query plan;
- native MongoDB query plan;
- results and explanation trace.

### 8.10 Views

**CO-FR-090** The system should support ContextViews/read-optimized projections derived from materialization plans.

**CO-FR-091** Views should support operational, cohort and AI evidence use cases.

---

## 9. Query Requirements

### 9.1 Single user-facing query interface

**Q-FR-001** The only user-facing query language must be Con2L.

**Q-FR-002** Con2L must support direct operational retrieval, cross-subject filters/cohorts and AI/evidence retrieval.

### 9.2 Canonicalization pipeline

**Q-FR-010** Natural language must never execute directly.

**Q-FR-011** The query pipeline must be:

```text
Natural language → Draft Con2L → Canonical Con2L → Internal plan → Native execution
```

**Q-FR-012** Determinism begins at Canonical Con2L.

### 9.3 Intents

**Q-FR-020** Con2L must support at least these intents for MVP:
- retrieve
- filter
- aggregate
- compare
- summarize
- explain
- evidence_bundle

### 9.4 Canonical path semantics

**Q-FR-030** Queries must target canonical paths derived from imported hierarchical definitions.

**Q-FR-031** Queries must not require knowledge of source RM classes or MongoDB internal schema.

### 9.5 Explainability

**Q-FR-040** Every query execution must be able to return:
- matched context objects;
- matched paths;
- filters applied;
- execution mode used;
- evidence snippets or fragments;
- artifact versions used.

---

## 10. UI / UX Requirements

### 10.1 Shared UI patterns

The following current screens/components should become shared editor capabilities:
- Compose
- Fields
- Mind Map
- Node Properties inspector
- path preview
- add/remove child actions
- card-based block browser

### 10.2 SPLASH Studio screen map

Required screens for MVP:
- repository browser
- ontology browser
- block editor
- definition editor
- semantic lint
- operational definition preview
- export package dialog

### 10.3 ContextObjects Studio screen map

Required screens for MVP:
- import manager
- imported definition browser
- context wrapper editor
- runtime contract editor
- runtime lint
- materialization preview
- object-map builder
- instance explorer
- Con2L playground

### 10.4 Split of current tabs

The existing tabs should be reassigned as follows.

#### Shared / reusable
- Compose
- Fields
- Mind Map

#### SPLASH only
- semantic metadata
- terminology bindings
- structural bindings
- semantic relationships
- semantic lint
- operational definition preview

#### ContextObjects only
- context contract
- runtime metadata
- operational profile
- runtime lint
- Con2L / query trace

---

## 11. Current Builder Migration Requirements

### 11.1 Migration approach

The team must not delete the current builder and restart from scratch.
Instead, the team must:
1. extract shared packages;
2. freeze the current schema;
3. create migration scripts;
4. split existing state into semantic vs runtime artifacts.

### 11.2 Migration mapping from current JSON

The current JSON structure must be split as follows.

#### Move to SPLASH Definition / Imported Definition
- `name`
- `description`
- `definition`
- `nodes` (only as compiled/normalized node registry, not authored source)
- `terminologyBindings`
- `structuralBindings`
- `relationships`
- semantic parts of `metadata.tags`

#### Move to ContextObject Definition
- `metadata.contextContract`
- runtime-only metadata such as anchor, retrieval policy, governance, copilot policy

#### Move to Materialization Plan
- semi-flat query nodes
- computed paths intended for runtime
- operational profile fields such as partition key, optimized paths, index hints, temporal axis

### 11.3 Schema versioning

The implementation must introduce explicit schema versions for:
- Splash Definition
- Splash Operational Definition
- Imported Definition
- ContextObject Definition
- Materialization Plan
- Con2L

### 11.4 Backward compatibility

The first refactor should include a one-way migration tool that converts the old builder JSON into the new split artifacts.

---

## 12. API Requirements

### 12.1 SPLASH APIs

Required endpoints for MVP:
- list/create/update/delete block
- list/create/update/delete definition
- compile definition
- lint definition
- export semantic product
- list ontology entities (read-only MVP is acceptable)

### 12.2 ContextObjects APIs

Required endpoints for MVP:
- import external artifact
- list imported definitions
- create/update context object definition
- compile materialization plan
- lint context object definition
- create/update object map
- materialize sample instances
- execute Con2L
- inspect execution trace

---

## 13. Persistence Requirements

### 13.1 SPLASH persistence

For MVP, SPLASH authoring artifacts may be stored in JSON documents.
Ontology publication as RDF-friendly output should be supported as export or publication form, not necessarily as the primary authoring persistence model.

### 13.2 ContextObjects persistence

ContextObject Definitions, Materialization Plans and Instances must be persisted in MongoDB-friendly JSON/BSON structures.

### 13.3 Dual storage requirement for instances

A ContextObject instance must preserve enough hierarchical fidelity to reconstruct the semantic structure while also storing compiled semi-flat runtime nodes for efficient querying.

---

## 14. Determinism and Auditability Requirements

### 14.1 Artifact pinning

Every compile and query operation must reference exact artifact versions.

### 14.2 Stable ordering

Queries must return stable ordering using explicit sort keys and deterministic tie-breakers.

### 14.3 Replayability

A canonical Con2L query executed against the same imported-definition versions, wrapper versions and materialization-plan versions must produce the same result ids and explanation ordering.

### 14.4 Traceability

Every instance and query result must expose lineage to:
- source artifact(s)
- imported definition(s)
- wrapper definition
- materialization plan
- query version

---

## 15. Technical Recommendations

### 15.1 Frontend

Recommended:
- React + TypeScript
- Vite
- shared form engine with schema-driven inspectors
- React Flow for graph/mind-map views
- TanStack Query for server state
- Zustand or equivalent for local editor state
- Zod or JSON-schema-driven validation

### 15.2 Backend

Recommended:
- TypeScript service layer
- JSON schema validation
- modular adapter framework
- compiler packages shared across frontend and backend where practical

---

## 16. Phased Delivery Plan

### Phase 0 — Schema freeze and extraction
- freeze current builder schema
- identify shared components
- split semantic vs runtime concerns
- build migration script

### Phase 1 — Shared core
- implement `schema-core`, `editor-core`, `lint-core`
- move Compose / Fields / Mind Map into shared package
- preserve visual parity with current builder where feasible

### Phase 2 — SPLASH Studio MVP
- repository browser
- block editor
- definition editor
- semantic lint
- operational compilation
- export package

### Phase 3 — ContextObjects Studio MVP
- import SPLASH package
- imported definition registry
- context wrapper editor
- runtime contract editor
- runtime lint
- materialization plan preview

### Phase 4 — Runtime demo
- object maps
- sample instance materialization
- Con2L playground
- explanation trace

### Phase 5 — Multi-source import
- openEHR adapter
- FHIR adapter
- one mixed-source composed context demo

---

## 17. MVP Acceptance Scenario

The MVP will be accepted when the following works end-to-end.

### SPLASH Studio
1. User creates or edits an `AnalyteResult` block.
2. User creates a `LaboratoryReport` information definition.
3. User runs semantic lint and resolves issues.
4. User compiles to an operational definition.
5. User exports a semantic product package.

### ContextObjects Studio
1. User imports the semantic product package.
2. System creates an Imported Definition.
3. User creates `PatientLaboratoryContext` as a wrapper definition.
4. User sets anchor path and temporal path.
5. User compiles a Materialization Plan.
6. User maps sample lab JSON into ContextObject instances.
7. User runs three Con2L queries:
   - latest results for a patient;
   - count patients with glucose above threshold;
   - evidence bundle for abnormal glucose.
8. System returns deterministic results and query trace.

---

## 18. Immediate Build Decision

The team should start **refactoring the current ContextObject builder into a shared hierarchical editor core**, then build **SPLASH Studio first** on top of that core, while preserving **ContextObjects Studio** as a separate runtime-focused application.

It should **not** directly rename the current builder into SPLASH Builder without first separating:
- semantic authoring;
- imported definitions;
- runtime contracts;
- materialization plans.

That separation is the central implementation requirement.

