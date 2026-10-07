---
name: ship-extension
description: Commit approved WalletChan extension changes and open a pull request targeting master. Use when asked to ship extension changes; merge only with explicit user authorization.
---

# Ship extension changes

Read the repository `AGENTS.md` before acting.

Ship extension changes by creating a branch, committing, creating a PR on origin, and merging to master only when the user explicitly authorizes the merge.

## Instructions

1. Run `git status` and `git diff --stat` to see what changed.
2. Create a new branch from the current state with a descriptive `codex/` name.
3. Stage only the relevant changed files and commit with `--no-gpg-sign` and a clear commit message.
4. Push the branch to `origin` with `-u`.
5. Create a PR on `origin` (repo: `walletchan/walletchan`) targeting `master` using `gh pr create`. Use a concise title and a body with a Summary section.
6. Stop after creating the PR unless the user explicitly authorized merging. With that authorization, merge using `gh pr merge --merge`.
7. After the PR is merged, checkout `master` and pull with `--ff-only`, preserving uncommitted local work.

## Rules
- Always use `--no-gpg-sign` for commits.
- Always create PRs on `origin` (`walletchan/walletchan`), never on upstream.
- Always target `master` as the base branch.
- If the user provides a description via $ARGUMENTS, use it for the branch name and commit message.
