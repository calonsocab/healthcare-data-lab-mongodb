# MongoDB Agentic Memory Core

## What MongoDB Agentic Memory Core is

MongoDB Agentic Memory Core is a headless memory engine for AI agents. It provides persistent memory storage, retrieval, extraction, and context-management capabilities that can be embedded into other applications and services.

Its purpose is to give agentic systems a serious memory substrate rather than relying on ad hoc prompt stuffing, ephemeral chat history, or application-specific hacks. It is framework-agnostic by design, meaning it is not tied to a specific API framework, web stack, or orchestration system.

The project consists of two main parts:

- `mongomem_core`, the memory engine and domain logic
- `mongomem_worker`, the background worker layer for embeddings, extraction, learning, maintenance, and snapshot processing

Together they form a reusable memory platform for persistent, retrieval-aware, auditable agent memory on MongoDB.

## Core problem it solves

Most agent systems lack a durable, structured memory model. They may store transcripts, but they do not manage different kinds of memory cleanly. They often cannot distinguish between short-lived conversational context, long-term facts, procedural know-how, user preferences, or summarized internal state. They also often lack good approval workflows, provenance, ranking, or operational observability.

MongoDB Agentic Memory Core addresses this by treating memory as a first-class operational domain. It provides:

- typed memory models
- retrieval pipelines
- context building
- extraction workflows
- vector and search integration
- approval and review workflows
- observability
- worker-backed maintenance and enrichment

It is therefore much more than a “chat history store.” It is a memory system for serious agent applications.

## Main architectural components

### `mongomem_core`

The core engine contains the main domain logic. It is responsible for:

- storage and bootstrap helpers
- memory models and CRUD operations
- temporal knowledge graph support
- retrieval orchestration
- extraction pipelines
- higher-level memory workflows

This layer is what another application embeds when it wants to give agents persistent memory behavior.

### `mongomem_worker`

The worker layer handles asynchronous and background tasks. It provides:

- MongoDB-backed task queues
- background embedding generation
- entity and fact extraction
- maintenance jobs
- snapshot handling
- scheduled task support
- change-stream processing

This lets the system move heavier or deferred memory work out of the synchronous request path.

## Memory model

One of the most important qualities of the project is that it treats memory as multiple distinct kinds rather than one undifferentiated store.

### Short-term memory

Short-term memory stores individual conversation turns and recent operational messages. This is the most immediate layer of agent context and is useful for current-session continuity.

### Internal state

Internal state supports an Internal Working Memory style where the agent maintains a compact belief state rather than endlessly accumulating conversation turns. This enables constant-size context for long-horizon agents and is especially useful when token efficiency matters.

### Snapshots

Snapshots consolidate short-term memory into summarized or grouped chunks that remain retrievable and auditable. They provide a middle layer between transient conversation history and durable long-term memory.

### Semantic memory

Semantic memory stores facts, knowledge, definitions, and reusable conceptual information. This is the layer most relevant to long-term knowledge about domains, entities, products, policies, or learned facts.

### Episodic memory

Episodic memory stores event-like experiences, such as summaries of interactions, decisions, or important moments in a workflow.

### Procedural memory

Procedural memory stores reusable procedures or task knowledge that agents can discover and follow. This makes the system useful not only for recall, but also for repeatable agent behavior and skills.

### User context and preferences

The engine also supports user-context and preference memory, allowing personalization and continuity across sessions or workflows.

## Memory operating modes

The engine supports three high-level operating modes:

- Traditional mode, where context is built from short-term memory, snapshots, and long-term memory
- IWM mode, where the agent maintains a compact internal state plus long-term memory
- Hybrid mode, which combines both patterns

This is a very practical design. It recognizes that not every agent deployment has the same latency, cost, or reasoning constraints.

## Retrieval and context building

Another major strength of the project is that it does not stop at storing memories. It provides a retrieval and context-building pipeline that decides what to bring back for a given query or task.

The retrieval side includes:

- multi-source retrieval
- ranking
- token budgeting
- formatting for downstream model use

This orchestration makes the engine useful as a true runtime memory component. An application can ask it to build usable context rather than manually retrieving and formatting chunks itself.

## Temporal Knowledge Graph

The project includes a Temporal Knowledge Graph dimension with collections for entities, entity profiles, edges, facts, archived facts, and search support. This is significant because it extends the memory platform from chunk-based storage into a more structured entity-and-fact layer.

That means the system can support not only memory recall, but also richer modeling of:

- who or what the agent knows about
- relationships between entities
- evolving facts over time
- provenance from snapshots and prior interactions

This makes the project especially relevant for more advanced agentic systems and enterprise knowledge scenarios.

## Search, vector, and Atlas alignment

The engine is deeply aligned with MongoDB Atlas capabilities. It includes support for:

- standard indexed storage
- Atlas Search
- vector search
- hybrid retrieval patterns

This is strategically useful because it allows lexical, semantic, and structured retrieval to live in one data platform rather than being split across many services.

## Approval workflow

One of the most valuable enterprise features in the project is its approval workflow for memory extraction.

By default, extractions can be persisted automatically. But the project also supports a manual approval mode in which extracted candidate memories are staged in a pending store for review before they are committed to the persistent memory database.

This matters for several reasons:

- it supports human review of high-value or sensitive extracted memories
- it creates a cleaner governance story for agentic memory
- it allows rejection, approval, unpublish, and restage flows
- it preserves auditability

In practical terms, this makes the project much more suitable for regulated, enterprise, or high-stakes deployments than a simple auto-write memory system.

## Observability and operations

The project supports pluggable observability backends. This allows metrics, events, and traces to be emitted to logging, OpenTelemetry, or custom observability systems.

This operational layer is important because memory systems can otherwise become opaque. Here, teams can monitor things like:

- internal state token counts
- approval queue behavior
- extraction activity
- retrieval behavior
- worker operations

That gives the memory engine a serious production story.

## Why the project matters in a larger stack

MongoDB Agentic Memory Core is not only useful as a generic memory service. In the broader architecture emerging around ContextObjects, HDL, and Kehrnel, it provides exactly the missing stateful substrate for agentic workflows.

In that broader context, the project can serve as the place to store and retrieve:

- semantic memories about concepts, products, and policies
- episodic traces of prior interactions and clarifications
- procedural recipes for repeatable operations
- snapshots of important agent conversations or decision paths
- internal state for long-horizon copilots
- agent profiles and user-specific context

This makes it a strong candidate for the memory and feedback layer beneath semantic retrieval and copilot systems.

## Relevance to ContextObjects and copilot systems

The project is especially relevant when paired with semantic systems such as ContextObjects and Con2L.

Those systems are responsible for deciding what a request means and compiling it into deterministic execution. MongoDB Agentic Memory Core can then augment that process with durable agentic state such as:

- prior confirmed disambiguations
- semantic memories about domain concepts
- reusable procedures for known workflows
- episodic traces of earlier case handling
- approved or rejected extraction outcomes
- personalized user context

This is the right division of labor:

- semantic systems decide what a request means
- execution systems run the plan
- memory systems preserve what the agent should remember across time

The project therefore fits very naturally beneath copilot and agentic control planes.

## Strategic role

Within a broader product architecture, MongoDB Agentic Memory Core should be seen as:

- the memory substrate for agents
- the persistent context layer
- the approval-aware extraction and recall system
- the stateful feedback layer for long-running copilots
- the retrieval-aware memory platform aligned with MongoDB Atlas

It is not merely a vector store wrapper and not merely a transcript store. It is an attempt to define a proper memory operating system for agentic applications on MongoDB.
