import * as path from "path";
import * as fs from "fs";
import { parseLockFile, recordLockFile } from "./lockParser";
import { install } from "./install";

export const installLockOnly = (
  srcPkgJsonPath: string,
  srcYarnLockPath: string,
  distPkgJsonPath = srcPkgJsonPath,
  distYarnLockPath = srcYarnLockPath
) => {
  const pkgContent = fs.readFileSync(srcPkgJsonPath, "utf8");
  const lockContent = fs.readFileSync(srcYarnLockPath, "utf8");

  const srcPkgJson = JSON.parse(pkgContent);
  const parsedYarnLock = parseLockFile(lockContent);

  return async (pkgName: string, version = "latest") => {
    const { pkgJson, yarnLock } = await install(
      pkgName,
      version,
      parsedYarnLock,
      srcPkgJson
    );

    fs.writeFileSync(distPkgJsonPath, JSON.stringify(pkgJson, undefined, 2));
    fs.writeFileSync(distYarnLockPath, recordLockFile(yarnLock));
  };
};
