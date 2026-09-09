/**
 * @file Version bumper automation script.
 * Synchronizes and increments semantic versions across package.json,
 * Tauri configuration, and Rust Cargo manifest files. Supports patch, minor, major, and beta.
 */
import fs from "fs";
import path from "path";

const args = process.argv.slice(2);
const type = args[0] || "patch";

const packagePath = path.resolve("package.json");
if (!fs.existsSync(packagePath)) {
  console.error("[Error] package.json not found in the current directory.");
  process.exit(1);
}

const packageContent = JSON.parse(fs.readFileSync(packagePath, "utf8"));
const currentVersion = packageContent.version;

// Parsear versión actual (ej: 1.0.0 o 1.0.1-beta.0)
const semverRegex = /^(\d+)\.(\d+)\.(\d+)(-beta\.(\d+))?$/;
const match = currentVersion.match(semverRegex);

if (!match) {
  console.error(
    `[Error] Current version "${currentVersion}" does not match expected semver format.`
  );
  process.exit(1);
}

let major = parseInt(match[1], 10);
let minor = parseInt(match[2], 10);
let patch = parseInt(match[3], 10);
let betaNum = match[5] ? parseInt(match[5], 10) : null;

let newVersion;

if (type === "major") {
  major++;
  minor = 0;
  patch = 0;
  newVersion = `${major}.${minor}.${patch}`;
} else if (type === "minor") {
  minor++;
  patch = 0;
  newVersion = `${major}.${minor}.${patch}`;
} else if (type === "beta") {
  const nextBeta = betaNum !== null ? betaNum + 1 : 0;
  if (betaNum === null) {
    patch++;
  }
  newVersion = `${major}.${minor}.${patch}-beta.${nextBeta}`;
} else {
  if (betaNum === null) {
    patch++;
  }
  newVersion = `${major}.${minor}.${patch}`;
}

// 1. Update package.json
packageContent.version = newVersion;
fs.writeFileSync(packagePath, JSON.stringify(packageContent, null, 2) + "\n");
console.log(`[package.json] -> v${newVersion}`);

// 2. Update Tauri configuration version
const possibleTauriPaths = [
  path.resolve("src-tauri/tauri.conf.json"),
  path.resolve("tauri.conf.json"),
];

let tauriUpdated = false;
for (const tauriConfPath of possibleTauriPaths) {
  if (fs.existsSync(tauriConfPath)) {
    const tauriConfContent = JSON.parse(fs.readFileSync(tauriConfPath, "utf8"));
    tauriConfContent.version = newVersion;
    fs.writeFileSync(tauriConfPath, JSON.stringify(tauriConfContent, null, 2) + "\n");
    console.log(`[${path.relative(process.cwd(), tauriConfPath)}] -> v${newVersion}`);
    tauriUpdated = true;
    break;
  }
}
if (!tauriUpdated) {
  console.warn("[Warning] Could not locate tauri.conf.json");
}

// 3. Update Rust Cargo manifest version
const possibleCargoPaths = [path.resolve("src-tauri/Cargo.toml"), path.resolve("Cargo.toml")];

let cargoUpdated = false;
const cargoVersionRegex = /(^\[package\][\s\S]*?version\s*=\s*")[^"]+(")/m;

for (const cargoPath of possibleCargoPaths) {
  if (fs.existsSync(cargoPath)) {
    let cargoContent = fs.readFileSync(cargoPath, "utf8");
    if (cargoVersionRegex.test(cargoContent)) {
      cargoContent = cargoContent.replace(cargoVersionRegex, `$1${newVersion}$2`);
      fs.writeFileSync(cargoPath, cargoContent, "utf8");
      console.log(`[${path.relative(process.cwd(), cargoPath)}] -> v${newVersion}`);
      cargoUpdated = true;
      break;
    }
  }
}
if (!cargoUpdated) {
  console.warn("[Warning] Could not locate or update version field inside Cargo.toml");
}

console.log(`\nVersion synchronization complete for v${newVersion}!`);
