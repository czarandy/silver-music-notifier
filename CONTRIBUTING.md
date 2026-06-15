# Contributing

## Development

```bash
npm install
npm run dev        # backend (tsx watch, :3001) + Vite dev server (:5173, proxies /api)
npm run build      # bundle CLI/server (tsup) + build web (vite) into dist/
npm run typecheck
npm run lint       # eslint
npm run lint:fix   # eslint --fix
npm run format     # prettier --write .
```

A Husky `pre-commit` hook runs `lint-staged` (eslint `--fix` then prettier on
staged files) followed by `typecheck`, so commits are auto-formatted and linted.
