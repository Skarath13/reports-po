# UI source attribution

`src/components/ui/{button,input,badge,table,sheet,skeleton}.jsx` is adapted from
[shadcn/ui](https://github.com/shadcn-ui/ui/tree/7c9eaba1c0a6404c990c144a654792e3313c650d/apps/v4/registry/new-york-v4/ui),
commit `7c9eaba1c0a6404c990c144a654792e3313c650d`.
The original MIT license is retained in `shadcn-ui.md` and shipped as
`public/shadcn-ui-license.txt`. Vite also emits `dependency-licenses.txt` for
bundled npm dependencies; the built JavaScript references both notices.

Adaptations: TypeScript removed for this JavaScript project; `cn` resolves to our
local clsx/tailwind-merge utility; sheet focus targets use a comfortable button
size. Other visual composition and report components are local implementation.
Studio Admin and tablecn informed the design; their application code was not
copied. Dependency licenses remain in the installed packages.
