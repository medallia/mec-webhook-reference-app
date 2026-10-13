# Skill Evaluation Harness

This directory contains the evaluation framework for the Medallia
Distribution Webhook integration skill.

## How to Run an Evaluation

1. **Pick a scenario** from `scenarios/`. Each scenario includes a
   synthetic integrator profile, stub file layout, and prompt.

2. **Set up a multi-root workspace** in Cursor with this reference repo
   and the scenario's stub layout (or a real integrator repo).

3. **Run the skill** by sending the scenario's prompt to the AI agent.
   The agent should follow the 5-phase workflow from `SKILL.md`.

4. **Score the output** against `rubric.md`. Use `results-template.md`
   as a blank score sheet.

5. **Record scores** in `results.md` with the date, model, and scenario.

## Ship Criteria

- Average score across all scenarios: **>= 80/100**
- No individual scenario below **70/100**
- Zero recommendations to copy Terraform/Lambda/Expo for non-AWS scenarios
- At least 12/14 core obligations addressed per full-stack scenario
  (adjusted downward for server-only)

## Directory Structure

```
evaluation/
  README.md              ← this file
  rubric.md              ← 100-point scoring rubric
  results-template.md    ← blank score sheet
  results.md             ← latest evaluation results
  scenarios/
    greenfield-spring-kotlin/README.md
    partial-dotnet-flutter/README.md
    server-only-node-email/README.md
```
