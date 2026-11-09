# Contributing

Thanks for helping. Small, focused pull requests are easiest to review.

## Checks

```
claude plugin validate .
claude plugin test .
```

Both run in CI. Tests live in `tests/` and mirror `hooks/`: one file per module.

## Typecheck

CI does not typecheck, because the engine's types are laid into
`.claude-plugin/types/` (ignored by git) when it loads the plugin from a folder.
Run `claude --plugin-dir .` once to get them, then:

```
npx -p typescript tsc -p .
```

## Commits

Use [Conventional Commits](https://www.conventionalcommits.org/): `feat:`,
`fix:`, `docs:`, `test:`, `refactor:`, `chore:`, `ci:`. Keep tests and docs in
the same commit as the behavior they cover.
