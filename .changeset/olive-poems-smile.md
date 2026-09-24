---
'@_linked/shape-ui': patch
---

Point the changelog generator at this repo's real org.

`.changeset/config.json` still named `linked-cm/shape-ui` as the GitHub repo,
but this package lives in `linked-fw/shape-ui`. Every commit, PR and author
link that `@changesets/changelog-github` wrote into `CHANGELOG.md` therefore
pointed at a repository that does not exist. Renaming the org makes the
generated links resolve.
