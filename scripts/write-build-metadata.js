const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const buildDir = path.join(repoRoot, 'build');
const indexHtmlPath = path.join(buildDir, 'index.html');
const metadataPath = path.join(buildDir, 'app-version.json');

function runGit(command, fallback = 'unknown') {
  try {
    return execSync(command, {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim() || fallback;
  } catch (error) {
    return fallback;
  }
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

const commit = runGit('git rev-parse --short HEAD');
const branch = runGit('git branch --show-current');
const builtAt = new Date().toISOString();
const buildStamp = builtAt.replace(/[-:.TZ]/g, '').slice(0, 14);
const version = process.env.REPORTS_BUILD_VERSION || `${commit}-${buildStamp}`;

if (!fs.existsSync(buildDir)) {
  throw new Error(`Build directory does not exist: ${buildDir}`);
}

const metadata = {
  app: 'elegant-lashes-reports',
  version,
  commit,
  branch,
  builtAt,
};

fs.writeFileSync(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`);

if (fs.existsSync(indexHtmlPath)) {
  const indexHtml = fs.readFileSync(indexHtmlPath, 'utf8');
  const buildMetaTag = `<meta name="reports-build-version" content="${escapeHtml(version)}">`;
  const nextHtml = indexHtml.includes('name="reports-build-version"')
    ? indexHtml.replace(/<meta name="reports-build-version" content="[^"]*"\s*\/?>/, buildMetaTag)
    : indexHtml.replace('</head>', `    ${buildMetaTag}\n  </head>`);

  fs.writeFileSync(indexHtmlPath, nextHtml);
}

console.log(`Wrote reports build metadata: ${version}`);
