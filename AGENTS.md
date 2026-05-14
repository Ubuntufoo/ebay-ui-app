# AGENTS

## Project Overview

TC Manager is a private trading card collection platform. The roadmap aims for management workflows with AI-powered pricing, deal discovery, and grading support.

- Three-tiered service model: Oracle (card pricing), Scout (deal hunting), and Grader (vision-based card assessment).
- Event-driven, schema-first architecture: prefer direct API queries, then escalate to LLM for complex unstructured tasks.
- Stack: Next.js + TypeScript + Supabase + Clerk + Gemini GenAI, with shadcn-ui components.

## Key Commands

- Install dependencies: npm install
- Dev server: npm run dev
- Lint: npm run lint
- Test: npm run test
- Validate env vars: npm run validate:env

## Key Files And Docs

- SPEC.md => Specifications and purpose of this project.
- PROVIDERS.md => reference for API services, LLM Providers, and Open-Source Tools.
- skills/ => directory for agentic skills, tools, and MCP server interactions.

## AI Integration Guidelines

- Gemini GenAI layer orchestrates natural language to validated JSON schemas, prioritizing intent classification.
- Treat all inputs as generic entities for modular, event-driven downstream services.
