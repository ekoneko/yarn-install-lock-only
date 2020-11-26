import meow from "meow";
import * as path from "path";
import install from "./index";

const description = `
yarn add (--lock-only)

yarn-install-lock-only module [range]
`.trim();

const cli = meow(description, {});

if (cli.input.length < 1) {
  cli.showHelp();
}

const develop = !!(cli.flags.D || cli.flags.dev);
const [pkgName, range = "latest"] = cli.input;

const basePath = process.cwd();
const yarnLockPath = path.join(basePath, "yarn.lock");
const pkgJsonPath = path.join(basePath, "package.json");

install(pkgJsonPath, yarnLockPath)(pkgName, range, { develop });
