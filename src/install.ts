import * as ssri from "ssri";
import * as download from "download";
import * as semver from "semver";
import { getPkgInfo, getMaxSatisfyingVersion } from "./yarn";
import { Readable } from "stream";
import { YarnLock } from "./YarnLock";
import { Version, Dependence, Map, Range } from "./types";
const debug = require("debug")("yarn-install-lock-only");

async function computeIntegrity(resource: string, algorithms = ["sha1"]) {
  const stream = (download(resource) as any) as Readable;
  return await ssri.fromStream(stream, { algorithms });
}

interface Pkg {
  version: string;
  resolved: string;
  integrity: string;
  dependencies: Map<string>;
}

export async function getPkg(
  pkgName: string,
  pkgVersion: string = "latest",
  noRetry = false
): Promise<Pkg> {
  const pkgInfo = await getPkgInfo(pkgName, pkgVersion);
  if (!pkgInfo) {
    throw new Error(`${pkgName}@${pkgVersion} not exists`);
  }
  if (!noRetry && !pkgInfo.dist) {
    if (pkgInfo["dist-tags"][pkgVersion]) {
      return getPkg(pkgName, pkgInfo["dist-tags"][pkgVersion], true);
    }
    if (pkgInfo.versions) {
      const version = semver.maxSatisfying(pkgInfo.versions, pkgVersion);
      return getPkg(pkgName, version, true);
    }
  }
  if (!pkgInfo.dist) {
    throw new Error(`${pkgName}@${pkgVersion} not exists`);
  }
  const integrity = await computeIntegrity(pkgInfo.dist.tarball);
  const dependence = {
    version: pkgInfo.version,
    resolved: `${pkgInfo.dist.tarball}#${pkgInfo.dist.shasum}`,
    integrity: integrity.toString(),
    dependencies: pkgInfo.dependencies,
  };
  return dependence;
}

function bumpVersion(
  pkgName: string,
  dependence: Dependence,
  yarnLock: YarnLock
) {
  const ranges = yarnLock.getRange(pkgName);
  for (let range of Object.keys(ranges)) {
    const { version } = ranges[range];
    if (
      version !== dependence.version &&
      semver.maxSatisfying([version, dependence.version], range) ===
        dependence.version
    ) {
      yarnLock.upgrade(pkgName, range, dependence);
    }
  }
}

async function installDependencies(
  dependencies: Map<Range>,
  yarnLock: YarnLock,
  ref: string
) {
  const installList: { name: string; version: Version }[] = [];
  const names = Object.keys(dependencies);
  const handlers = names.map(async (name) => {
    const range = dependencies[name];
    if (yarnLock.getRange(name)[range]) {
      yarnLock.addRef(name, range, ref);
      return;
    }
    const versions = yarnLock.getAllVersions(name);
    const version = semver.maxSatisfying(versions, range);
    if (version) {
      yarnLock.link(name, range, version);
      return;
    }
    const satisfyingVersion = await getMaxSatisfyingVersion(name, range);
    installList.push({ name, version: satisfyingVersion });
  });
  await Promise.all(handlers);
  for (let task of installList) {
    await install(task.name, task.version, yarnLock);
  }
}

export async function install(
  pkgName: string,
  pkgVersion: string = "latest",
  yarnLock: YarnLock,
  updatePackageJson = false
) {
  debug(`[install]${pkgName}@${pkgVersion}`);
  const pkgInfo = await getPkg(pkgName, pkgVersion);
  debug(`[install]real version is ${pkgInfo.version}`);

  // TODO: difference with version, range or dist tag
  const range =
    pkgVersion === "latest" ? `^${pkgInfo.version}` : pkgInfo.version;

  yarnLock.add(pkgName, pkgInfo, range);
  if (pkgInfo.dependencies) {
    await installDependencies(
      pkgInfo.dependencies,
      yarnLock,
      `${pkgName}@${range}`
    );
  }
  bumpVersion(pkgName, pkgInfo, yarnLock);

  if (updatePackageJson) {
    yarnLock.upgradePackageJson(pkgName, range);
  }
}
