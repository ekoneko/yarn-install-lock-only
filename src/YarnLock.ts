import * as lockfile from "@yarnpkg/lockfile";
import * as semver from "semver";
import {
  YarnLock as YarnLockType,
  Map,
  Range,
  Version,
  Dependence,
  PkgJson
} from "./types";

type DependenceRangeMap = Map<
  Map<{
    version: Version;
    ref: string;
  }>
>;

type DependenceVersionMap = Map<Map<Range[]>>;

// {pkgName: {range: ref[] }}
type DependedMap = Map<Map<string[]>>;

export class YarnLock {
  private data: YarnLockType;
  private packageJson: PkgJson;
  private dependenceRangeMap: DependenceRangeMap = {};
  private dependenceVersionMap: DependenceVersionMap = {};
  private dependedMap: DependedMap = {};

  constructor(lockContent: string, packageJson: PkgJson) {
    this.parse(lockContent);
    this.packageJson = packageJson;
  }

  public parse(content: string) {
    this.data = lockfile.parse(content).object;
    const dependenciesNames = Object.keys(this.data);

    dependenciesNames.forEach(dependenciesName => {
      const [_, name, range] = dependenciesName.match(/^(.+?)@(.+)$/);
      const version = this.data[dependenciesName].version;
      this.dependenceRangeMap[name] = this.dependenceRangeMap[name] || {};
      this.dependenceRangeMap[name][range] = {
        version,
        ref: dependenciesName
      };
      this.dependenceVersionMap[name] = this.dependenceVersionMap[name] || {};
      this.dependenceVersionMap[name][version] =
        this.dependenceVersionMap[name][version] || [];
      this.dependenceVersionMap[name][version].push(range);

      const { dependencies } = this.data[dependenciesName];
      if (dependencies) {
        const dependenceKeys = Object.keys(dependencies);
        for (let key of dependenceKeys) {
          const range = dependencies[key];
          this.dependedMap[key] = this.dependedMap[key] || {};
          this.dependedMap[key][range] = this.dependedMap[key][range] || [];
          this.dependedMap[key][range].push(dependenciesName);
        }
      }
    });
  }

  public toString() {
    return lockfile.stringify(this.data);
  }

  public getVersion(pkgName: string, version: Version) {
    return this.dependenceVersionMap[pkgName][version];
  }

  public getAllVersions(pkgName: string) {
    return Object.keys(this.dependenceVersionMap[pkgName]);
  }

  public getRange(pkgName: string) {
    return this.dependenceRangeMap[pkgName];
  }

  public add(pkgName: string, dependence: Dependence, range: Range) {
    const ref = `${pkgName}@${range}`;
    if (this.data[ref]) {
      // skip
      return;
    }
    this.data[ref] = dependence;
    this.dependenceRangeMap[pkgName][range] = {
      version: dependence.version,
      ref
    };
    const ranges = (this.dependenceVersionMap[pkgName][dependence.version] =
      this.dependenceVersionMap[pkgName][dependence.version] || []);
    if (!ranges.includes(range)) {
      ranges.push(range);
    }
  }

  public upgrade(name: string, range: Range, dependence: Dependence) {
    const ref = `${name}@${range}`;

    if (this.data[ref].dependencies) {
      const depNames = Object.keys(this.data[ref].dependencies);
      const nextDepNames = dependence.dependencies
        ? Object.keys(dependence.dependencies)
        : [];
      for (let depName of depNames) {
        if (
          !nextDepNames.includes(depName) ||
          dependence.dependencies[depName] !==
            this.data[ref].dependencies[depName]
        ) {
          this.unlink(depName, this.data[ref].dependencies[depName], ref);
        }
      }
    }

    this.data[ref] = dependence;
    this.dependenceRangeMap[name][range] = {
      ref,
      version: dependence.version
    };
  }

  public unlink(name: string, range: Range, ref: string) {
    // TODO: ignore if range in package.json
    this.dependedMap[name][range] = this.dependedMap[name][range].filter(
      r => r !== ref
    );
    if (!this.dependedMap[name][range].length) {
      const depRef = `${name}@${range}`;
      if (this.data[depRef].dependencies) {
        Object.keys(this.data[depRef].dependencies).forEach(depName => {
          const depRange = this.data[depRef].dependencies[depName];
          this.unlink(depName, depRange, depRef);
        });
      }
      delete this.data[`${name}@${range}`];
    }
  }
}
