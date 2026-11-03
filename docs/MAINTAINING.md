# Maintaining WattWise

The repository owner, [@rafaelsilvabr](https://github.com/rafaelsilvabr), is the current maintainer. Community contributions are reviewed through issues and pull requests. Maintainers make merge and release decisions and should explain substantial scope or architecture decisions in the relevant discussion. This project has no guaranteed support or release schedule.

## Triage and review

Confirm that a report uses the current code and includes a reproducible fictional example. Ask for missing context without requesting private household information. Check for duplicates and link related work. Suggested labels are `bug`, `enhancement`, `documentation`, `good first issue`, and `help wanted`; create them in GitHub before relying on them.

Before labeling an issue `good first issue`, add a starting file/function, reproduction steps, expected behavior, and acceptance criteria. Coordinate ownership in the issue. Feature discussions should identify a user problem and a testable result, with larger work split into reviewable changes.

Review PRs for the resulting behavior, relevant checks, backward compatibility of saved data, evidence labels, privacy, and documentation. For interface changes, request browser evidence. For advisor changes, read generated text as well as candidate-validation results. Do not require live-model execution for unrelated fixes.

## Repository settings

These are GitHub-side setup actions. The files in this repository do not enable or prove these settings:

- Enable Issues and GitHub Actions so the templates and CI can be used.
- Enable [private vulnerability reporting](https://docs.github.com/en/code-security/how-tos/report-and-fix-vulnerabilities/configure-vulnerability-reporting/configure-for-a-repository), then verify the link in `SECURITY.md` works for a reporter.
- After the first successful CI run, use a ruleset or branch protection for `main` that requires the `Checks` jobs. Add review requirements when another reviewer is available and confirm that the settings do not block legitimate maintainer work.
- Keep workflow-token permissions restricted and do not expose secrets to contribution checks.
- Set the repository description to a concise product statement, such as "Local energy planning with transparent calculations and an optional Gemma advisor." Add relevant discovery topics when ready.

Issue forms and templates become available from the default branch after they are merged. Dependabot is configured to propose monthly GitHub Actions updates. Review those updates before merging.

## CI configuration

The [workflow](../.github/workflows/ci.yml) runs `python scripts/check.py` on push to `main`, pull requests, and manual dispatch. It uses Ubuntu and Windows with Python 3.11, 3.13, and 3.14 and Node.js 24. It needs no API keys, model download, or energy hardware.

Actions are pinned to full commit SHAs, checkout does not persist credentials, and the token has read-only repository permissions. Keep these properties when modifying CI. GitHub documents [action pinning and least-privilege workflow permissions](https://docs.github.com/en/actions/security-for-github-actions/security-guides/security-hardening-for-github-actions).

If adding development tools, document where they run and how contributors can reproduce them. Keep optional live-model checks separate from the offline contribution checks.

## Preparing a release

There is no automated package publishing or deployment workflow. Before creating a release:

1. Select a reviewed commit and run the offline checks from a clean checkout.
2. Confirm the corresponding GitHub CI jobs succeeded.
3. Exercise the documented first-use, editing, protection, persistence, export, and monitoring flows in a real browser at desktop and mobile widths.
4. For changes that affect advisor behavior, run and review the relevant live-model checks, recording the model, skill hash, and limitations.
5. Update the changelog, usage instructions, and security support policy as needed. Distinguish shipped behavior from roadmap work.
6. Write release notes with changes, upgrade steps, data-format effects, checks performed, and known limitations. Tag the selected commit when the release is actually ready.

Do not publish model weights or private evaluation data with releases. Only claim compatibility and validation that have actually been checked.
