# Healthcare Data Lab

## What Healthcare Data Lab is

Healthcare Data Lab, or HDL, is an interactive healthcare data modeling and operationalization workbench built on MongoDB. It started from the very practical problem that healthcare models such as openEHR are rich in semantics but are often difficult to activate in real systems. HDL exists to close that gap. It gives teams a place to ingest models, explore them visually, map source data into them, test queries and APIs, generate synthetic data, and progressively turn model semantics into operational capabilities.

HDL is not only a teaching UI and not only a query playground. It is a control surface for working through the full lifecycle of a model:

- understand the source model
- transform it into an executable representation
- validate mappings and semantics
- activate runtime strategies
- expose and test APIs
- generate reusable semantic artifacts
- and increasingly support AI and copilot workflows through governed semantics rather than raw collection guessing

The current product is centered on healthcare, especially openEHR, because openEHR is a demanding benchmark. If a system can preserve openEHR templates, archetype semantics, paths, temporal structures, terminology, and query meaning, it is much more likely to generalize well to other structured healthcare domains such as FHIR, claims, research, genomics, or custom semantic models.

## Product intent and value

The core idea behind HDL is that healthcare data models should not remain static reference artifacts. They should become operational contracts. In HDL, a model is useful only when it can be activated, queried, mapped to data, surfaced through APIs, documented, evaluated, and reused across human and agentic workflows.

That makes HDL valuable in several ways:

- it shortens the distance between semantic modeling and working applications
- it gives teams a safe place to explore healthcare data structures on MongoDB
- it makes model-driven runtime behavior inspectable and teachable
- it provides a bridge between formal models and AI-ready operational semantics
- it creates a natural home for reusable semantic artifacts that can later be consumed by execution runtimes and copilots

HDL is therefore best understood as a healthcare-native semantic workbench and control portal, rather than as a pure ETL tool, pure query builder, or pure semantic catalog.

## Main functional areas

In its current form, HDL already includes several important product surfaces.

### Data model management

HDL supports browsing and managing healthcare data models, with openEHR as the most mature reference path. It treats models as typed, versioned assets rather than as opaque uploads. The internal data-model abstraction already spans multiple domains, including openEHR, FHIR, ContextObjects, SNOMED CT, DICOM, and custom models. This is important because it means HDL has already moved beyond a single-standard app toward a broader semantic platform.

### Mapping and transformation work

HDL includes mapping capabilities for moving from external source structures such as CDA, HL7, CSV, JSON, and other payload shapes into target healthcare models. This turns HDL into more than a passive browser. It is part of the operationalization path, where model semantics begin to influence ingestion and transformation behavior.

### Query authoring and translation

HDL contains a visual AQL builder, query management, and a lab surface for translating AQL into MQL. This matters strategically because it lets users move from formal model-aware query intent into MongoDB-native execution plans. In practice, this has been one of the key bridges between semantic healthcare models and document-database runtime execution.

### API testing and runtime interaction

HDL can test openEHR and Kehrnel-backed API endpoints directly from the application. This positions it as a working runtime companion, not just a design-time studio. Users can activate strategies, inspect generated endpoints, and run model-aware operations from the same environment where they inspect the model.

### Semantic and agentic foundations

One of the most important directions already implemented in HDL is the move from healthcare model exploration into semantic authoring for AI workflows. HDL explicitly frames ContextObjects and agentic foundations as a first-class capability: instead of letting agents improvise against raw MongoDB collections, HDL helps author governed semantic contracts that provide better meaning, clearer scope, and safer retrieval.

## HDL and Kehrnel

HDL and Kehrnel are designed to work as separate but tightly connected layers.

HDL is the portal, workbench, and control plane. It is where users inspect models, author mappings, curate semantics, and trigger operational workflows.

Kehrnel is the execution plane. It is the runtime that turns a model or strategy into something operational: validation, transform, ingest, query, maintenance, synthetic jobs, strategy operations, and model-aware APIs.

This separation is important. HDL should remain flexible, expressive, and user-facing. Kehrnel should remain stable, executable, and runtime-oriented. HDL does not need to embed all runtime logic directly, and Kehrnel does not need to become the primary authoring experience.

## HDL’s ContextObjects implementation

HDL already contains a substantial earlier implementation of the ContextObjects direction, even though that work predates the newer standalone ContextObjects repository and the more formal Context Studio specification.

In HDL, ContextObjects are currently treated as one of the supported model domains rather than as an external idea. The application already recognizes ContextObjects as custom semantic definitions built with an internal ContextObject Builder. This means that HDL has already established a practical storage and authoring model for semantic objects alongside openEHR and FHIR assets.

### What those ContextObjects represent

The HDL ContextObjects work is best understood as an early semantic-contract layer. The goal is to describe meaningful business or domain objects in a way that is more reusable and AI-ready than raw collection structure or loosely interpreted templates.

These ContextObjects are close in spirit to openEHR-derived models because the HDL team approached them through healthcare semantics first. They preserve structure, relationships, domain meaning, and retrieval relevance. But they are more than another healthcare template format. They are intended to become retrieval-aware, governance-aware semantic definitions that can support AI reasoning, deterministic resolution, and downstream runtime publication.

### The internal semantic contract model

HDL already implements a fairly rich context-contract model around these objects. A ContextObject in HDL can carry:

- semantic contract type and source of truth
- primary anchor such as patient, encounter, specimen, study, cohort, or other subject kinds
- temporal mode and assertion model
- retrieval policies including default mode, allowed modes, materialization policy, and determinism level
- terminology policy such as match mode, preferred systems, description sources, and concept expansion references
- enrichment policy such as descriptions, embeddings, and relation-aware scoring
- relation policy including parent-child, sibling, temporal, and causal reasoning
- resolution policy including clarification behavior and confidence thresholds
- governance metadata including access profile, PHI sensitivity, approval workflow, and provenance requirements
- copilot metadata such as whether the object is eligible for primary copilot use and which semantic products or answer models it supports

This is already much more than a UI schema. It is an operational semantic contract model.

### Native definition preservation and projections

A particularly important idea already present in HDL is the distinction between the native source definition and a derived projection. HDL’s copilot and semantic-framework work explicitly argues that native source hierarchies from openEHR templates or FHIR definitions must remain canonical, while any flattened or node-based representation is only a projection used for authoring, matching, enrichment, and deterministic runtime compilation.

This is a strong architectural choice. It prevents the platform from losing the original semantics of a model when preparing it for retrieval or AI use. It also provides a better foundation for reversibility, explainability, and future compilation to execution artifacts.

### Semantic enrichment already present in HDL

HDL also includes an explicit semantic authoring layer around ContextObjects. That enrichment layer covers areas such as:

- value set catalogs
- ontology sources
- matching hints
- confirmation prompts
- terminology bindings
- descriptions and synonyms
- embeddings and embedding references
- node-level confirmation policies

This shows that the HDL implementation has already gone beyond schema definition. It is building the semantic matching substrate required for robust resolution and controlled AI behavior.

### ContextObject publication to Kehrnel

Another concrete part of the implemented design is publication of authored ContextObjects into a runtime-facing catalog for Kehrnel. HDL can normalize semantic objects into a Kehrnel context catalog, capturing subject kinds, assertion types, blocks, terminology, relations, output families, retrieval policy, resolution thresholds, and raw source metadata.

This is a very important capability because it creates the seam between authoring and execution:

- HDL authors the semantic definitions
- HDL normalizes and publishes them
- Kehrnel loads them and executes deterministic runtime behavior against them

That authoring-to-runtime publication path is one of the most mature and strategically important pieces already present in HDL.

## HDL’s Copilots work

Another major implemented direction inside HDL is the Copilots Studio and its associated framework. This work is not a generic chatbot layer. It is an attempt to define how governed copilots for healthcare should be built on top of ContextObjects and Con2L.

### The core copilot philosophy

The HDL copilot framework is built around a strong principle: natural language should resolve against modeled semantics before touching raw collections. In other words, the system should not let a copilot or agent guess against database structure directly. It should first bind the request to ContextObjects, semantic products, and deterministic execution templates.

This makes the copilot work qualitatively different from many agent wrappers. It assumes that semantic modeling and runtime control are prerequisites for trustworthy answers.

### The workflow HDL has already defined

The implemented copilot framework in HDL already sketches a full authoring pipeline:

1. select source models
2. normalize them into ContextObjects and Context Maps
3. enrich the semantic layer
4. define target roles and decision profiles
5. generate and cluster question libraries
6. author expected answers and evaluation rows
7. cluster approved questions into semantic products
8. bind those products to deterministic Con2L execution
9. define answer models and proof summaries
10. run a control loop over coverage, drift, binding failures, and release readiness

This is a substantial amount of product thinking and is already much closer to a real copilot authoring platform than a typical prompt playground.

### Semantic products and answer contracts

The HDL copilot work introduces the notion that questions should cluster into semantic products with clear boundaries. Those products are then served by tools, plans, and answer models. This is a key insight: the unit of copilot design is not just a prompt template or a chain, but a governed semantic product tied to explicit retrieval and answer behavior.

In the HDL approach, each approved question should eventually have associated artifacts such as:

- an expected request shape or Con2L form
- an expected semantic product
- an expected answer model
- a human expectation summary
- must-mention and should-avoid signals
- clarification policy
- panel or UI destination

This is effectively an evaluation and answer-governance framework, not just a UX concept.

### Control plane for copilots

The existing Copilots Studio view in HDL already frames copilots as something that needs observability and quality control. It looks at metrics such as:

- how many definitions preserve native source shape
- which definitions are semantically ready
- which definitions are eligible for copilot use
- what determinism and clarification policies exist
- where gaps remain in descriptions, value sets, hints, embeddings, ontology sources, or confirmation support

This is important because it treats copilot quality as a function of semantic readiness, not only LLM quality.

## Why HDL matters strategically

HDL matters because it is already doing real integration work that many semantic platforms postpone:

- it connects source models to runtime behavior
- it connects healthcare semantics to MongoDB execution
- it connects semantic objects to deterministic retrieval
- it connects authoring workflows to agent-ready artifacts
- it connects semantic design to evaluation and governance

It is already the place where openEHR templates, ContextObjects, Kehrnel runtime activation, copilot frameworks, and model-aware query work meet.

That makes HDL the strongest existing upstream authoring and experimentation surface for the broader Context Studio vision.

## Current role in the broader architecture

Within the larger stack now emerging, HDL should be understood as:

- the healthcare-native semantic workbench
- the practical authoring surface for model-driven semantics
- the upstream producer of healthcare ContextObjects and copilot artifacts
- the place where healthcare teams test and refine vertical use cases before productizing them in a broader Context Studio

It should not be reduced to “the old openEHR demo app.” It has already evolved into a much more important role: the domain-specialized environment where healthcare semantics become reusable operational and agentic assets.
