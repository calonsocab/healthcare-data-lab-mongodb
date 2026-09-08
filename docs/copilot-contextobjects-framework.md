# Copilot Framework over ContextObjects and Con2L

Related standard:

- [ContextObjects Semantic Contract Standard](./contextobjects-semantic-contract-standard.md)

## Goal

Turn the HDL `Copilots` section into a practical authoring framework for governed copilots over any source data product:

`source models -> ContextObjects -> semantic layer -> roles -> question library -> semantic products -> Con2L plans -> answer models -> audit and control`

The key design rules are:

- natural language must bind to the semantic layer first and only compile to database queries through governed Con2L execution
- native source hierarchies from openEHR web templates or FHIR resource definitions must be preserved as canonical source definitions
- any flattened node model is only a derived projection for enrichment, authoring, matching, and deterministic runtime compilation

## Core Principles

1. `ContextObjects first`
   Every source model selected in HDL must map to ContextObjects, Context Maps, and uniform instances before it can participate in copilot execution.

2. `Preserve native source shape`
   If the source starts as an openEHR web template or a FHIR resource definition, the ContextObject must preserve that native structure instead of rebuilding it from a semi-flat node list.

3. `Deterministic binding`
   Natural language should resolve through ContextObjects and Con2L before touching raw collections.

4. `Semantic enrichment as infrastructure`
   Value sets, terminology bindings, descriptions, provenance metadata, match hints, ontology review support, and embeddings are not optional extras. They are part of the semantic match layer.

5. `Products before tools`
   Questions should cluster into semantic products with sharp boundaries. Tools and Con2L templates exist to serve products, not the other way around.

6. `Expected human answers are authored artifacts`
   Every approved question should store expected request shape, answer intent, proof expectations, clarification policy, and handoff route.

7. `Continuous audit`
   Coverage, unresolved demand, verifier issues, drift, and release readiness must be first-class control-plane concerns.

## Authoring Workflow

### 1. Source Selection

- Select imported source models from HDL.
- Profile available anchors, temporal fields, terminology content, and cross-source relation richness.
- Estimate which roles and question families are realistically supportable.

### 2. ContextObject Normalization

- Map each source shape into ContextObjects and Context Maps.
- Preserve native source definitions for openEHR web templates and FHIR resource definitions.
- Generate the node projection from the native shape instead of using the node list as the source of truth.
- Publish uniform instances with provenance and governance metadata.
- Mark which contexts are eligible for primary copilot use versus supporting use only.

### 3. Semantic Layer Enrichment

- Add value sets and terminology bindings.
- Add descriptions, synonyms, and local aliases.
- Add source-path metadata, matching hints, ontology review candidates, and confirmation policies.
- Add provenance, confidence, lifecycle, and update metadata.
- Add embeddings only as supportive enrichment and reranking.
- Provide an ontology-style confirmation surface when ambiguity remains.

### 4. Role Design

- Define target roles and their decisions.
- Capture scope, access profile, acceptable clarification behavior, and expected proof style.

### 5. Question Factory

- Let an LLM inspect model richness and role needs.
- Generate question families and a variable question count per role.
- Store coverage rationale, ambiguity risk, and candidate product families.

### 6. Evaluation Factory

For every approved question, store:

- expected Request IR / Con2L shape
- expected semantic product
- expected answer model
- human expectation summary
- must mention / should avoid signals
- clarification policy
- panel destination

### 7. Semantic Product Factory

- Cluster approved questions into products.
- Define product boundaries, required ContextObjects, supported scopes, and allowed parameters.
- Keep products stable even when many question phrasings map to them.

### 8. Con2L Binding

- Bind each product to deterministic Con2L templates.
- Add guardrails, clarification rules, and execution limits.
- Compile only from approved semantic products and context contracts.

### 9. Answer Models

- Define narrative lead, tone, widget types, proof summary, and handoff route.
- Support product-specific softening rules for uncertainty and historical reasoning.

### 10. Control Plane

- coverage by family, role, and product
- binding failures and clarification hotspots
- verifier issues and proof coverage
- unresolved demand clusters
- release gates by product family

## Artifact Model

HDL should author and eventually publish these governed artifacts:

- `source inventory`
- `preserved native definitions`
- `document-model semantic contracts`
- `ContextObject definitions`
- `ContextObject node projections`
- `Context Maps`
- `instance recipes`
- `semantic catalog`
- `value sets`
- `terminology descriptions`
- `matching metadata`
- `embedding metadata`
- `role catalog`
- `question library`
- `semantic products`
- `Con2L templates`
- `answer models`
- `evaluation library`
- `capability backlog`
- `release gates`

## Ambiguity Handling

When confidence is high, compile directly.

When multiple concepts are plausible, show the closest ontology or context matches and ask for confirmation.

When missing anchor or scope would widen the query unsafely, clarify before query.

## Recommended Next Build Slices

### Slice 1

Build the practical framework surface in HDL `Copilots`:

- workflow stages
- semantic enrichment layer
- ambiguity policies
- artifact model
- control-loop model

### Slice 2

Add authoring registries and editors for:

- roles
- question library
- semantic products
- answer models
- evaluation rows

### Slice 3

Bind copilot products to ContextObjects and Con2L templates directly.

### Slice 4

Add a dynamic control plane over authored artifacts and runtime observations.

## First Vertical

Use one narrow healthcare slice first:

- appointments
- reports
- imaging
- optional FHIR timeline

Suggested initial roles:

- clinician
- scheduling manager
- operations lead

Suggested initial products:

- diagnostic risk summary
- BI-RADS distribution
- follow-up worklist
- protocol guidance
