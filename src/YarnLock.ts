import { Dependence, PkgJson, YarnLock as IYarnLock } from "./types";
import { parse as parseYarnLock, stringify as stringifyYarnLock } from "@yarnpkg/lockfile";
import { maxSatisfying } from "semver";

const ROOT_REF = "ROOT_REF";

export class YarnLock {
  public pkgJson: PkgJson;
  public yarnData: IYarnLock;
  public packageMap: Record<string, Dependence> = {};
  public packageRef: Record<string, string[]> = {};

  constructor(pkgJsonFile: string, lockFile: string) {
    this.pkgJson = JSON.parse(pkgJsonFile);
    this.yarnData = parseYarnLock(lockFile).object;

    const dependencies = {
      ...this.pkgJson.devDependencies,
      ...this.pkgJson.dependencies,
    };
    this.resolveRef(ROOT_REF, dependencies);

    Object.keys(this.yarnData).forEach((key) => {
      const [, name] = key.match(/^(.+?)@(.+)$/);
      const dependence = this.yarnData[key];
      const versionKey = `${name}@${dependence.version}`;
      this.packageMap[versionKey] = dependence;
      if (dependence.dependencies) {
        this.resolveRef(key, dependence.dependencies);
      }
    });
  }

  add(
    name: string,
    range: string,
    info: Dependence,
    options: { write?: boolean; develop?: boolean; dependenceBy?: string }
  ) {
    const key = `${name}@${range}`;
    if (!options.dependenceBy && !options.write) {
      throw new Error("ref not found");
    }
    this.yarnData[key] = info;
    if (options.write) {
      this.updatePkgJson(name, range, options.develop);
    }
    this.packageRef[key] = this.packageRef[key] || [];
    this.packageRef[key].push(options.dependenceBy ?? ROOT_REF);
    this.packageMap[`${name}@${info.version}`] = info;
  }

  unlink(name: string, range: string, ref: string) {
    const key = `${name}@${range}`;
    if (this.packageRef[key]) {
      this.packageRef[key] = this.packageRef[key].filter((selectedRef) => selectedRef !== ref);
    }
    if (!this.packageRef[key] || this.packageRef[key].length === 0) {
      this.remove(name, range);
    }
  }

  exportPkgJson() {
    return JSON.stringify(this.pkgJson, null, 2);
  }

  exportLockFile() {
    return stringifyYarnLock(this.yarnData);
  }

  match(name: string, scope: string) {
    if (/[a-z]/i.test(scope[0])) {
      // Can't resolve dist tag
      return false;
    }
    const versions = Object.keys(this.packageMap)
      .map((key) => (key.startsWith(`${name}`) ? key.replace(`${name}@`, "") : null))
      .filter(Boolean);
    const matchVersion = maxSatisfying(versions, scope);
    return this.packageMap[`${name}@${matchVersion}`];
  }

  private updatePkgJson(name: string, range: string, develop?: boolean) {
    this.removeFromPkgJson(name);
    if (develop) {
      this.pkgJson.devDependencies = {
        ...this.pkgJson.devDependencies,
        [name]: range,
      };
    } else {
      this.pkgJson.dependencies = {
        ...this.pkgJson.dependencies,
        [name]: range,
      };
    }
  }

  private removeFromPkgJson(name: string) {
    if (this.pkgJson.devDependencies?.[name]) {
      this.unlink(name, this.pkgJson.devDependencies[name], ROOT_REF);
      delete this.pkgJson.devDependencies[name];
    }
    if (this.pkgJson.dependencies?.[name]) {
      this.unlink(name, this.pkgJson.dependencies[name], ROOT_REF);
      delete this.pkgJson.dependencies[name];
    }
  }

  private remove(name: string, range: string) {
    const key = `${name}@${range}`;
    const { dependencies } = this.yarnData[key] ?? {};
    delete this.yarnData[key];
    if (dependencies) {
      Object.keys(dependencies).forEach((subKey) => {
        this.unlink(subKey, dependencies[subKey], `${name}@${range}`);
      });
    }
  }

  private resolveRef(ref: string, dependencies: Record<string, string>) {
    Object.keys(dependencies).forEach((name) => {
      const key = `${name}@${dependencies[name]}`;
      this.packageRef[key] = this.packageRef[key] || [];
      this.packageRef[key].push(ref);
    });
  }
}
