# Yarn install --lock-only

Look like `npm install --package-lock-only`

Yarn doesn't support the feature official([issue 5738](https://github.com/yarnpkg/yarn/issues/5738)).

This is a simple implement.

NOTICE: It doesn't do anything for [resolutions](https://yarnpkg.com/lang/en/docs/selective-version-resolutions/) or [flat](https://yarnpkg.com/lang/en/docs/cli/install/#toc-yarn-install-flat)

## CLI

```
yarn global add yarn-install-lock-only
yarn-install-lock-only <module> [range]
```

# Usage

```ts
import installLockOnly from "yarn-install-lock-only";

installLockOnly(
  YARN_LOCK_PATH,
  PACKAGE_JSON_PATH,
  OUTPUT_YARN_LOCK_PATH,
  OUTPUT_PACKAGE_JSON_PATH
)("color", "latest");
```
