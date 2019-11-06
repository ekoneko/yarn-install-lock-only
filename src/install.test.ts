import * as path from "path";
import * as fs from "fs";
import { parseLockFile, recordLockFile } from "./lockParser";
import { install } from "./install";

const lockPath = path.join(__dirname, "../resources/yarn.lock");
const file = fs.readFileSync(lockPath, "utf8");
const lockFile = parseLockFile(file);

const pkgPath = path.join(__dirname, "../resources/package.json");
const pkgFile = fs.readFileSync(pkgPath).toString();
const pkgJson = JSON.parse(pkgFile);

install("color", "latest", lockFile, pkgJson).then(res => {
  const { yarnLock, pkgJson } = res;
  const lockString = recordLockFile(yarnLock);

  const tempDir = path.join(__dirname, "../temp");
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir);
  }
  fs.writeFileSync(path.join(tempDir, "yarn.lock"), lockString);
  fs.writeFileSync(
    path.join(tempDir, "package.json"),
    JSON.stringify(pkgJson, undefined, 2)
  );

  console.log(pkgJson);
});
