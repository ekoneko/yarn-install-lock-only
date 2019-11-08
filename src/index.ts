import * as fs from "fs";
import { YarnLock } from "./YarnLock";
import { install } from "./install";

export const installLockOnly = (
  srcPkgJsonPath: string,
  srcYarnLockPath: string,
  distPkgJsonPath = srcPkgJsonPath,
  distYarnLockPath = srcYarnLockPath
) => {
  const pkgContent = fs.readFileSync(srcPkgJsonPath, "utf8");
  const lockContent = fs.readFileSync(srcYarnLockPath, "utf8");

  const pkgJson = JSON.parse(pkgContent);
  const yarnLock = new YarnLock(lockContent, pkgJson);

  return async (pkgName: string, version = "latest") => {
    await install(pkgName, version, yarnLock, pkgJson);

    fs.writeFileSync(distPkgJsonPath, JSON.stringify(pkgJson, undefined, 2));
    fs.writeFileSync(distYarnLockPath, yarnLock.toString());
  };
};
