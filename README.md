# Value Flows on AT Protocol

A bridge connecting the Value Flows economic network vocabulary to the AT Protocol ecosystem.

## Overview

Value Flows provides a vocabulary for describing economic flows of value across networks. This project ports the existing GraphQL schemas to AT Protocol lexicons, enabling Value Flows data to live within the decentralized AT Protocol ecosystem.

## Why AT Protocol?

AT Protocol offers several key advantages for decentralized economic networks:

- **Decentralized architecture** - No central points of control or failure
- **Horizontal scalability** - Designed to scale across many servers
- **User data portability** - Users own and can move their data
- **Censorship resistance** - Content can't be easily removed by intermediaries

## Current Status

We've completed the initial translation of Value Flows GraphQL schemas to AT Protocol lexicons. The next phase involves:

1. **Deploying an App View** - Indexes and aggregates Value Flows data on AT Protocol
2. **Serving a GraphQL API** - Provides client access to the indexed data
3. **Automating schema-to-network deployment** - Leveraging community tooling for rapid iteration

## Leveraging Community Tools

The AT Protocol community is developing tools that make this integration particularly elegant:

- **Quickslice / HappyView** - Generate app views directly from schemas
- **Benefits**:
  - Close the loop between schema definition and full network deployment
  - Enable custom VF extensions simply by forking and extending schemas
  - Auto-generate GraphQL APIs from uploaded schemas

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

This is a high-priority project, and I'm eager to move quickly. If you're interested in:

- Protocol design
- Decentralized systems
- Economic network vocabularies
- Kubernetes/DevOps
- P2P architectures

Let's connect. I'm available for calls to discuss architecture, contributions, or collaboration.

My contact: https://bsky.app/profile/ruzgarimski.bsky.social

## Quick Start

```bash
# Clone the repository
git clone https://github.com/interplaynetary/value-flows.git

# Explore the lexicons
cd value-flows/lexicons
# (Lexicon definitions here)
```

## Current Tasks

- [ ] Translate GraphQL schemas to AT Protocol lexicons
- [ ] Deploy initial app view (Quickslice/HappyView)
- [ ] Implement GraphQL API layer (perhaps in (Quickslice/HappyView))
- [ ] Deploy App-views to Kubernetes cluster
- [ ] Document extension patterns for custom VF schemas
