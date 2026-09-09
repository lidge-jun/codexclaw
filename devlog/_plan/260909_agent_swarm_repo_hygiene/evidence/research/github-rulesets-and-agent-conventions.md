# GitHub Rulesets & AI Coding-Agent Conventions

**Research date:** 2026-09-09
**Method:** read-only browsing. Every claim below is anchored to a page I actually opened. `docs.github.com` REST reference pages render their schema client-side, so those were read via a real browser tab (`document.body.innerText`) with all `<details>` expanded, not via plain HTTP fetch.
**Docs version banner on the pages read:** "Version: Free, Pro, & Team" unless a quote is explicitly attributed to the `enterprise-cloud@latest` variant.

---

## Part 1 — GitHub Rulesets

### Pages opened for Part 1

| # | URL | Status |
|---|---|---|
| 1 | https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets | opened |
| 2 | https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/creating-rulesets-for-a-repository | opened |
| 3 | https://docs.github.com/en/enterprise-cloud@latest/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets | opened (only place "Require merge queue" is documented as a ruleset rule) |
| 4 | https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/about-rulesets | opened |
| 5 | https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/managing-rulesets-for-a-repository | opened |
| 6 | https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/troubleshooting-rules | opened |
| 7 | https://docs.github.com/en/rest/repos/rules?apiVersion=2022-11-28 | opened in browser, `<details>` expanded |
| 8 | https://docs.github.com/en/rest/repos/repos?apiVersion=2022-11-28#update-a-repository | opened in browser, `<details>` expanded |
| 9 | https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/configuring-pull-request-merges/managing-a-merge-queue | opened |
| 10 | https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#merge_group | opened |
| 11 | https://docs.github.com/en/actions/concepts/security/github_token | opened |
| 12 | https://docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/merging-a-pull-request-with-a-merge-queue | opened |
| 13 | https://docs.github.com/en/organizations/managing-organization-settings/creating-rulesets-for-repositories-in-your-organization | opened |

Note on the API request samples: the `curl` samples on the live pages now emit `-H "X-GitHub-Api-Version: 2026-03-10"` even when you request the page with `?apiVersion=2022-11-28`. Quoted verbatim below.

---

### (a) Does "Restrict deletions" block an Actions workflow using `GITHUB_TOKEN` from deleting a NON-protected branch the ruleset does not target?

**No.** The rule is scoped by the ruleset's ref-name pattern. If the branch does not match the ruleset's targeting criteria, the rule is simply not evaluated for that ref.

Exact wording of the rule:

> ## Restrict deletions
>
> If selected, only users with bypass permissions can delete branches or tags whose name matches the pattern you specify. This rule is selected by default.

— available-rules-for-rulesets (URL #1)

The scoping is explicit, per-ruleset and per-pattern:

> For each ruleset you create, you specify which branches or tags in your repository the ruleset applies to. You can use `fnmatch` syntax to define a pattern to target specific branches and tags. For example, you could use the pattern `releases/**/*` to target all branches in your repository whose name starts with the string `releases/`.

— about-rulesets (URL #4)

> You can add multiple targeting criteria to the same ruleset. For example, you could include the default branch, include any branches matching the pattern `*feature*`, and then specifically exclude a branch matching the pattern `not-a-feature`.

— creating-rulesets-for-a-repository (URL #2)

And in the API, the targeting lives in `conditions.ref_name`:

> `include` — Array of ref names or patterns to include. One of these patterns must match for the condition to pass. Also accepts `~DEFAULT_BRANCH` to include the default branch or `~ALL` to include all branches.
>
> `exclude` — Array of ref names or patterns to exclude. The condition will not pass if any of these patterns match.

— REST rules reference (URL #7)

Layering only ever adds restriction, never removes it, and only for refs actually targeted:

> A ruleset does not have a priority. Instead, if multiple rulesets target the same branch or tag in a repository, the rules in each of these rulesets are aggregated. If the same rule is defined in different ways across the aggregated rulesets, the most restrictive version of the rule applies.

— about-rulesets (URL #4)

> The result is that creating a new ruleset can make the rules targeting a branch or tag more restrictive, but never less restrictive.

— creating-rulesets-for-repositories-in-your-organization (URL #13)

**Practical answer:** a `GITHUB_TOKEN`-authenticated workflow deleting `feature/scratch-123` is unaffected by a `Restrict deletions` rule whose ruleset targets only, say, `~DEFAULT_BRANCH` or `releases/**/*`. The `GITHUB_TOKEN` identity is irrelevant to this outcome — targeting is.

Three important caveats:

1. **`~ALL` targeting changes the answer.** A ruleset with `conditions.ref_name.include: ["~ALL"]` targets every branch, so a "non-protected" branch is no longer untargeted, and `Restrict deletions` will block the deletion unless the acting identity is a bypass actor. GitHub does not use the word "protected" as a gate for rulesets; there is no separate "protected branch" flag to satisfy. The docs treat rulesets as an independent layer:

   > Rulesets and branch protection rules can both protect branches in a repository. They work alongside each other, and all applicable rules are enforced.
   > — about-rulesets (URL #4)

2. **Push rulesets are not ref-scoped at all** (but they cannot restrict deletions — they only restrict file paths / path length / extensions / size):

   > Push rules do not require any branch targeting because they apply to every push to the repository.
   > — about-rulesets (URL #4)

3. **The token identity matters for a different reason:** if the deletion *is* blocked, the `GITHUB_TOKEN` acts as a GitHub App installation token, so any bypass has to be granted to the GitHub Actions app as an `Integration` bypass actor (see (b)).

   > When you enable GitHub Actions, GitHub installs a GitHub App on your repository. The `GITHUB_TOKEN` secret is a GitHub App installation access token.
   > — actions/concepts/security/github_token (URL #11)

---

### (b) How bypass actors are configured — and can `github-actions` be one?

#### UI: eligible bypass actors

Identical list on both the branch/tag ruleset and push ruleset sections:

> You can grant certain roles, teams, or apps bypass permissions for your ruleset. The following are eligible for bypass access:
>
> - Repository admins, organization owners, and enterprise owners
> - The maintain or write role, or custom repository roles based on the write role
> - Teams, excluding secret teams. See About organization teams.
> - GitHub Apps
> - Dependabot. For more information about Dependabot, see Dependabot quickstart guide.

— creating-rulesets-for-a-repository (URL #2)

Steps:

> 1. To grant bypass permissions for the ruleset, in the "Bypass list" section, click **Add bypass**.
> 2. In the "Add bypass" modal dialog that appears, search for the role, team, or app you would like to grant bypass permissions, then select the role, team, or app from the "Suggestions" section and click **Add Selected**.
> 3. Optionally, to grant bypass to an actor without allowing them to push directly to a repository, to the right of "Always allow," click, then click **For pull requests only**.
>
> The selected actor is now required to open a pull request to make changes to a repository, creating a clear trail of their changes in the pull request and audit log. The actor can then choose to bypass any branch protections and merge that pull request.

— creating-rulesets-for-a-repository (URL #2)

Fork-network caveat (push rulesets only):

> For push rulesets, bypass permissions apply to a repository and the repository's entire fork network. This means that the only users who can bypass this ruleset for any repository in this repository's entire fork network are the users who can bypass this ruleset in the root repository.

— available-rules-for-rulesets (URL #1)

#### API shape of `bypass_actors`

Verbatim from the "Create a repository ruleset" body-parameter schema (URL #7):

> **`actor_id`** integer or null — The ID of the actor that can bypass a ruleset. Required for Integration, RepositoryRole, Team, and User actor types. If `actor_type` is `OrganizationAdmin`, `actor_id` is ignored. If `actor_type` is `DeployKey`, this should be `null`. `OrganizationAdmin` is not applicable for personal repositories.
>
> **`actor_type`** string **Required** — The type of actor that can bypass a ruleset.
> Can be one of: `Integration`, `OrganizationAdmin`, `RepositoryRole`, `Team`, `DeployKey`, `User`
>
> **`bypass_mode`** string — When the specified actor can bypass the ruleset. `pull_request` means that an actor can only bypass rules on pull requests. `pull_request` is not applicable for the `DeployKey` actor type. Also, `pull_request` is only applicable to branch rulesets. When `bypass_mode` is `exempt`, rules will not be run for that actor and a bypass audit entry will not be created.
> Default: `always`
> Can be one of: `always`, `pull_request`, `exempt`

So, mapped to your question:

| Concept | API representation |
|---|---|
| Roles | `actor_type: "RepositoryRole"` (+ `actor_id`), and `actor_type: "OrganizationAdmin"` (id ignored) |
| Teams | `actor_type: "Team"` + `actor_id` |
| Apps | `actor_type: "Integration"` + `actor_id` (the GitHub App id) |
| Deploy keys | `actor_type: "DeployKey"`, `actor_id: null`, and `bypass_mode: "pull_request"` is **not** allowed |
| Individual users | `actor_type: "User"` + `actor_id` |

Enterprise Server 3.20's copy of the same endpoint additionally lists `EnterpriseOwner` in the enum <citation refs="BFJkOhvI9T06BgOPHjpz2">`actor_type`: required, string, enum: `Integration`, `OrganizationAdmin`, `RepositoryRole`, `Team`, `DeployKey`, `EnterpriseOwner`</citation>; the Free/Pro/Team page I read lists `User` instead of `EnterpriseOwner`. Worth checking against your own target plan.

#### Can `github-actions` be a bypass actor?

**Yes, as a GitHub App (`actor_type: "Integration"`).** The `GITHUB_TOKEN` is an installation access token for the GitHub Actions app that GitHub installs on your repo, and "GitHub Apps" are explicitly listed as eligible for bypass access.

> When you enable GitHub Actions, GitHub installs a GitHub App on your repository. The `GITHUB_TOKEN` secret is a GitHub App installation access token. You can use the installation access token to authenticate on behalf of the GitHub App installed on your repository. The token's permissions are limited to the repository that contains your workflow.

— actions/concepts/security/github_token (URL #11)

**Caveats, flagged honestly:**

- GitHub's own docs never name "GitHub Actions" as a searchable entry in the "Add bypass" dialog. The docs only say "GitHub Apps" generically. Whether the `github-actions` app appears in the Suggestions list is **UNVERIFIED from GitHub documentation** — I could not find a docs page that states it either way, and I did not test it against a live repository (read-only task). Community reports are mixed: <citation refs="dH-1WunsepDTyIZ8w9HC4">The type of actor that can bypass a ruleset. it's not possible to bypass the GitHub Actions bot. The terraform provider allows that for apps</citation>. Treat "add the built-in `github-actions` bot to the bypass list via the UI" as unconfirmed; the reliable pattern is a **custom GitHub App** whose app id you set as `actor_id` with `actor_type: "Integration"`, then mint an installation token in the workflow.
- Even a granted bypass is not honored everywhere. A currently-open GitHub docs issue reports: <citation refs="JDz6wYMC_qJSu3YKnmKWP">the bypass grant is only honored by a synchronous, direct merge call — it is not consulted by GitHub's async auto-merge completion process (`gh pr merge --auto`, `enablePullRequestAutoMerge`, or the "Merge when ready" UI button)</citation>. This is a third-party bug report, not GitHub documentation — treat as a hypothesis to test, not fact.
- Related but distinct: workflows do not chain off `GITHUB_TOKEN` writes (see (e) note and Part 2 / Claude B4).

---

### (c) REST API: creating a ruleset

#### Endpoints (all on `/repos/{owner}/{repo}`)

| Method + path | Purpose | Token permission |
|---|---|---|
| `GET /repos/{owner}/{repo}/rules/branches/{branch}` | "Returns all active rules that apply to the specified branch." | Metadata: read |
| `GET /repos/{owner}/{repo}/rulesets` | "Get all the rulesets for a repository." | Metadata: read |
| `POST /repos/{owner}/{repo}/rulesets` | "Create a ruleset for a repository." | **Administration: write** |
| `GET /repos/{owner}/{repo}/rulesets/{ruleset_id}` | "Get a ruleset for a repository." | Metadata: read |
| `PUT /repos/{owner}/{repo}/rulesets/{ruleset_id}` | "Update a ruleset for a repository." | **Administration: write** |
| `DELETE /repos/{owner}/{repo}/rulesets/{ruleset_id}` | Delete a repository ruleset | Administration: write |
| `GET /repos/{owner}/{repo}/rulesets/{ruleset_id}/history` | Get repository ruleset history | — |
| `GET /repos/{owner}/{repo}/rulesets/{ruleset_id}/versions/{version_id}` | Get repository ruleset version | — |

Note the **update verb is `PUT`, not `PATCH`** — a common trip-up. Verbatim from the page: "Request example — **PUT** `/repos/{owner}/{repo}/rulesets/{ruleset_id}`".

For create, the exact permission line is:

> The fine-grained token must have the following permission set:
> "Administration" repository permissions (write)

Response codes for create: `201 Created`, `404 Resource not found`, `422 Validation failed, or the endpoint has been spammed.`, `500 Internal Error`.

Also relevant if you script pushes:

> Additionally, push rulesets apply to the "Create a blob", "Create a tree", and "Create or update file contents" endpoints in the REST API.
> — troubleshooting-rules (URL #6)

#### GitHub's own example (verbatim from the docs page)

```bash
curl -L \
  -X POST \
  -H "Accept: application/vnd.github+json" \
  -H "Authorization: Bearer <YOUR-TOKEN>" \
  -H "X-GitHub-Api-Version: 2026-03-10" \
  https://api.github.com/repos/OWNER/REPO/rulesets \
  -d '{"name":"super cool ruleset","target":"branch","enforcement":"active","bypass_actors":[{"actor_id":234,"actor_type":"Team","bypass_mode":"always"}],"conditions":{"ref_name":{"include":["refs/heads/main","refs/heads/master"],"exclude":["refs/heads/dev*"]}},"rules":[{"type":"commit_author_email_pattern","parameters":{"operator":"contains","pattern":"github"}}]}'
```

Verbatim `201` response body from the docs:

```json
{
  "id": 42,
  "name": "super cool ruleset",
  "target": "branch",
  "source_type": "Repository",
  "source": "monalisa/my-repo",
  "enforcement": "active",
  "bypass_actors": [
    {
      "actor_id": 234,
      "actor_type": "Team",
      "bypass_mode": "always"
    }
  ],
  "conditions": {
    "ref_name": {
      "include": [
        "refs/heads/main",
        "refs/heads/master"
      ],
      "exclude": [
        "refs/heads/dev*"
      ]
    }
  },
  "rules": [
    {
      "type": "commit_author_email_pattern",
      "parameters": {
        "operator": "contains",
        "pattern": "github"
      }
    }
  ],
  "node_id": "RRS_lACkVXNlcgQB",
  "_links": {
    "self": {
      "href": "https://api.github.com/repos/monalisa/my-repo/rulesets/42"
    },
    "html": {
      "href": "https://github.com/monalisa/my-repo/rules/42"
    }
  },
  "created_at": "2023-07-15T08:43:03Z",
  "updated_at": "2023-08-23T16:29:47Z"
}
```

#### Top-level body parameters (verbatim)

> **`name`** string **Required** — The name of the ruleset.
> **`target`** string — The target of the ruleset. Default: `branch`. Can be one of: `branch`, `tag`, `push`
> **`enforcement`** string **Required** — The enforcement level of the ruleset. `evaluate` allows admins to test rules before enforcing them. Admins can view insights on the Rule Insights page (`evaluate` is only available with GitHub Enterprise). Can be one of: `disabled`, `active`, `evaluate`
> **`bypass_actors`** array of objects — The actors that can bypass the rules in this ruleset
> **`conditions`** object — Parameters for a repository ruleset ref name condition
> **`rules`** array of objects — An array of rules within the ruleset.

#### The four rule types you asked about, quoted from the schema

**`required_status_checks`**

> Choose which status checks must pass before the ref is updated. When enabled, commits must first be pushed to another ref where the checks pass.
>
> - `type` string **Required** — Value: `required_status_checks`
> - `parameters.do_not_enforce_on_create` boolean — Allow repositories and branches to be created if a check would otherwise prohibit it.
> - `parameters.required_status_checks` array of objects **Required** — Status checks that are required.
>   - `context` string **Required** — The status check context name that must be present on the commit.
>   - `integration_id` integer — The optional integration ID that this status check must originate from.
> - `parameters.strict_required_status_checks_policy` boolean **Required** — Whether pull requests targeting a matching branch must be tested with the latest code. This setting will not take effect unless at least one status check is enabled.

**`deletion`**

> Only allow users with bypass permissions to delete matching refs.
>
> - `type` string **Required** — Value: `deletion`
>
> (no `parameters` object)

**`non_fast_forward`**

> Prevent users with push access from force pushing to refs.
>
> - `type` string **Required** — Value: `non_fast_forward`
>
> (no `parameters` object)

**`pull_request`**

> Require all commits be made to a non-target branch and submitted via a pull request before they can be merged.
>
> - `type` string **Required** — Value: `pull_request`
> - `parameters.allowed_merge_methods` array of strings — Array of allowed merge methods. Allowed values include `merge`, `squash`, and `rebase`. At least one option must be enabled. Supported values are: `merge`, `squash`, `rebase`
> - `parameters.dismiss_stale_reviews_on_push` boolean **Required** — New, reviewable commits pushed will dismiss previous pull request review approvals.
> - `parameters.dismissal_restriction` object — Specify people, teams, or apps allowed to dismiss pull request reviews.
>   - `allowed_actors` array of objects — `id` integer **Required** (ID of the actor that can dismiss reviews), `type` string **Required** — Can be one of: `User`, `Team`, `IntegrationInstallation`, `RepositoryRole`
>   - `enabled` boolean **Required** — Whether to restrict review dismissal to specific actors.
> - `parameters.require_code_owner_review` boolean **Required** — Require an approving review in pull requests that modify files that have a designated code owner.
> - `parameters.require_last_push_approval` boolean **Required** — Whether the most recent reviewable push must be approved by someone other than the person who pushed it.
> - `parameters.required_approving_review_count` integer **Required** — The number of approving reviews that are required before a pull request can be merged.
> - `parameters.required_review_thread_resolution` boolean **Required** — All conversations on code must be resolved before a pull request can be merged.
> - `parameters.required_reviewers` array of objects — **Note: `required_reviewers` is in beta and subject to change.** A collection of reviewers and associated file patterns. Each reviewer has a list of file patterns which determine the files that reviewer is required to review.
>   - `file_patterns` array of strings **Required** — Array of file patterns. Pull requests which change matching files must be approved by the specified team. File patterns use `fnmatch` syntax.
>   - `minimum_approvals` integer **Required** — Minimum number of approvals required from the specified team. If set to zero, the team will be added to the pull request but approval is optional.
>   - `reviewer` object **Required** — `id` integer **Required**, `type` string **Required** — Value: `Team`

Other rule `type` values present in the same enum: `creation`, `update` (with `update_allows_fetch_and_merge`), `required_linear_history`, `merge_queue`, `required_deployments`, `required_signatures`, `commit_message_pattern`, `commit_author_email_pattern`, `committer_email_pattern`, `branch_name_pattern`, `tag_name_pattern`, `workflows`, `code_scanning`.

#### Full worked example combining all four rules you asked for

This is my composition from the schema above (GitHub's own sample only shows `commit_author_email_pattern`), so treat the *shape* as documented and the *combination* as mine:

```bash
curl -L \
  -X POST \
  -H "Accept: application/vnd.github+json" \
  -H "Authorization: Bearer <YOUR-TOKEN>" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  https://api.github.com/repos/OWNER/REPO/rulesets \
  -d @- <<'JSON'
{
  "name": "main protection",
  "target": "branch",
  "enforcement": "active",
  "bypass_actors": [
    { "actor_id": 5, "actor_type": "RepositoryRole", "bypass_mode": "pull_request" },
    { "actor_id": 123456, "actor_type": "Integration", "bypass_mode": "always" }
  ],
  "conditions": {
    "ref_name": {
      "include": ["~DEFAULT_BRANCH"],
      "exclude": []
    }
  },
  "rules": [
    { "type": "deletion" },
    { "type": "non_fast_forward" },
    {
      "type": "pull_request",
      "parameters": {
        "allowed_merge_methods": ["squash", "rebase"],
        "dismiss_stale_reviews_on_push": true,
        "require_code_owner_review": true,
        "require_last_push_approval": true,
        "required_approving_review_count": 1,
        "required_review_thread_resolution": true
      }
    },
    {
      "type": "required_status_checks",
      "parameters": {
        "do_not_enforce_on_create": false,
        "strict_required_status_checks_policy": true,
        "required_status_checks": [
          { "context": "build" },
          { "context": "test / unit", "integration_id": 15368 }
        ]
      }
    }
  ]
}
JSON
```

Notes that matter when writing this payload:

- `deletion` and `non_fast_forward` take **no** `parameters` key at all — just `{"type": "..."}`.
- Every boolean inside `pull_request.parameters` marked **Required** in the schema must be present; omitting e.g. `dismiss_stale_reviews_on_push` risks a `422`.
- `required_status_checks[].context` naming rules (from troubleshooting-rules, URL #6):
  > **Workflow**: The name format is `<job name>`.
  > **Reusable workflow**: The name format is `<job name> / <reusable job name>`.
  > **Other checks**: The name format is `<check name>`.
  > Required status checks do not take workflow, matrix, or event trigger types into account.
- `integration_id` pins the check source. Docs: "Any person or integration with write permissions to a repository can set the state of any status check in the repository, but in some cases you may only want to accept a status check from a specific GitHub App. … The app must be installed in the repository with the `statuses:write` permission, must have recently submitted a check run, and must be associated with a pre-existing required status check in the ruleset. If the status is set by any other person or integration, merging won't be allowed." (URL #1)
- `strict_required_status_checks_policy: true` == the UI's "Require branches to be up to date before merging" (the "Strict" row of the table on URL #1).

---

### (d) `PATCH /repos/{owner}/{repo}` — merge/branch behavior fields

Endpoint: `PATCH /repos/{owner}/{repo}`. Permission: `"Administration" repository permissions (write)`. Response codes: `200`, `307 Temporary Redirect`, `403`, `404`, `422`.

Verbatim body parameters relevant to merge and branch behavior:

| Field | Type | Docs wording (verbatim) | Default |
|---|---|---|---|
| `allow_squash_merge` | boolean | "Either `true` to allow squash-merging pull requests, or `false` to prevent squash-merging." | `true` |
| `allow_merge_commit` | boolean | "Either `true` to allow merging pull requests with a merge commit, or `false` to prevent merging pull requests with merge commits." | `true` |
| `allow_rebase_merge` | boolean | "Either `true` to allow rebase-merging pull requests, or `false` to prevent rebase-merging." | `true` |
| `allow_auto_merge` | boolean | "Either `true` to allow auto-merge on pull requests, or `false` to disallow auto-merge." | `false` |
| `delete_branch_on_merge` | boolean | "Either `true` to allow automatically deleting head branches when pull requests are merged, or `false` to prevent automatic deletion." | `false` |
| `allow_update_branch` | boolean | "Either `true` to always allow a pull request head branch that is behind its base branch to be updated even if it is not required to be up to date before merging, or `false` otherwise." | `false` |
| `use_squash_pr_title_as_default` | boolean | "Either `true` to allow squash-merge commits to use pull request title, or `false` to use commit message. **This property is closing down. Please use `squash_merge_commit_title` instead." | `false` |
| `squash_merge_commit_title` | string | "Required when using `squash_merge_commit_message`. The default value for a squash merge commit title: `PR_TITLE` - default to the pull request's title. `COMMIT_OR_PR_TITLE` - default to the commit's title (if only one commit) or the pull request's title (when more than one commit)." Can be one of: `PR_TITLE`, `COMMIT_OR_PR_TITLE` | — |
| `squash_merge_commit_message` | string | "The default value for a squash merge commit message: `PR_BODY` - default to the pull request's body. `COMMIT_MESSAGES` - default to the branch's commit messages. `BLANK` - default to a blank commit message." Can be one of: `PR_BODY`, `COMMIT_MESSAGES`, `BLANK` | — |
| `merge_commit_title` | string | "Required when using `merge_commit_message`. The default value for a merge commit title. `PR_TITLE` - default to the pull request's title. `MERGE_MESSAGE` - default to the classic title for a merge message (e.g., Merge pull request #123 from branch-name)." Can be one of: `PR_TITLE`, `MERGE_MESSAGE` | — |
| `merge_commit_message` | string | "The default value for a merge commit message. `PR_TITLE` - default to the pull request's title. `PR_BODY` - default to the pull request's body. `BLANK` - default to a blank commit message." Can be one of: `PR_BODY`, `PR_TITLE`, `BLANK` | — |
| `default_branch` | string | "Updates the default branch for this repository." | — |
| `has_pull_requests` | boolean | "Either `true` to allow pull requests for this repository or `false` to prevent pull requests." | `true` |
| `pull_request_creation_policy` | string | "The policy that controls who can create pull requests for this repository: `all` or `collaborators_only`." | — |
| `web_commit_signoff_required` | boolean | "Either `true` to require contributors to sign off on web-based commits, or `false` to not require contributors to sign off on web-based commits." | `false` |
| `allow_forking` | boolean | "Either `true` to allow private forks, or `false` to prevent private forks." | `false` |
| `archived` | boolean | "Whether to archive this repository. `false` will unarchive a previously archived repository." | `false` |

Two gotchas the docs state explicitly:
- `squash_merge_commit_title` is "Required when using `squash_merge_commit_message`", and `merge_commit_title` is "Required when using `merge_commit_message`" — they must be sent as pairs.
- `use_squash_pr_title_as_default` is deprecated in favor of `squash_merge_commit_title`.

Interaction with rulesets — a `pull_request.parameters.allowed_merge_methods` rule can conflict with these repo-level toggles:

> Optionally, you can require a merge type of merge, squash, or rebase. This means the targeted branches may only be merged based on the allowed type. Additionally if the repository has disabled a merge method and the ruleset required a different method, the merge will be blocked.
> — available-rules-for-rulesets (URL #1)

And `required_linear_history` has a repo-level prerequisite:

> Before you can require a linear commit history, your repository must allow squash merging or rebase merging.
> — available-rules-for-rulesets (URL #1)

**Not in `PATCH /repos`:** there is no merge-queue field on this endpoint. Merge queue is configured via a ruleset rule or branch protection (see (e)).

---

### (e) Merge queue: enabling via ruleset, and the `merge_group` event

#### Availability

> Pull request merge queues are available in any public repository owned by an organization, or in private repositories owned by organizations using GitHub Enterprise Cloud.
> — merging-a-pull-request-with-a-merge-queue (URL #12)

This is why "Require merge queue" **does not appear** on the Free/Pro/Team version of available-rules-for-rulesets (URL #1) — I enumerated its `h2` headings and the rule is absent. It appears only on the `enterprise-cloud@latest` variant (URL #3).

#### The ruleset rule (verbatim, URL #3)

> ## Require merge queue
>
> **Note**
> This rule is not available for rulesets created at the organization level. For more information about creating rulesets at the repository level, see Creating rulesets for a repository.
>
> You can require that merges must be performed with a merge queue at the repository level. For more information about merge queues, see Merging a pull request with a merge queue.
>
> ### Additional settings
>
> You can configure various settings for your merge queue rule.
>
> - **Merge method:** Method to use when merging changes from pull requests.
> - **Build concurrency:** Limit the number of queued pull requests requesting checks and workflow runs at the same time.
>   This setting controls when merge queue dispatches the `merge_group.checks_requested` webhook event, which triggers GitHub Actions workflows that are configured to run on `merge_group`. For more information, see Webhook events and payloads.
>   For example, if there are 5 pull requests added to the queue and the build concurrency setting is 3, merge queue will dispatch the `checks_requested` event for the first 3 pull requests. When it receives a result for one of those pull requests, merge queue will dispatch the event for the 4th pull request, and so on.
> - **Minimum/maximum group size:** The number of pull requests that will be merged together in a group.
> - **Wait time to meet minimum group size (minutes):** The time the merge queue will wait after the first pull request is added to the queue for the minimum group size to be met. After this time has elapsed, the minimum group size will be ignored and a smaller group will be merged.
> - **Require all queue entries to pass required checks:**
>   When this setting is enabled, each item in the merge group must pass all required checks.
>   When this setting is disabled, only the commit at the head of the merge group, i.e. the commit containing changes from all of the pull requests in the group, must pass its required checks to merge.
> - **Status check timeout (minutes):** Maximum time for a required status check to report a conclusion. After this much time has elapsed, checks that have not reported a conclusion will be assumed to have failed

**Two-line takeaway:** the rule is **repository-level only** — you cannot push merge queue down from an org ruleset.

#### The API shape (`merge_queue` rule, verbatim from URL #7)

> `merge_queue` object — Merges must be performed via a merge queue.
>
> - `type` string **Required** — Value: `merge_queue`
> - `parameters.check_response_timeout_minutes` integer **Required** — Maximum time for a required status check to report a conclusion. After this much time has elapsed, checks that have not reported a conclusion will be assumed to have failed
> - `parameters.grouping_strategy` string **Required** — When set to `ALLGREEN`, the merge commit created by merge queue for each PR in the group must pass all required checks to merge. When set to `HEADGREEN`, only the commit at the head of the merge group, i.e. the commit containing changes from all of the PRs in the group, must pass its required checks to merge. Can be one of: `ALLGREEN`, `HEADGREEN`
> - `parameters.max_entries_to_build` integer **Required** — Limit the number of queued pull requests requesting checks and workflow runs at the same time.
> - `parameters.max_entries_to_merge` integer **Required** — The maximum number of PRs that will be merged together in a group.
> - `parameters.merge_method` string **Required** — Method to use when merging changes from queued pull requests. Can be one of: `MERGE`, `SQUASH`, `REBASE`
> - `parameters.min_entries_to_merge` integer **Required** — The minimum number of PRs that will be merged together in a group.
> - `parameters.min_entries_to_merge_wait_minutes` integer **Required** — The time merge queue should wait after the first PR is added to the queue for the minimum group size to be met. After this time has elapsed, the minimum group size will be ignored and a smaller group will be merged.

Every `parameters` field is **Required** — there are no optional merge-queue params. Example rule object:

```json
{
  "type": "merge_queue",
  "parameters": {
    "merge_method": "SQUASH",
    "grouping_strategy": "ALLGREEN",
    "max_entries_to_build": 5,
    "min_entries_to_merge": 1,
    "max_entries_to_merge": 5,
    "min_entries_to_merge_wait_minutes": 5,
    "check_response_timeout_minutes": 60
  }
}
```

#### Branch-protection route (legacy but still documented)

> Repository administrators can require a merge queue by enabling the branch protection setting "Require merge queue" in the protection rules for the base branch.
> — managing-a-merge-queue (URL #9)

#### The `merge_group` event

From events-that-trigger-workflows (URL #10), verbatim:

> ## merge_group
>
> | Webhook event payload | Activity types | `GITHUB_SHA` | `GITHUB_REF` |
> | --- | --- | --- | --- |
> | `merge_group` | `checks_requested` | SHA of the merge group | Ref of the merge group |
>
> Runs your workflow when a pull request is added to a merge queue, which adds the pull request to a merge group. For more information see Merging a pull request with a merge queue.
>
> For example, you can run a workflow when the `checks_requested` activity has occurred.
>
> ```yaml
> on:
>   pull_request:
>     branches: [ "main" ]
>   merge_group:
>     types: [checks_requested]
> ```

`checks_requested` is the **only** activity type.

The wiring is mandatory, in bold in GitHub's own text:

> You **must** use the `merge_group` event to trigger your GitHub Actions workflow when a pull request is added to a merge queue.
>
> A workflow that reports a check which is required by the target branch's protections would look like this:
>
> ```yaml
> on:
>   pull_request:
>   merge_group:
> ```
> — managing-a-merge-queue (URL #9)

Third-party CI needs the temp-branch prefix instead:

> With third-party CI providers, you will need to update your CI configuration to run when a branch that begins with the special prefix `gh-readonly-queue/{base_branch}` is pushed to. These are the temporary branches that are created on your behalf by a merge queue and contain a different `sha` from the pull request.
> — managing-a-merge-queue (URL #9)

Removal reasons, verbatim:

> - Configured CI service is reporting test failures for a merge group
> - Timed out awaiting a successful CI result based off the configured timeout setting
> - User requesting a removal via the API or merge queue interface
> - Branch protection failure that could not automatically be resolved

**Ruleset interaction to watch:** if you also add a `workflows` rule, note the warning on URL #3: "Applying this rule will block direct pushes because the ruleset workflows run as part of the pull request and merge queue experience. For this reason you should not apply this rule to a ruleset that targets all branches in the repository."

---

## Part 2 — Agent conventions

### 2.1 GitHub Copilot cloud agent (formerly "coding agent")

**Naming change to be aware of:** GitHub renamed "Copilot coding agent" to **"Copilot cloud agent"**. The URLs in the brief resolve as follows:

| Requested | Result |
|---|---|
| `/copilot/concepts/agents/cloud-agent/about-cloud-agent` | opened, 200 |
| `/copilot/concepts/agents/cloud-agent/risks-and-mitigations` | opened, 200 — richest source |
| "configuring-agent-settings" | live at `/copilot/how-tos/use-copilot-agents/cloud-agent/configuring-agent-settings`, opened, 200 |
| `/copilot/how-tos/configure-custom-instructions/add-repository-instructions` | redirects to `/copilot/how-tos/copilot-on-github/customize-copilot/add-custom-instructions/add-repository-instructions` |
| `/copilot/concepts/response-customization` | redirects to `/copilot/concepts/prompting/response-customization` |
| `/copilot/reference/custom-instructions` | **404** — live page is `/copilot/reference/custom-instructions-support` |

I personally re-opened and re-read `risks-and-mitigations` and `configuring-agent-settings` to confirm the quotes below character-for-character.

#### Branch prefix

> **Limits the branch the agent can push to.** Copilot cloud agent only has the ability to push to a single branch. When the agent is triggered by mentioning @copilot on an existing pull request, Copilot has write access to the pull request's branch. In other cases, a new `copilot/` branch is created for Copilot, and the agent can only push to that branch. The agent is also subject to any branch protections and required checks for the working repository.

— https://docs.github.com/en/copilot/concepts/agents/cloud-agent/risks-and-mitigations

Also, on the same page: "**Limits the agent's credentials.** Copilot cloud agent can only perform simple push operations. It cannot directly run `git push` or other Git commands."

And: "Copilot can only work on one branch at a time and can open exactly one pull request to address each task it is assigned." — about-cloud-agent

**Prefix is `copilot/`. The full branch-name template beyond the prefix is UNVERIFIED** — no GitHub docs page states the suffix format.

#### Draft PR behavior

> **Requires human review before merging.** Draft pull requests created by Copilot cloud agent must be reviewed and merged by a human. Copilot cloud agent cannot mark its pull requests as "Ready for review" and cannot approve or merge a pull request.

— risks-and-mitigations

> Copilot will immediately open a draft pull request. Copilot will work on the task and push changes to its pull request, then add you as a reviewer when it has finished, triggering a notification.

— https://docs.github.com/en/copilot/how-tos/use-copilot-agents/cloud-agent/use-cloud-agent-on-github

Nuance: newer entry points do not always open a PR immediately — "Use the agents panel or other agents entry points on GitHub.com to have Copilot research, plan, and make code changes on a branch, then iterate before creating a pull request." (about-cloud-agent)

#### Who can approve / merge

> **Prevents the user who asked Copilot cloud agent to create a pull request from approving it.** This maintains the expected controls in the "Required approvals" rule and branch protection. See Available rules for rulesets.

— risks-and-mitigations

> If your repository requires pull request approvals, your approval of a Copilot pull request won't count toward the required number. Another reviewer must approve the pull request before it can be merged.

— https://docs.github.com/en/copilot/how-tos/copilot-on-github/use-copilot-agents/review-copilot-output

> **Requires an additional approval when a pull request isn't attributed to a person.** When Copilot cloud agent opens a pull request under its own app identity, one more approval is required before it can be merged, as long as the repository already requires at least one approval. This is enabled by default in rulesets, where administrators can turn it off, and always applies to branch protection rules.

— risks-and-mitigations

**This is the direct bridge back to Part 1.** The ruleset side of the same feature, from available-rules-for-rulesets (URL #1), which I read firsthand:

> #### Additional approval for unattributed Copilot pull requests
>
> **Require an additional approval for unattributed Copilot pull requests** is enabled by default, for both new and existing rulesets. When Copilot opens a pull request that isn't attributed to a person, the ruleset requires one more approval than the number you configured. For example, a ruleset that requires one approval requires two approvals from people with write access.
>
> Requiring one approval usually means two people are involved in a change: the person who wrote it and the person who approved it. That assumption doesn't hold when Copilot opens a pull request under its own app identity instead of on behalf of a person, for example when you prompt it from a shared context such as a group thread or channel.
>
> This setting has no effect if the ruleset requires zero approvals, so repositories that use pull requests as a record of changes rather than to gate on approvals are unaffected.
>
> If you clear this setting, these pull requests require only the number of approvals you configured. If you also require an approval from someone other than the last person to push, at least one approval must cover the last push and come from someone other than Copilot.

Trigger gate:

> Only users with write access to the repository can trigger Copilot cloud agent to work. Comments from users without write access are never presented to the agent.

— risks-and-mitigations

#### "Approve and run workflows" gate and the auto-approve setting

> **Restricts GitHub Actions workflow runs.** By default, workflows are not triggered until Copilot cloud agent's code is reviewed and a user with write access to the repository clicks the **Approve and run workflows** button. Optionally, you can configure Copilot to allow workflows to run automatically. See Review output from Copilot.

— risks-and-mitigations

The setting itself, verbatim from configuring-agent-settings (I re-read this page directly):

> **Allowing GitHub Actions workflows to run automatically when Copilot pushes**
>
> By default, GitHub Actions workflows will not run automatically when Copilot pushes changes to a pull request.
>
> GitHub Actions workflows can be privileged and have access to sensitive secrets. Inspect the proposed changes in the pull request and ensure that you are comfortable running your workflows on the pull request branch. You should be especially alert to any proposed changes in the `.github/workflows/` directory that affect workflow files.
>
> To allow GitHub Actions workflows to run, click the **Approve and run workflows** button in the pull request's merge box.
>
> Optionally, you can configure Copilot cloud agent to allow GitHub Actions workflows to run without human intervention.
>
> **Warning**
> Allowing GitHub Actions workflows to run without approval may allow unreviewed code written by Copilot to gain write access to your repository or access your GitHub Actions secrets.
>
> You must be a repository administrator to configure these settings.
>
> […] In the sidebar, under "Code, planning, and automation", click Copilot then cloud agent.
>
> In the "Actions workflow approval" section, disable the **Require approval for workflow runs** setting.

— https://docs.github.com/en/copilot/how-tos/use-copilot-agents/cloud-agent/configuring-agent-settings

So: **yes, there is an auto-approve setting.** It is repo-admin-only, lives under Settings → Copilot → Cloud agent → "Actions workflow approval", and the toggle to turn off is named **"Require approval for workflow runs"**. An **org-level equivalent is UNVERIFIED** — the org-level Copilot pages cover internet access and runners, not workflow approval.

Chained-automation note:

> **Workflows still require human approval.** An issue or pull request opened by an automation could trigger another automation. As with all Copilot cloud agent work, GitHub Actions workflows don't run on a pull request until a user with write access approves them, which prevents workflows from running automatically as part of such a chain.

— risks-and-mitigations

#### Agent identity

> Copilot cloud agent's commits are authored by Copilot, with the developer who assigned the issue or requested the change to the pull request marked as the co-author. This makes it easier to identify code generated by Copilot cloud agent and who started the task.
>
> Copilot cloud agent's commits are signed, so they appear as "Verified" on GitHub. This provides confidence that the commits were made by Copilot cloud agent and have not been altered.
>
> Session logs and audit log events are available to administrators.
>
> The commit message for each agent-authored commit includes a link to the agent session logs, for code review and auditing.

— risks-and-mitigations

The bot account name, from the API page:

> If Copilot cloud agent is enabled for the user and in the repository, the first node returned from the query will have the login value `copilot-swe-agent`.

and in the sample payload: `"assignees": ["copilot-swe-agent[bot]"],`

— https://docs.github.com/en/copilot/how-tos/use-copilot-agents/cloud-agent/use-cloud-agent-via-the-api

The exact `Co-authored-by:` trailer string is **UNVERIFIED** — docs describe the behavior but never show the trailer.

Attribution differs for automations:

> Work is attributed to the person who created the automation. Pull requests opened and code pushed by an automation are attributed to the user who created the automation. As when that user creates a pull request themselves, they can't approve it

— risks-and-mitigations

#### AGENTS.md and copilot-instructions.md

> **Agent instructions** are used by AI agents.
> You can create one or more AGENTS.md files, stored anywhere within the repository. **When Copilot is working, the nearest AGENTS.md file in the directory tree will take precedence.** For more information, see the agentsmd/agents.md repository.
> Alternatively, you can use a single CLAUDE.md or GEMINI.md file stored in the root of the repository.

> **Repository-wide custom instructions** apply to all requests made in the context of a repository. These are specified in a `copilot-instructions.md` file in the `.github` directory of the repository.

> **Path-specific custom instructions** apply to requests made in the context of files that match a specified path. These are specified in one or more `NAME.instructions.md` files within or below the `.github/instructions` directory in the repository.

> If the path you specify matches a file that Copilot is working on, and a repository-wide custom instructions file also exists, then the instructions from both files are used.

— https://docs.github.com/en/copilot/how-tos/copilot-on-github/customize-copilot/add-custom-instructions/add-repository-instructions

Full precedence order:

> Multiple types of custom instructions can apply to a request sent to Copilot. Personal instructions take the highest priority. Repository instructions come next, and then organization instructions are prioritized last. However, all sets of relevant instructions are provided to Copilot.
> The following list shows the complete order of precedence, with instructions higher in this list taking precedence over those lower in the list:
> 1. Personal instructions
> 2. Repository custom instructions:
>    - Path-specific instructions in any applicable `.github/instructions/**/*.instructions.md` file
>    - Repository-wide instructions in the `.github/copilot-instructions.md` file
>    - Agent instructions (for example, in an AGENTS.md file)
> 3. Organization custom instructions

— https://docs.github.com/en/copilot/concepts/prompting/response-customization

Which branch the instructions are read from (matters for PR review):

> When reviewing a pull request, Copilot reads repository custom instructions, agent instructions, and agent skills from the head branch (the branch with your changes), not the base branch. For example, when merging `my-feature-branch` into `main`, Copilot uses the instructions and skills in `my-feature-branch`, so you can test changes to them in the same pull request without merging them first.

— add-repository-instructions

Opt-out frontmatter:

> Optionally, to prevent the file from being used by either Copilot cloud agent or Copilot code review, add the `excludeAgent` keyword to the frontmatter block. Use either `"code-review"` or `"cloud-agent"`.

— add-repository-instructions

Support matrix line for the cloud agent:

> Copilot cloud agent — 📦 Repository-wide instructions (using the `.github/copilot-instructions.md` file). 📂 Path-specific instructions (using `.github/instructions/**/*.instructions.md` files). 🤖 Agent instructions (using AGENTS.md, CLAUDE.md or GEMINI.md files). 🏢 Organization instructions.

— https://docs.github.com/en/copilot/reference/custom-instructions-support

#### Bonus: firewall and MCP

> By default, Copilot's access to the internet is limited by a firewall.
>
> If Copilot tries to make a request which is blocked by the firewall, a warning is added to the pull request body (for new pull requests) or to a comment (for existing pull requests). The warning shows the blocked address and the command that tried to make the request.
>
> **Only applies to processes started by the agent:** The firewall only applies to processes started by the agent via its Bash tool. It does not apply to Model Context Protocol (MCP) servers or processes started in configured Copilot setup steps.
>
> **Bypass potential:** Sophisticated attacks may bypass the firewall, potentially allowing unauthorized network access and data exfiltration.

— https://docs.github.com/en/copilot/how-tos/copilot-on-github/customize-copilot/customize-the-firewall

> By default, the GitHub MCP server connects to GitHub using a specially scoped token that only has read-only access to the current repository.
>
> Copilot will use available tools autonomously, and will not ask for approval before use.
>
> By default, Copilot cloud agent does not have access to write MCP server tools.

— https://docs.github.com/en/copilot/concepts/agents/cloud-agent/mcp-and-cloud-agent

---

### 2.2 OpenAI Codex cloud

**URL change:** every `developers.openai.com/codex/*` URL now 301-redirects to `learn.chatgpt.com/docs/*`, and the doc set was reorganized:

| Requested | Live equivalent |
|---|---|
| `developers.openai.com/codex/cloud` | `learn.chatgpt.com/docs/cloud` |
| `developers.openai.com/codex/cloud/code-review` | `learn.chatgpt.com/docs/third-party/github` |
| `developers.openai.com/codex/cloud/agent-internet-access` | `learn.chatgpt.com/docs/cloud/internet-access` (original slug 404s) |
| `developers.openai.com/codex/cloud/environments` | `learn.chatgpt.com/docs/environments/cloud-environment` |
| `developers.openai.com/codex/agents-md` | `learn.chatgpt.com/docs/agent-configuration/agents-md` (original slug 404s) |

#### Branch naming

The prose docs **do not state a branch prefix**. The prefix was found as the live default of the "Branch format" field in Codex settings:

> `codex/{feature}`
>
> Example: codex/unit-tests-for-feature
>
> Tags available: {feature}, {date}, {time}

— https://chatgpt.com/codex/cloud/settings/general (live product UI, read from the "Branch format" textbox)

Corroborating examples in the docs' own session-list mockups:

> Today · acme/analytics-dashboard · codex/csv-export

> Yesterday · harbor/payments-api · codex/retry-guard

— https://learn.chatgpt.com/docs/cloud

**So: default template `codex/{feature}`, user-configurable, with `{feature}`, `{date}`, `{time}` tags.** The template is a *setting*, not a fixed convention — do not write ruleset patterns that assume `codex/` is immutable.

#### PR authorship identity — PARTIALLY UNVERIFIED

No OpenAI doc states which account authors the PR or the commits. The only verbatim identity statement found is for **review comments**:

> chatgpt-codex-connector bot reviewed 19 minutes ago

> chatgpt-codex-connector bot left a comment

— https://learn.chatgpt.com/docs/third-party/github

The docs only describe the connection:

> Start by browsing to chatgpt.com/codex , where you can connect your GitHub account so that Codex can work with the code in your repositories, and so that you can create pull requests from its work.

— http://web.archive.org/web/20251102002911/https://developers.openai.com/codex/cloud/ (archived; the live page no longer carries this sentence)

**Commit/PR authorship: UNVERIFIED.** Searched the live Set A pages, `learn.chatgpt.com/llms.txt`, the 1.79 MB full-corpus export `learn.chatgpt.com/docs/llms-full.txt` (grepped for "on your behalf", "attributed to", "authored by", "codex-connector", "creates a pull request"), archived `developers.openai.com` snapshots, `github.com/openai/codex/docs`, and the OpenAI Help Center Codex article. Nothing states it.

#### Draft PRs — UNVERIFIED in official docs

No official Codex doc mentions draft PR creation; "draft" only appears in unrelated contexts. The docs describe PR creation as a manual, user-initiated step:

> Review the summary and diff. Ask Codex to make follow-up changes, or open a pull request when the work is ready.

— https://learn.chatgpt.com/docs/cloud

> When the agent finishes, it shows its answer and a diff of any files it changed. You can open a PR or ask follow-up questions.

— https://learn.chatgpt.com/docs/environments/cloud-environment

An official screenshot on `learn.chatgpt.com/docs/cloud/internet-access` shows a `Create Pull Request` button with no draft variant. A third-party blog claims a draft option exists behind a dropdown; **treat as unofficial and unverified.**

#### AGENTS.md discovery and merging

> Codex builds an instruction chain when it starts (once per run; in the TUI this usually means once per launched session). Discovery follows this precedence order:
>
> Global scope: In your Codex home directory (defaults to ~/.codex, unless you set CODEX_HOME), Codex reads AGENTS.override.md if it exists. Otherwise, Codex reads AGENTS.md. Codex uses only the first non-empty file at this level.
>
> Project scope: Starting at the project root (typically the Git root), Codex walks down to your current working directory. If Codex cannot find a project root, it only checks the current directory. In each directory along the path, it checks for AGENTS.override.md, then AGENTS.md, then any fallback names in project_doc_fallback_filenames. Codex includes at most one file per directory.
>
> Merge order: Codex concatenates files from the root down, joining them with blank lines. Files closer to your current directory override earlier guidance because they appear later in the combined prompt.

> Codex skips empty files and stops adding files once the combined size reaches the limit defined by project_doc_max_bytes (32 KiB by default).

> Now Codex checks each directory in this order: AGENTS.override.md, AGENTS.md, TEAM_GUIDE.md, .agents.md. Filenames not on this list are ignored for instruction discovery.

— https://learn.chatgpt.com/docs/agent-configuration/agents-md

For code review specifically:

> Codex searches your repository for AGENTS.md files and follows the applicable code review rules. Add a ## Code Review Rules section to the file closest to the code the rules govern.

> Put repository-wide rules in the root AGENTS.md and service-specific rules in a nested file, such as services/experiment_reporting/AGENTS.md. Codex applies the root and more-specific guidance that covers each changed file, so unrelated changes don't have to carry service-specific context.

— https://learn.chatgpt.com/docs/third-party/github

---

### 2.3 Anthropic Claude Code GitHub Actions

**URL change:** `docs.anthropic.com/en/docs/claude-code/github-actions` now resolves to **https://code.claude.com/docs/en/github-actions**. Additional authoritative sources are the action's own repo files at `github.com/anthropics/claude-code-action`.

#### Branch naming

Default prefix:

> `branch_prefix` | The prefix to use for Claude branches (defaults to 'claude/', use 'claude-' for dash format) | No | `claude/`

— https://raw.githubusercontent.com/anthropics/claude-code-action/main/docs/usage.md

Exact template, from the action's own input definition:

> Template for branch naming. Available variables: {{prefix}}, {{entityType}}, {{entityNumber}}, {{timestamp}}, {{sha}}, {{label}}, {{description}}. {{label}} will be first label from the issue/PR, or {{entityType}} as a fallback. {{description}} will be the first 5 words of the issue/PR title in kebab-case. Default: '{{prefix}}{{entityType}}-{{entityNumber}}-{{timestamp}}'

— https://raw.githubusercontent.com/anthropics/claude-code-action/main/action.yml

Rendered example, verbatim from the push wrapper's usage comment:

> `git-push.sh origin claude/issue-123-20260304`

— https://raw.githubusercontent.com/anthropics/claude-code-action/main/scripts/git-push.sh

> **Issues**: Always creates a new branch with a timestamp

— https://raw.githubusercontent.com/anthropics/claude-code-action/main/docs/faq.md

**So: `claude/issue-123-<timestamp>` by default, from template `{{prefix}}{{entityType}}-{{entityNumber}}-{{timestamp}}`.**

#### PR authorship identity

Default bot identity:

> `bot_name` | GitHub username to use for git operations (defaults to Claude's bot name). Required with `ssh_signing_key` for verified commits | No | `claude[bot]`

> `bot_id` | GitHub user ID to use for git operations (defaults to Claude's bot ID). Required with `ssh_signing_key` for verified commits | No | `41898282`

— https://raw.githubusercontent.com/anthropics/claude-code-action/main/docs/usage.md

Which token decides the identity:

> `github_token` | Token for GitHub operations. When omitted, the Claude Code GitHub Action authenticates as the Claude GitHub App

— https://code.claude.com/docs/en/github-actions

> Comments appear as claude[bot] when the action uses its built-in authentication. However, if you provide a `github_token` in your workflow, the action will use that token's authentication instead, causing comments to appear under a different username.
>
> **Solution**: Remove `github_token` from your workflow file unless you're using a custom GitHub App.

— https://raw.githubusercontent.com/anthropics/claude-code-action/main/docs/faq.md

Signing:

> By default, commits made by Claude are unsigned. You can enable commit signing using one of two methods:

> ### Option 1: GitHub API Commit Signing (use_commit_signing)
> This uses GitHub's API to create commits, which automatically signs them as verified from the GitHub App:

> ### Option 2: SSH Signing Key (ssh_signing_key)
> This uses an SSH key to sign commits via git CLI.
> Commits will show as verified and attributed to the GitHub account that owns the signing key.

> **Note:** If both `ssh_signing_key` and `use_commit_signing` are provided, `ssh_signing_key` takes precedence.

— https://raw.githubusercontent.com/anthropics/claude-code-action/main/docs/security.md

**This matters for Part 1's `required_signatures` rule:** by default Claude's commits are unsigned and would be rejected by a ruleset requiring verified signatures. You must enable one of the two signing options.

#### Draft PRs — Claude does not create PRs at all by default

> In its default configuration, **Claude does not create pull requests automatically** when responding to `@claude` mentions. Instead:
>
> - Claude commits code changes to a new branch
> - Claude provides a **link to the GitHub PR creation page** in its response
> - **The user must click the link and create the PR themselves**, ensuring human oversight before any code is proposed for merging
>
> This design ensures that users retain full control over what pull requests are created and can review the changes before initiating the PR workflow.

— https://raw.githubusercontent.com/anthropics/claude-code-action/main/docs/security.md

> Claude doesn't create PRs by default. Instead, it pushes commits to a branch and provides a link to a pre-filled PR submission page. This approach ensures your repository's branch protection rules are still adhered to and gives you final control over PR creation.

— https://raw.githubusercontent.com/anthropics/claude-code-action/main/docs/faq.md

> - **Prepare Pull Requests**: Creates commits on a branch and links back to a prefilled PR creation page

> - **Smart Branch Handling**:
>   - When triggered on an **issue**: Always creates a new branch for the work
>   - When triggered on an **open PR**: Always pushes directly to the existing PR branch
>   - When triggered on a **closed PR**: Creates a new branch since the original is no longer active

— https://raw.githubusercontent.com/anthropics/claude-code-action/main/docs/capabilities-and-limitations.md

"Draft" appears in the docs only as something Claude **skips when reviewing**, never as a creation mode:

> Claude skips draft and closed pull requests, pull requests it judges not to need a review, such as automated or trivial ones, and pull requests that already have a comment from Claude.

— https://code.claude.com/docs/en/github-actions

**Verdict: draft-PR creation is not applicable / UNVERIFIED — Claude does not create the PR, so there is no draft flag.** Searched `action.yml` inputs, usage.md, security.md, faq.md, capabilities-and-limitations.md, configuration.md, solutions.md, custom-automations.md, experimental.md, migration-guide.md, and the code.claude.com page.

#### Workflows not triggering on GITHUB_TOKEN commits

> ### CI not running on Claude's commits
>
> * GitHub doesn't trigger workflows on commits made with the default `GITHUB_TOKEN`. If you pass `github_token: ${{ secrets.GITHUB_TOKEN }}` to the Claude Code GitHub Action, remove it so it authenticates as the Claude GitHub App, or pass a custom app token instead

— https://code.claude.com/docs/en/github-actions

> The `github-actions` user cannot trigger subsequent GitHub Actions workflows. This is a GitHub security feature to prevent infinite loops. To make this work, you need to use a Personal Access Token (PAT) instead, which will act as a regular user, or use a separate app token of your own.

— https://raw.githubusercontent.com/anthropics/claude-code-action/main/docs/faq.md

This matches GitHub's own statement (URL #11), which is the authoritative version:

> When you use the repository's `GITHUB_TOKEN` to perform tasks, events triggered by the `GITHUB_TOKEN` will not create a new workflow run, with the following exceptions:
>
> - `workflow_dispatch` and `repository_dispatch` events always create workflow runs.
> - `pull_request` events with the `opened`, `synchronize`, or `reopened` activity types: when a workflow using `GITHUB_TOKEN` creates or updates a pull request, the resulting `pull_request` event creates workflow runs in an **approval-required** state. The pull request displays a banner in the merge box, and a user with write access to the repository can start the runs by selecting **Approve workflows to run**. Other `pull_request` activity types (such as `labeled`, `edited`, or `closed`) do not create workflow runs.

— https://docs.github.com/en/actions/concepts/security/github_token

Note the button label difference: GitHub's generic Actions doc says **"Approve workflows to run"**, while the Copilot cloud agent doc says **"Approve and run workflows"**. Both were read directly; they are different strings on different surfaces.

#### CLAUDE.md / AGENTS.md

> ### Define project standards in CLAUDE.md
>
> Create a `CLAUDE.md` file in your repository root to define code style guidelines, review criteria, project-specific rules, and preferred patterns. Claude follows these guidelines when creating PRs and responding to requests.

> * Keep your `CLAUDE.md` concise, since Claude reads it on every run

— https://code.claude.com/docs/en/github-actions

Which copy is read during PR runs (a real security detail):

> When the action runs against a pull request, it restores a fixed list of Claude configuration paths from the PR base branch before starting Claude: `.claude/`, `.mcp.json`, `.claude.json`, `.gitmodules`, `.ripgreprc`, `CLAUDE.md`, `CLAUDE.local.md`, and `.husky/`. Paths in that list that do not exist on the base branch are removed, and the PR-authored versions are kept under `.claude-pr/` for reference only.

— https://raw.githubusercontent.com/anthropics/claude-code-action/main/docs/security.md

**`AGENTS.md` is not mentioned anywhere in the claude-code-action repo docs or the code.claude.com GitHub Actions page — UNVERIFIED for this surface.** Note this is the exact opposite of Copilot, which reads `CLAUDE.md` as an agent-instructions file.

---

## Cross-cutting comparison

| | Copilot cloud agent | Codex cloud | Claude Code GitHub Actions |
|---|---|---|---|
| Branch prefix | `copilot/` (fixed, docs-stated) | `codex/{feature}` (**user-configurable** default in settings) | `claude/` (`branch_prefix` input, configurable) |
| Full branch template | UNVERIFIED | `{feature}` / `{date}` / `{time}` tags | `{{prefix}}{{entityType}}-{{entityNumber}}-{{timestamp}}` → `claude/issue-123-20260304` |
| Creates the PR? | Yes, **draft**, immediately (classic flow) | User clicks "Create Pull Request" | **No** — pushes a branch, returns a prefilled PR link |
| Draft? | Yes, explicitly | UNVERIFIED (no official mention) | N/A (no PR created) |
| Commit author | Copilot; human = co-author | UNVERIFIED | `claude[bot]` (id `41898282`), or the `github_token` owner |
| Bot handle | `copilot-swe-agent` / `copilot-swe-agent[bot]` | `chatgpt-codex-connector` (review comments only) | `claude[bot]` |
| Commits signed by default? | **Yes** ("Verified") | UNVERIFIED | **No** — opt in via `use_commit_signing` or `ssh_signing_key` |
| Can it merge its own PR? | No — "cannot approve or merge a pull request"; requester's approval doesn't count | N/A | N/A |
| Workflow-run gate | "Approve and run workflows"; toggle off via repo setting "Require approval for workflow runs" | N/A | Hits the generic `GITHUB_TOKEN` no-chain rule; fix by using the Claude App or a custom app token |
| Instruction files | `.github/copilot-instructions.md`, `.github/instructions/**/*.instructions.md`, `AGENTS.md` (nearest wins), `CLAUDE.md`, `GEMINI.md` | `AGENTS.override.md` → `AGENTS.md` → fallbacks, root-down concat, 32 KiB cap | `CLAUDE.md` (restored from **base branch** on PR runs); `AGENTS.md` unsupported |

### Practical implications if you protect `main` with a ruleset while running these agents

1. **Do not set `required_signatures` blindly.** Copilot signs; Claude does not by default; Codex is UNVERIFIED. A signature rule will silently break the Claude action until you enable `use_commit_signing` or `ssh_signing_key`.
2. **`required_approving_review_count: 1` behaves as 2 for unattributed Copilot PRs** unless an admin clears "Require an additional approval for unattributed Copilot pull requests". Budget reviewers accordingly.
3. **`require_last_push_approval: true` interacts specifically with agent pushes** — per the ruleset docs, "at least one approval must cover the last push and come from someone other than Copilot."
4. **Agent branches are the thing to target, not exclude.** `Restrict deletions` on `~DEFAULT_BRANCH` will not stop cleanup automation from deleting `copilot/*`, `codex/*`, or `claude/*` branches (see Part 1a). If you want those preserved, target them explicitly.
5. **Codex's branch prefix is a user setting.** Any ruleset pattern keyed on `codex/**` can be silently defeated by a settings change; `copilot/` is the only one GitHub documents as fixed.
6. **If you enable merge queue, agents' PRs enter the same `merge_group` flow** — your CI must have `merge_group:` in `on:` or required checks will never report for queued agent PRs.

---

## Everything marked UNVERIFIED

| Item | Why |
|---|---|
| Whether the built-in `github-actions` bot appears in the ruleset "Add bypass" Suggestions list | No GitHub docs page states it either way; not tested live (read-only task). Community reports conflict. A custom GitHub App with `actor_type: "Integration"` is the documented path. |
| Whether `bypass_actors` is honored by async auto-merge completion | Only a third-party GitHub docs issue report (github/docs#45265), not GitHub documentation. |
| Copilot branch name format beyond the `copilot/` prefix | Not in any GitHub docs page read. |
| Copilot's exact `Co-authored-by:` trailer string | Behavior described, string never shown. |
| Org-level policy to auto-approve Copilot workflows | Only the repository-level "Require approval for workflow runs" setting is documented. |
| Codex cloud PR/commit authorship identity | Not stated anywhere in current or archived OpenAI docs, including the 1.79 MB full-corpus export. |
| Whether Codex creates draft PRs | No official mention. A third-party blog claims a dropdown option exists; unconfirmed. |
| Claude Code creating draft PRs | Not applicable — Claude does not create PRs by default. |
| `AGENTS.md` support in claude-code-action | Filename appears nowhere in that repo's docs or the code.claude.com GitHub Actions page. |
| `EnterpriseOwner` in `bypass_actors.actor_type` on Free/Pro/Team | The FPT page lists `User`, not `EnterpriseOwner`; `EnterpriseOwner` appears on the Enterprise Server 3.20 variant. Confirm against your own plan. |
