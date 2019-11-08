import * as meow from "meow";
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

const [pkgName, range = "latest"] = cli.input;

const yarnLockPath = path.join(process.cwd(), "yarn.lock");
const pkgJsonPath = path.join(process.cwd(), "package.json");

install(pkgJsonPath, yarnLockPath)(pkgName, range);
