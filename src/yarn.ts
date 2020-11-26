import * as childProcess from "child_process";
import { fromStream } from "ssri";
import { maxSatisfying } from "semver";
import { Readable } from "stream";
import download from "download";
import { Dependence, PkgInfo } from "./types";
const debug = require("debug")("yarn-install-lock-only");

async function execute(script: string, options?: childProcess.ExecOptions) {
  debug(`[execute]${script}`);
  return new Promise<string>((resolve, reject) => {
    const handler = childProcess.exec(script, options);
    let result = "";
    let error = "";
    handler.stdout.on("data", (chunk) => {
      result += chunk;
    });
    handler.stderr.on("data", (chunk) => {
      error += chunk;
    });
    handler.on("close", () => {
      resolve(result);
    });
    handler.on("error", (err) => {
      debug(error);
      reject(err);
    });
  });
}

async function computeIntegrity(resource: string, algorithms = ["sha1"]) {
  const stream = (download(resource) as unknown) as Readable;
  const integrity = await fromStream(stream, { algorithms });
  return integrity.toString();
}

function getRange(scope: string, info: PkgInfo) {
  if (/[a-z]/i.test(scope[0])) {
    const version = info["dist-tags"][scope];
    return `^${version}`;
  }
  return scope;
}

async function requestPkgInfo(name: string, scope: string = "latest") {
  const result = await execute(`yarn info ${name}@${scope} --json`);
  const data: PkgInfo = JSON.parse(result).data;
  const range = getRange(scope, data);
  if (!data.dist) {
    const satisfyingVersion = maxSatisfying(data.versions, range);
    const result = await execute(`yarn info ${name}@${satisfyingVersion} --json`);
    const info: PkgInfo = JSON.parse(result).data;
    const dependence: Dependence = {
      version: info.version,
      resolved: `${info.dist.tarball}#${info.dist.shasum}`,
      integrity: await computeIntegrity(info.dist.tarball),
      dependencies: info.dependencies,
    };
    return { dependence, range };
  }
  const dependence: Dependence = {
    version: data.version,
    resolved: `${data.dist.tarball}#${data.dist.shasum}`,
    integrity: await computeIntegrity(data.dist.tarball),
    dependencies: data.dependencies,
  };
  return { dependence, range };
}

export async function getPkgInfo(name: string, scope: string = "latest") {
  try {
    return requestPkgInfo(name, scope);
  } catch (err: unknown) {
    // TODO: friendly error
    throw new Error(`Get ${name}@${scope} failed: ${err}`);
  }
}
