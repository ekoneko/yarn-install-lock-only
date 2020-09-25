export type Version = string;
export type Range = string;

export interface Dependence {
  version: string;
  resolved: string;
  integrity: string;
  dependencies: Record<string, Range>;
}

export type YarnLock = Record<string, Dependence>;

export interface PkgInfo {
  name: string;
  version: string;
  dependencies: Record<string, Range>;
  versions: string[];
  "dist-tags": Record<string, string>;
  dist: {
    shasum: string;
    size: number;
    key: string;
    tarball: string;
  };
}

export interface PkgJson {
  name: string;
  version: string;
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
}
