# ContextObjects Semantic Contract Standard

## Status

Draft v1 for the Healthcare Data Lab `ContextObjects` builder and runtime.

This document defines what a `ContextObject` means when it is used as a semantic contract over a data product, document model, or source model.

It is intentionally more general than:

- `natural language -> AQL`
- `NLP -> query builder`
- `openEHR-only retrieval`

The target abstraction is:

`intent -> semantic contract -> source binding -> execution binding -> executable plan`

AQL is one renderer, not the standard itself.

## Why This Exists

Data products are often hierarchical, temporal, terminology-heavy, and operationally heterogeneous. We need a stable semantic layer that:

- preserves canonical source definitions such as openEHR OPT / webtemplate or FHIR structure definitions
- expresses what a document model means operationally
- supports multiple execution backends
- allows deterministic, validated compilation into executable plans
- separates meaning from storage shape and from query-language syntax

`ContextObjects` are the place where HDL authors this governed semantic layer.

## Three Layers

### 1. Data-Product Semantic Contract

This is the top-level meaning of the `ContextObject` as a semantic data product.

It defines:

- what subject or anchor the object is about
- what domain focus it captures
- what result shape it can support
- what kinds of operations it is allowed to support
- what sources are canonical
- what execution targets are allowed

This is part of the `ContextObject` definition itself.

### 2. Derived Retrieval Contracts

These are operational semantic contracts derived from the source model and the data-product contract.

Examples:

- numeric threshold
- numeric range
- coded equality
- latest event
- aggregate average
- policy abstraction

These are still semantic contracts, but narrower and executable after validation.

They are not the same thing as the document-model contract.

### 3. Execution Bindings

Execution bindings render validated retrieval contracts into operational plans.

Examples:

- openEHR AQL
- MongoDB MQL
- FHIR search
- SQL
- graph traversal
- Kehrnel service or strategy invocation
- materialized view lookup

Execution bindings must preserve the meaning of the validated contract. They must not redefine it.

## Canonical Pipeline

The canonical build pipeline is:

`source model`
`-> preserved native definition`
`-> ContextObject data-product semantic contract`
`-> semantic units`
`-> terminology surface`
`-> derived retrieval contracts`
`-> query shapes and supervision artifacts`
`-> runtime resolution`
`-> validated execution binding`
`-> executable plan`

For openEHR:

`OPT / webtemplate`
`-> source template catalog`
`-> semantic units`
`-> terminology surface`
`-> contract catalog`
`-> query shape library`
`-> resolver`
`-> bound contract`
`-> deterministic AQL`
`-> AQL-to-MQL compiler`
`-> MongoDB execution`

The semi-flattened MongoDB model is an operational storage and indexing target only. It is not the semantic source of truth.

## Standard Principles

1. `Meaning before execution`
   The semantic contract must exist before any query language or database renderer is chosen.

2. `Native source preservation`
   If the source enters as openEHR or FHIR, the native source definition remains canonical.

3. `No semantic leakage from storage`
   Storage flattening, reversed paths, denormalized labels, and index shortcuts must not define the contract.

4. `Contracts are target-agnostic`
   The semantic contract must be valid even if AQL disappears tomorrow and a different renderer is used.

5. `Execution is validated, not improvised`
   Runtime systems may help retrieve and rank candidates, but executable plans must be emitted only from validated contracts.

6. `Clinical abstractions are explicit`
   Policy terms such as `fever`, `binge drinking`, or `high alcohol use` must be authored and versioned. They must not be invented at runtime.

7. `Version everything`
   Semantic contracts, retrieval contracts, and execution bindings must all be versioned independently.

## ContextObject Metadata Shape

The `ContextObject` metadata should contain a top-level `contextContract`, with a `semanticContract` section that captures data-product semantics.

Recommended minimum shape:

```json
{
  "metadata": {
    "contextContract": {
      "semanticContract": {
        "standardVersion": "contextobjects.semantic_contract.v1",
        "contractType": "data_product",
        "subject": "patient",
        "focus": "alcohol_use",
        "intent": "Represents alcohol use observations and related context for deterministic retrieval and downstream semantic products.",
        "resultShape": "document",
        "executionTargets": ["aql", "mql"],
        "sourceOfTruth": "native_definition"
      }
    }
  }
}
```

### Required Fields

- `standardVersion`
- `contractType`
- `subject`
- `focus`
- `resultShape`
- `sourceOfTruth`

### Recommended Fields

- `intent`
- `executionTargets`

## Contract Types

Allowed `semanticContract.contractType` values should include:

- `document_model`
- `building_block`
- `atomic`
- `aggregate`
- `composite`
- `policy`
- `workflow`

Interpretation:

- `data_product`
  The `ContextObject` stabilizes the meaning of a general source data product.
- `document_model`
  The `ContextObject` stabilizes the meaning of a whole document or document submodel.
- `building_block`
  A reusable semantic component, not a primary retrieval surface by itself.
- `atomic`
  A narrow, directly grounded semantic object.
- `aggregate`
  A semantic object whose natural outputs are aggregates, trends, or distributions.
- `composite`
  A semantic object that composes several grounded surfaces under one governed meaning.
- `policy`
  An explicitly curated clinical or business abstraction.
- `workflow`
  A semantic object whose operationalization may produce actions or service calls, not only data retrieval.

## Result Shapes

Allowed `semanticContract.resultShape` values should include:

- `document`
- `document_set`
- `timeline`
- `patient_set`
- `population_set`
- `evidence_bundle`
- `building_block`
- `workflow_output`

This field tells the runtime what kind of operational output is semantically appropriate before any execution target is chosen.

## Source of Truth

Allowed `semanticContract.sourceOfTruth` values:

- `native_definition`
- `node_projection`
- `mixed`

Rules:

- openEHR and FHIR imports should default to `native_definition`
- reusable HDL-only blocks may use `node_projection`
- `mixed` should be rare and justified

## Separation From Retrieval Contracts

The data-product semantic contract is not the same thing as a retrieval contract.

Example:

- `ContextObject semantic contract`
  `Alcohol use document model for patient-centered temporal retrieval`

- `Derived retrieval contracts`
  - `Average Use Frequency threshold`
  - `Average Use Frequency range`
  - `Standard Drinks latest event`
  - `Alcohol use documented exists`

The semantic contract defines the operational meaning space of the data product.
The retrieval contracts define executable sub-operations inside that space.

## Separation From Execution Bindings

Execution bindings must live below the contract layer.

Example:

- `retrieval contract`
  `Average Use Frequency threshold`

- `execution binding: openEHR`
  render to deterministic AQL

- `execution binding: Mongo`
  compile AQL to MQL or render directly where appropriate

- `execution binding: Kehrnel`
  invoke service/strategy with typed parameters

No execution binding may change:

- subject
- focus
- operator meaning
- time semantics
- unit semantics
- result shape

## Validation Rules

Validation must happen at two levels.

### 1. Semantic Contract Validation

Validate:

- required fields present
- source-of-truth policy valid
- result shape valid for contract type
- execution targets allowed by governance
- anchor and focus are coherent

### 2. Retrieval Contract Validation

Validate:

- contract exists
- semantic unit exists
- operator compatible with value kind
- units compatible with semantic unit
- coded options allowed
- time path exists when required
- policy contract approved when applicable

Validation failure must never produce an executable plan.

## Governance Rules

1. Low-confidence resolution must not auto-execute.
2. Policy abstractions must be explicitly authored.
3. Every execution binding must be benchmarked.
4. Provenance must survive from source contract to execution plan.
5. Query-language renderers are replaceable; semantic contracts are not.

## Current HDL Mapping

Current implementation already has most of the scaffold:

- `metadata.contextContract`
  top-level operational policy for ContextObjects
- `semantic units`
  grounded queryable surfaces derived from openEHR templates
- `terminology surface`
  matchable terminology and alias material
- `contract catalog`
  derived retrieval contracts
- `query shape library`
  natural-language acceleration artifacts
- `resolver`
  deterministic candidate selection and validation
- `contract-to-AQL`
  current first execution binding

The next step is to explicitly treat `metadata.contextContract.semanticContract` as the data-product semantic contract that sits above the retrieval contract catalog.

## Immediate Authoring Guidance

When authoring a new `ContextObject`, the builder should capture:

1. what data product, document, or submodel this object semantically represents
2. who or what it is about
3. what output shapes it is expected to support
4. what execution targets it may bind to
5. whether the canonical source is native or projected

This should happen before query-shape generation or resolver tuning.

## Non-Goals

This standard does not define:

- a single NLP strategy
- a single database query language
- a single ontology or terminology system
- a replacement for openEHR or FHIR source definitions

It defines the governed semantic layer that sits between source models, semantic data products, and executable operational plans.
