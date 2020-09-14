import * as childProcess from "child_process";
import { PkgInfo } from "./types";
import * as semver from "semver";
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

export async function getPkgInfo(name: string, version?: string) {
  const result = await execute(
    `yarn info ${name}@${version || "latest"} --json`
  );
  return JSON.parse(result).data as PkgInfo;
}

export async function getMaxSatisfyingVersion(name: string, range: string) {
  const data = await execute(`yarn info ${name}@${range} --json`);
  const result = JSON.parse(data).data as PkgInfo;
  return semver.maxSatisfying(result.versions, range);
}
