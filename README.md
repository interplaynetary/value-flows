# Economic Networks on AT protocols

`Xorganizing` > expressing and experimenting with organization

This repo is a platform for building, experimenting with, and deploying decentralized economic/organizational structures on the AT Protocol.

## Overview

This repository `xorganizing` is an experimental playground for organizational/economic architectures. It leverages the AT Protocol's decentralized, portable data model to express complex economic and social relationships.

The repository hosts several core vocabularies and experiments:

- **ValueFlows**: Economic network vocabulary for describing resource flows.
- **Playnet**: Economic network vocabulary for matching/allocation.
- **NGSI-LD**: Bridging IoT and context information models to AT Protocol.
- **...and more**: Designed for extensibility and rapid prototyping of new organizational "languages".

## Why AT Protocol?

AT Protocol offers several key advantages for decentralized economic networks:

- **Decentralized architecture** - No central points of control or failure
- **Horizontal scalability** - Designed to scale across many servers
- **User data portability** - Users own and can move their data
- **Censorship resistance** - Content can't be easily removed by intermediaries

## Leveraging Community Tools

The AT Protocol community is developing tools that make this integration particularly elegant:

- **HappyView** - Generate app views directly from schemas
- **Benefits**:
  - Close the loop between schema definition and full network deployment
  - Enable custom VF extensions simply by forking and extending schemas
  - Auto-generate XRPC endpoints from uploaded schemas

## Automated Collaborative Workflows

This repository is built for collaboration and automation. We've developed a suite of workflows in [`/scripts`](/scripts) to streamline the lifecycle of AT Protocol development:

- **Lexicon Auto-generation**: Tools like `json-ld-lex-gen.ts` and `lex-query-lex-gen.ts` automatically generate AT Protocol lexicons from higher-level definitions (like JSON-LD or GraphQL).
- **Automated Deployment**: [`upload-lexicons.ts`](/scripts/upload-lexicons.ts) handles the process of pushing schemas to the network.
- **Intelligent Documentation**: Docs are treated as data. The pipeline automatically generates documentation in [`/docs`](/docs) from the resulting lexicons in [`/lexicons`](/lexicons).
- **Query & Index Generation**: Automated generation of xRPC queries and database indexes to power app views.

## Project Structure

- **[`/lexicons`](/lexicons)**: The source of truth for the network's data model (ValueFlows, Playnet, etc.).
- **[`/specs`](/specs)**: Original specifications and bridge definitions (e.g., NGSI-LD, ValueFlows).
- **[`/scripts`](/scripts)**: The automation engine for generation, deployment, and indexing.
- **[`/docs`](/docs)**: Auto-generated and curated documentation.
  - **[`docs/at-proto/specs`](/docs/at-proto/specs)**: Detailed AT Protocol technical specifications.
- **[`/tests`](/tests)**: Verification suites for lexicons and xRPC integrations.

## Infrastructure Strategy

### Phase 1: Piggyback on Bluesky

We can deploy immediately by leveraging existing infrastructure:

- Bluesky's PDS (Personal Data Server) instances
- Relay infrastructure
- Existing network effects

### Phase 2: Gradual Migration

As we scale, we can migrate to our own infrastructure while maintaining compatibility, thanks to AT Protocol's portable user data.

### Phase 3: Global Scale

Our Kubernetes cluster is ready to deploy app views globally with:

- Minimal latency through geographic distribution
- Self-healing infrastructure
- Automatic scaling

We can also define Kubernetes deployment with Guix for reproducible infrastructure as code. Giving anyone ability to deploy their own VF network at scale with ease.

## Getting Involved

We are moving fast and experiment openly. If you are interested in protocol design, decentralized economics, or the future of digital organization, join us.

**Contact**: [ruzgarimski.bsky.social](https://bsky.app/profile/ruzgarimski.bsky.social)

## Quick Start

```bash
# Clone the repository
git clone https://github.com/interplaynetary/value-flows.git

# Explore the automation scripts
ls scripts/

# View the auto-generated docs
https://interplaynetary.github.io/protocols
```

## Current Tasks

- [x] Translate TTL -> JSON-LD schemas to AT Protocol lexicons
- [x] Deploy initial app view (HappyView)
- [ ] Implement GraphQL API layer (perhaps in (HappyView))
- [ ] Deploy App-views to Kubernetes cluster
- [/] Document extension patterns for custom schemas

---

## Auto-Generate & Deploy Docs to GitHub Pages

Documentation is automatically managed via GitHub Actions.

- Enable GitHub Pages (One-Time)
- In your repo:
  **Settings → Pages**
  - Source: Deploy from a branch
  - Branch: gh-pages
  - Folder: / (root)
