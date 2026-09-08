# Kehrnel

## What Kehrnel is

Kehrnel is a strategy runtime that turns data models into operational capabilities. It exists because a healthcare data model, no matter how expressive, is not enough on its own. Teams still need a repeatable way to validate data, transform it, ingest it, compile queries, execute model-aware operations, maintain derived structures, and expose stable runtime surfaces that applications and agents can call.

Kehrnel is the execution layer that provides this missing operational machinery.

It began with openEHR on MongoDB because openEHR is an excellent stress test for semantic execution. Archetypes, templates, terminology, path semantics, temporal context, and query meaning all have to survive the transition from model definition to working operational system. But Kehrnel is not intended to be only an openEHR engine. Its architecture is deliberately broader: it is designed to support multiple strategy families and multiple domain-specific execution models over time.

## Core purpose

Kehrnel exists to answer a set of practical operational questions that sit between semantics and working software:

- how does a model become a functioning API
- how does a query language compile into a MongoDB-native execution plan
- how do mappings, dictionaries, configuration, and indexes become versioned runtime artifacts
- how can different model families be operationalized without rewriting the entire platform
- how can external applications or AI systems call model-aware operations through explicit contracts rather than heuristics

Its central idea is that these concerns should be packaged as strategies with stable runtime contracts.

## Kehrnel as an execution plane

The most useful way to understand Kehrnel is as an execution plane. Upstream tools such as Healthcare Data Lab can serve as authoring and control surfaces, but Kehrnel is the layer that actually binds a chosen strategy to an environment, resolves configuration and secure bindings, and dispatches operational capabilities.

That means Kehrnel is not primarily a modeling UI, and it is not primarily a semantic authoring tool. It is a runtime system whose job is to execute model-specific behavior in a disciplined, inspectable way.

## Main capabilities

Kehrnel provides several major capability areas.

### Strategy-pack runtime

At the center of Kehrnel is the strategy-pack model. A strategy pack defines how a given model family or domain should behave operationally. This includes its manifest, capabilities, configuration, and execution logic. Kehrnel discovers these packs, validates them, and makes them activatable per environment and domain.

This allows the same runtime framework to support different families of operational logic without turning the platform into a hard-coded monolith.

### Activation and environment binding

Kehrnel supports activating a strategy for a specific environment. An activation ties together:

- environment identity
- domain
- strategy identifier
- strategy configuration
- bindings or binding references to underlying data resources

This activation model is critical because it separates generic strategy logic from environment-specific deployment details. A strategy can therefore be portable, while still being bound safely to real target systems at runtime.

### API surface for runtime workflows

Kehrnel exposes a FastAPI-based runtime surface that applications can call. This includes endpoints for:

- strategy discovery
- environment management
- activation
- capabilities inspection
- generic run execution
- compile-query operations
- query execution
- strategy-specific ops

This is the contract that external tools such as HDL use to activate strategies and perform model-aware runtime work.

### CLI workflows

Kehrnel also provides a CLI for common operational tasks, including pack validation and runtime workflows. This makes it useful not only as an HTTP service, but also as a scripting and CI tool.

### Model-aware operations

The runtime supports workflows that a persistence strategy can customize, such as:

- validation
- transformation
- ingestion
- query compilation
- query execution
- synthetic data generation
- operational maintenance

This is important because different strategies need different runtime behavior, but those behaviors should still fit into a consistent contract.

## Architectural model

The internal architecture of Kehrnel is organized around discovery, activation, and dispatch.

At a high level:

1. strategy manifests are discovered
2. a strategy is activated in an environment
3. bindings and secrets are resolved
4. a runtime capability is dispatched
5. the strategy-specific plugin executes the requested operation against MongoDB or other bound resources

This architecture allows Kehrnel to function as:

- an HTTP API service
- a Python runtime embedded in another backend
- a CLI-driven execution toolkit

The same core runtime can therefore serve interactive applications, automated jobs, and programmatic integrations.

## Kehrnel and MongoDB

Kehrnel is strongly aligned with MongoDB’s document model. This is especially visible in the openEHR work, where it operationalizes rich hierarchical models against MongoDB storage and query behavior. Rather than forcing healthcare semantics into a relational-first execution style, Kehrnel takes a document-first approach.

This makes it a good fit for:

- nested model structures
- hierarchical path semantics
- strategy-specific transformations
- query compilation to MongoDB-native plans
- model-aware APIs over MongoDB-backed operational data

## Kehrnel and Healthcare Data Lab

Kehrnel and HDL are complementary layers.

HDL is the control plane and workbench. Users inspect models, author mappings, explore semantics, and trigger or inspect runtime behavior there.

Kehrnel is the execution plane. It operationalizes strategies, compiles queries, runs ingest or transform flows, exposes APIs, and executes model-aware operations.

This separation is deliberate and healthy:

- HDL stays flexible and author-centric
- Kehrnel stays stable and runtime-centric

Kehrnel therefore should not be thought of as “the backend of HDL” in a narrow sense. It is a reusable runtime that HDL happens to call, and that other systems can also embed or invoke directly.

## ContextObjects in Kehrnel

Kehrnel has already started supporting the ContextObjects direction as part of its execution model.

### Authoring versus execution split

The current HDL-to-Kehrnel contract is explicit:

- HDL owns the authoring side
- Kehrnel owns the execution side

This is a very important boundary. It means ContextObject design can stay flexible and human-centric in HDL, while Kehrnel is responsible for the deterministic, runtime-safe handling of those authored artifacts.

### Public vocabulary

The shared vocabulary between HDL and Kehrnel in this area currently includes:

- ContextObject definitions
- Blocks
- Context Maps
- Instances
- Con2L

This gives the two systems a common language for semantic publication and execution.

### Inline and published modes

The current contract works in two modes.

In inline mode, HDL passes definitions directly in an operation payload.

In published tenant mode, HDL publishes normalized definitions into a tenant catalog collection and Kehrnel loads that catalog at runtime through its storage adapter.

This dual-mode design is strategically useful:

- inline mode is flexible for experimentation and tight authoring loops
- published mode is stronger for stable runtime deployment and multi-tenant execution

### ContextObjects runtime responsibilities

The kernel-side ContextObjects runtime is responsible for:

- normalizing published ContextObject definitions
- loading tenant catalogs
- resolving natural-language-like drafts against the modeled universe
- building executable Con2L contracts when drafts are clear enough
- compiling those contracts into deterministic Mongo plans
- summarizing Context Maps against the active definition catalog

This shows that Kehrnel is not merely storing ContextObjects. It is becoming the execution substrate for ContextObject-driven retrieval.

## Con2L in Kehrnel

Kehrnel treats Con2L as a negotiation and execution protocol rather than only a final query language. That is an important design decision.

The runtime currently frames Con2L in stages:

- `draft`: user-facing intent shape, request IR, requested points, scope hints
- `resolved`: selected ContextObject definition, confidence, matched and missing points, clarification need
- `executable`: source definition, scope, predicates, projection
- `compiled`: deterministic Mongo query plan

This staged design lets the system separate user intent, semantic resolution, and final execution. It is one of the strongest pieces of the emerging stack because it creates a disciplined path from language-like requests to deterministic operational behavior.

## Strategy families and extensibility

Kehrnel is designed to support multiple strategy families, not just one healthcare standard. Built-in strategy packs already include openEHR and other domain examples, and the architecture is intentionally meant to grow into:

- FHIR strategies
- ContextObjects-based strategies
- synthetic-data strategies
- semantic-catalog and retrieval strategies
- other domain-specific operational packs

This matters because it means Kehrnel can become the reusable runtime beneath multiple control planes and vertical products.

## Why Kehrnel matters strategically

Kehrnel matters because it solves the “last operational mile” that many semantic and modeling systems avoid. It makes models executable. It provides a stable runtime contract between semantics, data resources, and applications. It turns strategy packs into activatable, inspectable runtime surfaces instead of leaving models stranded as design artifacts.

Within the broader architecture, Kehrnel should be seen as:

- the strategy runtime
- the execution plane
- the compiler and dispatcher for model-aware operations
- the runtime host for ContextObjects and Con2L execution
- the safe seam between authoring systems and operational data

It is not only a healthcare API service. It is the operational kernel that makes model-driven systems actually work.
