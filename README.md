# MongoDB Healthcare Data Lab

Healthcare Data Lab (HDL) is an interactive learning and prototyping environment for healthcare data models on MongoDB. It helps teams explore source models, map data, test queries and APIs, generate synthetic datasets, and understand how model semantics can be turned into operational capabilities.

The current reference path starts with openEHR because it is a demanding, semantics-rich model: templates, archetypes, terminology, paths, temporal structures, and clinical context all matter. HDL uses that foundation to teach and test a broader idea: healthcare data models should not remain static artifacts. They should become operational contracts that can be activated, queried, exposed through APIs, documented, evaluated, and reused by human workflows and AI agents.

## Where MongoDB Shines

- **Document Model**: Ideally suited for the hierarchical and nested nature of openEHR archetypes and templates
- **Schema Flexibility**: Accommodates the evolving nature of healthcare data models
- **Rich Query Language**: MQL (MongoDB Query Language) provides powerful capabilities for querying complex clinical data
- **Scalability**: Scales horizontally to handle growing healthcare datasets

Learn more about MongoDB [here](https://www.mongodb.com/docs/manual/).

## Features

- **Data Models**: Browse, explore and manage openEHR templates and model-derived catalogs
- **Mapping Studio**: Map from CDA, HL7, CSV, JSON, and other source structures to target healthcare models
- **Visual AQL Builder**: Construct AQL queries using an intuitive interface
- **Query Management**: Save, edit, and organize your queries
- **Lab**: Convert AQL queries to MQL (MongoDB Query Language)
- **API Testing**: Test openEHR and Kehrnel-backed API endpoints directly from the application
- **Kehrnel Strategy Runtime**: Activate model-specific strategies per environment, inspect generated endpoints, run strategy operations, and execute model-aware queries
- **ContextObjects and Agentic Foundations**: Author semantic contracts that help AI workflows reason from governed meaning instead of raw collections or improvised paths

## Kehrnel in HDL

Kehrnel is the strategy runtime that turns a healthcare data model into executable, inspectable, and reusable workflows. It exists because defining a healthcare model is not enough: teams also need a repeatable way to validate data, transform it into an operational representation, ingest it, query it, maintain it, and evolve it as requirements change. In HDL, it is used to:

- discover available strategy packs and their manifests
- activate a strategy for an HDL environment and domain
- validate, transform, ingest, and maintain model-backed data
- compile and execute queries through strategy-specific endpoints
- run operational tasks such as dictionary setup, search rebuilds, or synthetic data jobs
- expose OpenAPI/ReDoc documentation for model-aware APIs
- publish semantic/context catalogs that can support better agentic AI workflows

HDL is the control plane and educational portal. Kehrnel is the execution plane. Together they make it easier to show the full lifecycle: model, mapping, activation, API, query, operation, and semantic reuse.

Kehrnel starts with openEHR, but it is not meant to stop there. The same document-first runtime pattern can support new strategy families for FHIR, ContextObjects, synthetic data generation, semantic catalogs, natural language retrieval, semantic products, or domain-specific tooling.

## Tech Stack

- **Next.js** [App Router](https://nextjs.org/docs/app) for the framework
- **MongoDB Atlas** for the database
- **Tailwind CSS** for styling
- **Radix UI** for accessible UI components
- **Lucide React** for icons

## Project Structure

```
/src
  /app                  # Next.js App Router
    /api                # API routes
      /internal         # Internal API endpoints
      /openehr          # OpenEHR API endpoints
      /kehrnel          # Kehrnel runtime, strategy, docs, and environment endpoints
    QueryBuilder.jsx    # Main application component
    page.js             # Root page
    layout.js           # Root layout
  /components           # Reusable components
    /AQLQueryManagement # Query management components
    /LabPanel           # AQL to MQL conversion tools
    /common             # Shared UI components
    /openEhrAnalytics   # Analytics components
    /queryBuilder       # Query building interface components
    /templateManagement # Template management components
  /hooks                # Custom React hooks
    /queryBuilder       # Hooks for query building logic
  /lib                  # Utility functions
  /testData             # Test data for development
```

## Prerequisites

Before you begin, ensure you have met the following requirements:

- Node.js 16 or higher
- MongoDB Atlas account with a cluster set up
- Basic understanding of OpenEHR concepts

## Installation

1. Clone the repository
   ```bash
   git clone https://github.com/yourusername/openehr-dataLab.git
   cd openehr-dataLab
   ```

2. Install dependencies
   ```bash
   npm install
   ```

3. Create an `.env.local` file with your MongoDB connection details:
   ```
   MONGODB_URI=your_mongodb_connection_string
   DB_NAME=your_database_name
   ACCESS_MODE=external
   ```
   `ACCESS_MODE` controls deployment-wide onboarding access behavior:
   `external` forces allowlist-only access for the full deployment; `internal` follows platform policy mode.

4. If you want the ContextObjects AI assistant back, add:
   ```
   NEXT_PUBLIC_DISABLE_AI_ASSISTANT=false
   OPENAI_API_KEY=your-openai-api-key
   OPENAI_MODEL=gpt-4o-mini
   ```
   Restart the Next.js server after changing client-visible env vars such as `NEXT_PUBLIC_DISABLE_AI_ASSISTANT`.

## Run it locally

1. Start the development server:
   ```bash
   npm run dev
   ```

2. Open [http://localhost:3000](http://localhost:3000) in your browser to access the application.

## Subprojects (Deployed Separately)

This repository contains the main Healthcare Data Lab (HDL) web application.

Related components (not included in this repo):

- Platform Admin Portal: a separate Next.js app for governance/operations on `hdl_core`.
- Kehrnel runtime: a separate service HDL calls for strategy activation, job execution, query compilation, API access, OpenAPI docs, and model-aware operations (configured via `NEXT_PUBLIC_BACKEND_URL` / `NEXT_PUBLIC_KEHRNEL_AQL_ENDPOINT`).

## Demo Sherpa

Healthcare Data Lab can optionally embed the standalone `demo-sherpa` package for local onboarding and guided walkthrough work.

- production installs do not require Sherpa
- local Sherpa mode is opt-in via `ENABLE_LOCAL_SHERPA=true` and `NEXT_PUBLIC_SHERPA_ENABLED=true`
- refresh the local package with `npm run sherpa:refresh-local`
- integration notes: [`docs/demo-sherpa-integration.md`](docs/demo-sherpa-integration.md)
- package source: sibling repo `../demo-sherpa`
- workspace URLs used by Sherpa: `/workspace/...`

## Template Packs

- Export deterministic healthcare WebTemplates from template packs:
  ```bash
  npm run export:templates
  ```
- Run template snapshot + version-governance tests:
  ```bash
  npm run test:templates
  ```

## Run with Docker

Make sure to run this on the root directory.

1. To build and run with Docker:
   ```bash
   make build
   ```

2. To delete the container and image:
   ```bash
   make clean
   ```

## Common Errors

- Check that you've created an `.env.local` file with valid MongoDB connection details
- Make sure your MongoDB instance is accessible from your development environment
- Ensure you have the necessary permissions to access the specified database
- If you're seeing API errors, verify that your endpoints are correctly configured

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the [MIT License](LICENSE).
