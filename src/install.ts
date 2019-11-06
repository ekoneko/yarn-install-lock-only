import * as ssri from "ssri";
import * as download from "download";
import * as semver from "semver";
import { getPkgInfo, getMaxSatisfyingVersion } from "./yarn";
import { Readable } from "stream";
import { YarnLockParser } from "./lockParser";
import { Version, PkgJson, Dependency, Map, Range } from "./types";

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
  const dependency = {
    version: pkgInfo.version,
    resolved: `${pkgInfo.dist.tarball}#${pkgInfo.dist.shasum}`,
    integrity: integrity.toString(),
    dependencies: pkgInfo.dependencies
  };
  return dependency;
}

function bumpVersion(
  name: string,
  oldVersion: Version,
  yarnParser: YarnLockParser,
  nextDependency: Dependency,
  refs: string[]
) {
  yarnParser.dependenciesMap[name][nextDependency.version] =
    yarnParser.dependenciesMap[name][nextDependency.version] ||
    yarnParser.dependenciesMap[name][oldVersion];

  refs.forEach(ref => {
    yarnParser.yarnLock[ref] = nextDependency;
  });
}

async function installDependencies(
  dependencies: Map<Range>,
  yarnParser: YarnLockParser
) {
  const installList: { name: string; version: Version }[] = [];
  const dependencyNames = Object.keys(dependencies);
  const handlers = dependencyNames.map(async dependencyName => {
    const range = dependencies[dependencyName];
    const versions = Object.keys(yarnParser.dependenciesMap[dependencyName]);
    if (semver.maxSatisfying(versions, range)) {
      // skip
      return;
    }
    const satisfyingVersion = await getMaxSatisfyingVersion(
      dependencyName,
      range
    );
    installList.push({ name: dependencyName, version: satisfyingVersion });
  });
  await Promise.all(handlers);
  for (let task of installList) {
    await install(task.name, task.version, yarnParser);
  }
}

export async function install(
  pkgName: string,
  pkgVersion: string = "latest",
  yarnParser: YarnLockParser,
  pkgJson?: PkgJson
) {
  const pkgInfo = await getPkg(pkgName, pkgVersion);

  if (pkgJson && pkgJson.dependencies && pkgJson.dependencies[pkgName]) {
    pkgJson.dependencies[pkgName] = `^${pkgInfo.version}`;
  } else if (
    pkgJson &&
    pkgJson.devDependencies &&
    pkgJson.devDependencies[pkgName]
  ) {
    pkgJson.devDependencies[pkgName] = `^${pkgInfo.version}`;
  }

  if (yarnParser.dependenciesMap[pkgName][pkgInfo.version]) {
    // the special version has been existed, skip
    return {
      yarnLock: yarnParser.yarnLock
    };
  }

  const versions = Object.keys(yarnParser.dependenciesMap[pkgName]);
  let resolved = false;
  for (let version of versions) {
    const ranges = yarnParser.dependenciesMap[pkgName][version].ranges;
    const satisfyLength = ranges.filter(range =>
      semver.satisfies(pkgInfo.version, range[0])
    ).length;
    if (satisfyLength === ranges.length) {
      // if all ranges of one version satisfies the pkgVersion, upgrade the version
      bumpVersion(
        pkgName,
        version,
        yarnParser,
        pkgInfo,
        ranges.map(range => range[1])
      );
      await installDependencies(pkgInfo.dependencies, yarnParser);
      resolved = true;
      continue;
    }
  }

  if (!resolved) {
    yarnParser.yarnLock[`${pkgName}@^${pkgInfo.version}`] = pkgInfo;
    await installDependencies(pkgInfo.dependencies, yarnParser);
  }
  return {
    pkgJson: pkgJson,
    yarnLock: yarnParser.yarnLock
  };
}
