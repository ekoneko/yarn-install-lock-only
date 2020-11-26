import { maxSatisfying } from "semver";
import { Dependence, PkgInfo } from "../types";

const mockData = require("./resources/mock-data.json");

function getVersionAndRange(scope: string, info: PkgInfo) {
  if (/[a-z]/i.test(scope[0])) {
    const version = info["dist-tags"][scope];
    return [version, `^${version}`];
  }
  if (/\d/.test(scope[0])) {
    return [scope, scope];
  }
  const version = maxSatisfying(Object.keys(info.versions), scope);
  return [version, scope];
}

export async function getPkgInfo(name: string, scope: string = "latest") {
  const info = mockData[name];
  if (!info) {
    return null;
  }
  const [version, range] = getVersionAndRange(scope, info);
  const target: PkgInfo = version ? info.versions[version] : null;
  return target
    ? {
        dependence: {
          version,
          dependencies: target.dependencies,
          resolved: "",
          integrity: "",
        } as Dependence,
        range,
      }
    : null;
}

export async function getMaxSatisfyingVersion(name: string, range: string) {
  const info = mockData[name];
  if (!info) {
    return null;
  }
  return maxSatisfying(Object.keys(info.versions), range);
}
