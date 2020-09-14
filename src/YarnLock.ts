import * as lockfile from "@yarnpkg/lockfile";
import {
  YarnLock as YarnLockType,
  Map,
  Range,
  Version,
  Dependence,
  PkgJson,
} from "./types";
const debug = require("debug")("yarn-install-lock-only");

type DependenceRangeMap = Map<
  Map<{
    version: Version;
    ref: string;
  }>
>;

type DependenceVersionMap = Map<Map<Range[]>>;

// {pkgName: {range: ref[] }}
type DependedMap = Map<Map<string[]>>;

const ROOT_REF = "package.json";

export class YarnLock {
  private data: YarnLockType;
  private packageJson: PkgJson;
  private dependenceRangeMap: DependenceRangeMap = {};
  private dependenceVersionMap: DependenceVersionMap = {};
  private dependedMap: DependedMap = {};

  constructor(lockContent: string, packageJson: PkgJson) {
    this.packageJson = packageJson;
    this.parse(lockContent);
  }

  public parse(content: string) {
    this.data = lockfile.parse(content).object;
    const dependenciesNames = Object.keys(this.data);

    dependenciesNames.forEach((dependenciesName) => {
      const [_, name, range] = dependenciesName.match(/^(.+?)@(.+)$/);
      const version = this.data[dependenciesName].version;
      this.dependenceRangeMap[name] = this.dependenceRangeMap[name] || {};
      this.dependenceRangeMap[name][range] = {
        version,
        ref: dependenciesName,
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

    // depended from package.json
    const packageJsonDependencies = {
      ...(this.packageJson.devDependencies || {}),
      ...(this.packageJson.dependencies || {}),
    };
    for (let depName of Object.keys(packageJsonDependencies)) {
      const range = packageJsonDependencies[depName];
      this.dependedMap[depName] = this.dependedMap[depName] || {};
      this.dependedMap[depName][range] = this.dependedMap[depName][range] || [];
      this.dependedMap[depName][range].push(ROOT_REF);
    }
  }

  public toString() {
    return lockfile.stringify(this.data);
  }

  public getVersion(pkgName: string, version: Version) {
    return this.dependenceVersionMap[pkgName][version];
  }

  public getAllVersions(pkgName: string) {
    if (!this.dependenceVersionMap[pkgName]) {
      debug(`[getAllVersions]version map is empty: ${pkgName}`);
      return [];
    }
    return Object.keys(this.dependenceVersionMap[pkgName]);
  }

  public getRange(pkgName: string) {
    if (!this.dependenceRangeMap[pkgName]) {
      this.dependenceRangeMap[pkgName] = {};
    }
    return this.dependenceRangeMap[pkgName];
  }

  public add(pkgName: string, dependence: Dependence, range: Range) {
    const ref = `${pkgName}@${range}`;
    if (this.data[ref]) {
      // skip
      return;
    }
    debug(`[add]${ref} to ${dependence.version}`);
    this.data[ref] = dependence;
    this.dependenceRangeMap[pkgName] = this.dependenceRangeMap[pkgName] || {};
    this.dependenceRangeMap[pkgName][range] = {
      version: dependence.version,
      ref,
    };
    if (!this.dependenceVersionMap[pkgName]) {
      this.dependenceVersionMap[pkgName] = {};
    }
    const ranges = this.dependenceVersionMap[pkgName][dependence.version] || [];
    if (!ranges.includes(range)) {
      ranges.push(range);
    }
    if (!this.dependedMap[pkgName]) {
      this.dependedMap[pkgName] = {};
    }
    this.dependedMap[pkgName][range] = this.dependedMap[pkgName][range] || [];
    this.dependedMap[pkgName][range].push(ROOT_REF);
  }

  public upgrade(name: string, range: Range, dependence: Dependence) {
    const ref = `${name}@${range}`;
    debug(`[upgrade]${ref} to ${dependence.version}`);

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
      version: dependence.version,
    };
  }

  public link(name: string, range: Range, version: Version) {
    debug(`[link]${name}@${range} to ${version}`);
    const ranges = this.getVersion(name, version);
    if (ranges.length === 0) {
      throw new Error("link unknown range");
    }
    const ref = `${name}@${range}`;
    if (!ranges.includes(range)) {
      ranges.push(range);
    }
    if (!this.dependenceRangeMap[name][range]) {
      this.dependenceRangeMap[name][range] = { version, ref };
    }
    const { ref: originRef } = this.dependenceRangeMap[name][ranges[0]];
    this.dependedMap[name][version] = this.dependedMap[name][version] || [];
    const dependedRefs = this.dependedMap[name][version];
    if (!dependedRefs.includes(ref)) {
      dependedRefs.push(ref);
    }
    this.data[ref] = this.data[originRef];

    if (this.data[ref].dependencies) {
      Object.keys(this.data[ref].dependencies).forEach((name) => {
        const range = this.data[ref].dependencies[name];
        this.addRef(name, range, ref);
      });
    }
  }

  public addRef(name: string, range: Range, ref: string) {
    debug(`[add ref]${ref} to ${name}@${range}`);
    const refs = this.dependedMap[name][range];
    if (!refs.includes(ref)) {
      refs.push(ref);
    }
  }

  public unlink(name: string, range: Range, ref: string) {
    debug(`[unlink]${name}@${range} in ${ref}`);
    if (!this.dependedMap[name][range]) {
      // skip
      return;
    }
    this.dependedMap[name][range] = this.dependedMap[name][range].filter(
      (r) => r !== ref
    );
    if (!this.dependedMap[name][range].length) {
      const depRef = `${name}@${range}`;
      if (this.data[depRef].dependencies) {
        Object.keys(this.data[depRef].dependencies).forEach((depName) => {
          const depRange = this.data[depRef].dependencies[depName];
          this.unlink(depName, depRange, depRef);
        });
      }
      debug(`[delete]${name}@${range}`);
      const version = this.data[`${name}@${range}`].version;
      delete this.dependenceVersionMap[name][version];
      delete this.dependenceRangeMap[name][range];
      delete this.data[`${name}@${range}`];
    }
  }

  public upgradePackageJson(name: string, range: Range) {
    if (
      this.packageJson.devDependencies &&
      this.packageJson.devDependencies[name] &&
      this.packageJson.devDependencies[name] !== range
    ) {
      this.unlink(name, this.packageJson.devDependencies[name], ROOT_REF);
      this.packageJson.devDependencies[name] = range;
    }
    if (
      this.packageJson.dependencies &&
      this.packageJson.dependencies[name] &&
      this.packageJson.dependencies[name] !== range
    ) {
      this.unlink(name, this.packageJson.dependencies[name], ROOT_REF);
      this.packageJson.dependencies[name] = range;
    }
  }

  public stringifyPackageJson() {
    return JSON.stringify(this.packageJson, undefined, 2);
  }
}
