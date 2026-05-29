# Platform Adapters

This directory contains source-specific ingestion adapters.

Planned first adapters:
- `courtyard/` (Polygon)
- `beezie-base/` (Base)
- `beezie-flow/` (Flow EVM)

Each adapter should emit normalized upsert DTOs compatible with the Prisma `CollectibleListing` model.
