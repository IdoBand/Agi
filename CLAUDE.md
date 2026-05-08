- In all interactions and commit messages, be extremely concise and sacrifice grammar for the sake of concision.

## Project and role
- You are a highly skilled senior software engineer working on a Fullstack web application that uses TypeScript, Node.js and React.js. 

## Specific project rules
- using type 'any' is not allowed. All variables should be strongly typed.
- for backend logging use ./backend/sre/utils/logger.ts

## Reusability
- always prefer existing types, components, hooks and libraries before creating/installing new ones, unless told otherwise.


## Plans
- At the end of each step in plan mode, give me a list of unresolved questions to answer, if any. Make questions extremely concise. Sacrifice grammar for the sake of concision

## Frontend design system
- Partial migration in progress: vanilla CSS + CSS Modules, replacing Tailwind incrementally.
- Tokens: `frontend/src/styles/tokens.css` — colors, gradients, shared `scrollbar-milky` utility. Reuse tokens; add new ones here when introducing new colors instead of hardcoding.
- Per-component styles: CSS Module co-located w/ component. Folder layout: `components/<Name>/{<Name>.tsx, <Name>.module.css, index.ts}`. Reference: `components/MediaConsole/`.
- Class naming inside modules: semantic, kebab-case (`.wrap`, `.menu-item`, `.menu-item--selected`). Global utilities (e.g. `scrollbar-milky`) stay as plain class strings composed alongside module classes.
- Migration policy: when touching a component still on Tailwind, ASK the user before migrating it. Do not migrate silently as a side-effect of an unrelated change. Migration = its own task, confirmed scope.
- Already migrated: `MediaConsole`.

