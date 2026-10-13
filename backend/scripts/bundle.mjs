import * as esbuild from "esbuild";
import { mkdirSync, cpSync, rmSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import path from "node:path";

const handlers = [
  { name: "distribute", entry: "src/handlers/distribute.ts" },
  { name: "pushWorker", entry: "src/handlers/pushWorker.ts", includeFirebase: true },
  { name: "deviceRegister", entry: "src/handlers/deviceRegister.ts" },
  { name: "deviceDelete", entry: "src/handlers/deviceDelete.ts" },
  { name: "deliveryAck", entry: "src/handlers/deliveryAck.ts" },
];

mkdirSync("dist/handlers", { recursive: true });
mkdirSync("dist/lambda", { recursive: true });

for (const handler of handlers) {
  const outfile = `dist/handlers/${handler.name}.js`;
  await esbuild.build({
    entryPoints: [handler.entry],
    bundle: true,
    platform: "node",
    target: "node20",
    format: "cjs",
    outfile,
    external: handler.includeFirebase ? [] : ["firebase-admin"],
    sourcemap: true,
    minify: false,
  });

  const stageDir = path.join("dist/lambda", handler.name);
  rmSync(stageDir, { recursive: true, force: true });
  mkdirSync(stageDir, { recursive: true });
  cpSync(outfile, path.join(stageDir, "index.js"));

  if (handler.includeFirebase) {
    execSync("npm install --omit=dev firebase-admin", {
      cwd: stageDir,
      stdio: "inherit",
    });
  }

  const zipPath = path.join("dist/lambda", `${handler.name}.zip`);
  execSync(`cd "${stageDir}" && zip -r "../${handler.name}.zip" .`, {
    stdio: "inherit",
  });

  writeFileSync(
    path.join("dist/lambda", `${handler.name}.sha256`),
    execSync(`shasum -a 256 "${zipPath}"`).toString(),
  );
}

console.log("Bundled Lambda handlers:", handlers.map((handler) => handler.name).join(", "));
