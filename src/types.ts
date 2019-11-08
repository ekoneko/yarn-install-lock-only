export type Map<P> = { [key: string]: P };

export type Version = string;
export type Range = string;

export interface Dependence {
  version: string;
  resolved: string;
  integrity: string;
  dependencies: Map<Range>;
}

export type YarnLock = Map<Dependence>;

export interface PkgInfo {
  name: string;
  version: string;
  dependencies: Map<Range>;
  versions: string[];
  "dist-tags": Map<string>;
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
  dependencies: Map<string>;
  devDependencies: Map<string>;
}
