import * as path from "path";
import * as fs from "fs";
import { installLockOnly } from "./index";

const tempDir = path.join(__dirname, "../temp");
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir);
}

const srcLockPath = path.join(__dirname, "../resources/yarn.lock");
const srcPkgPath = path.join(__dirname, "../resources/package.json");
const distLockPath = path.join(tempDir, "yarn.lock");
const distPkgPath = path.join(tempDir, "package.json");

installLockOnly(srcPkgPath, srcLockPath, distPkgPath, distLockPath)(
  "color",
  "latest"
);
