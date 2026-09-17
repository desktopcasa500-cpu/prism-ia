# Prism IA — Goal

Preserve `frontend/pages/Landing.jsx` as the public landing page. Everything after the landing page must converge on one product goal: a quiet, professional AI workbench where conversation, projects, tools, code execution and artifacts live in one coherent workflow.

## Product bar

- Chat feels like a mature productivity product: light, quiet, fast, restrained icons, no decorative AI clutter.
- Codex is a real project workspace: files, model selection, execution trace, terminal output, artifact delivery and preview.
- The UI always exposes what is happening during long-running work without exposing hidden chain-of-thought. Show stages, tools, providers, outputs, errors and elapsed activity.
- Projects persist files. Agent file writes persist safely to the authenticated project.
- Agent tools are available to every configured AI provider through one normalized tool contract.
- MCP and Skills are first-class execution surfaces, not mock panels.
- Web search is a real tool when configured and never claimed when unavailable.
- Builds create real artifacts: ZIP, Java/JAR, Windows EXE and JavaScript verification/build workflows where the execution environment supports them.
- Every execution has authentication, authorization, usage reservation, timeouts, command policy and path isolation.
- The landing page is not rewritten during this product pass.

## Definition of done

A change is not considered finished because the UI looks correct. The path must also be wired end-to-end: frontend event -> API -> authorization -> orchestration -> tool/provider -> persistence/artifact -> visible result.

When a capability depends on runtime infrastructure that is unavailable in a serverless deployment, the product must surface the actual state instead of pretending the job completed.
