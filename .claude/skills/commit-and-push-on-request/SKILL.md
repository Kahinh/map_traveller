---
name: commit-and-push-on-request
description: Créer un commit propre et pousser, UNIQUEMENT quand l'utilisateur le demande explicitement (« commit », « push », « fais le commit »). Ne jamais committer de sa propre initiative.
---

## Skill — commit-and-push-on-request

Use this skill only when the user explicitly asks to commit and push the work.

The assistant must never create a commit, run `git commit`, or run `git push` unless the user has expressly requested it in the current conversation.

Explicit requests include instructions such as:
- "commit and push"
- "commit puis push"
- "crée un commit"
- "push tes changements"
- "commit tout ce que tu as fait"
- "fais le commit"

Ambiguous instructions such as "finish the task", "save the work", "prepare the changes", "make it ready", or "we’re done" are not enough. In those cases, do not commit or push. Instead, summarize the changes and say that a commit can be created only if explicitly requested.

---

## Purpose

When explicitly requested, create a clean, understandable, and traceable Git commit containing only the relevant changes made for the task, then push it to the current branch.

The commit must make it clear:

- what was requested;
- what issue or requirement was addressed;
- what was changed;
- why the chosen solution was implemented;
- what the result is;
- which tests or checks were performed;
- which limitations, risks, or follow-ups remain, if any.

---

## Mandatory procedure

### 1. Confirm the request is explicit

Before doing anything, verify that the user has expressly asked for a commit and/or push.

If the request is not explicit:

- do not run `git add`;
- do not run `git commit`;
- do not run `git push`;
- do not create a commit;
- do not infer permission.

Reply with a short summary of the current state and ask the user to explicitly request a commit and push if they want one.

Acceptable response example:

```text
I will not commit or push yet because it was not explicitly requested.
If you want me to do it, please say: "commit and push".
```

### 2. Increment backend package version

Before committing, check whether the changes modify application behavior, backend code, server logic, API contracts, persistence, deployment, or any user-visible functionality.

If yes, increment `/backend/package.json` using the mandatory 4-segment version format:

~~~text
major.minor.bugfix.hotfix
~~~

Valid examples:

~~~text
Hotfix: 1.0.0.1
Bug fix: 1.0.1.0
Minor version: 1.1.0.0
Major version: 2.0.0.0
~~~

When the existing version has fewer than 4 numeric segments, normalize it to 4 segments by appending `.0` segments before incrementing. For example, `1.0.1` becomes `1.0.1.0` before applying the selected increment.

Choose exactly one increment level:

- `hotfix`: increment the 4th segment only.
- `bugfix`: increment the 3rd segment and reset the 4th segment to `0`.
- `minor`: increment the 2nd segment and reset the 3rd and 4th segments to `0`.
- `major`: increment the 1st segment and reset the 2nd, 3rd, and 4th segments to `0`.

Required increment examples:

~~~text
1.0.0.0 + hotfix => 1.0.0.1
1.0.0.1 + bugfix => 1.0.1.0
1.0.1.3 + minor => 1.1.0.0
1.1.2.4 + major => 2.0.0.0
~~~

The version must always be written back as 4 numeric segments in `/backend/package.json`. Include the updated file in the commit.

If `/backend/package.json` is incremented:

- include it in the commit;
- mention the new version in the final response.

If no version increment is needed:

- explain why briefly in the final response.

### 3. Commit Branch - MANDATORY

All commits should be done on "dev" branch