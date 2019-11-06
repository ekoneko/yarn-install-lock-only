import * as lockfile from "@yarnpkg/lockfile";
import { YarnLock, Map, Range, Version } from "./types";

export type DependenciesMap = Map<
  Map<{
    ranges: [Range, string][];
  }>
>;

const dependenciesMap: DependenciesMap = {};

export interface YarnLockParser {
  yarnLock: YarnLock;
  dependenciesMap: DependenciesMap;
}

export function parseLockFile(content: string) {
  const yarnLockJson: YarnLock = lockfile.parse(content).object;
  const dependenciesNames = Object.keys(yarnLockJson);

  dependenciesNames.forEach(dependenciesName => {
    const [_, name, range] = dependenciesName.match(/^(.+?)@(.+)$/);
    dependenciesMap[name] = dependenciesMap[name] || {};
    const version = yarnLockJson[dependenciesName].version;
    dependenciesMap[name][version] = dependenciesMap[name][version] || {
      ranges: []
    };
    dependenciesMap[name][version].ranges.push([range, dependenciesName]);
  });

  return {
    dependenciesMap,
    yarnLock: yarnLockJson
  };
}

export function recordLockFile(yarnLock: YarnLock) {
  return lockfile.stringify(yarnLock);
}
