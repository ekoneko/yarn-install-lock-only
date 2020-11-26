import * as fs from "fs";
import { YarnLock } from "./YarnLock";
import { createInstall } from "./install";

export interface AddOptions {
  develop?: boolean;
}

export default (
  srcPkgJsonPath: string,
  srcYarnLockPath: string,
  distPkgJsonPath = srcPkgJsonPath,
  distYarnLockPath = srcYarnLockPath
) => {
  const pkgContent = fs.readFileSync(srcPkgJsonPath, "utf8");
  const lockContent = fs.readFileSync(srcYarnLockPath, "utf8");
  const yarnLock = new YarnLock(pkgContent, lockContent);
  const install = createInstall(yarnLock);
  return async (pkgName: string, version = "latest", options?: AddOptions) => {
    await install(pkgName, version, { develop: options?.develop });
    fs.writeFileSync(distPkgJsonPath, yarnLock.exportPkgJson());
    fs.writeFileSync(distYarnLockPath, yarnLock.exportLockFile());
  };
};
