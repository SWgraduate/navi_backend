import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import AcademicOrganizationNode from 'src/models/AcademicOrganizationNode';
import { MONGO_URI } from 'src/settings';
import {
  DepartmentTreeScrapeRequest,
  DepartmentTreeScraper,
  flattenDepartmentTree,
} from 'src/services/DepartmentTreeScraper';

interface CliOptions {
  configPath?: string;
  url?: string;
  htmlFile?: string;
  dryRun: boolean;
  help: boolean;
}

function printUsage(): void {
  console.log(`
Usage:
  pnpm sync:departments -- --config <path-to-json> [--url <source-url>] [--html-file <local-html>] [--dry-run]

Required config fields:
  sourceKey, rootLabel, node

Notes:
  - Use --url for live HTML fetches.
  - Use --html-file when you already captured rendered DOM.
  - The sync aborts if zero nodes are extracted to avoid wiping existing data.
`);
}

function parseCliArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    dryRun: false,
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (!token) {
      continue;
    }

    if (token === '--config') {
      options.configPath = argv[index + 1];
      index += 1;
      continue;
    }

    if (token === '--url') {
      options.url = argv[index + 1];
      index += 1;
      continue;
    }

    if (token === '--html-file') {
      options.htmlFile = argv[index + 1];
      index += 1;
      continue;
    }

    if (token === '--dry-run') {
      options.dryRun = true;
      continue;
    }

    if (token === '--help' || token === '-h') {
      options.help = true;
    }
  }

  return options;
}

function loadConfig(configPath: string): DepartmentTreeScrapeRequest {
  const absolutePath = path.resolve(process.cwd(), configPath);
  const raw = fs.readFileSync(absolutePath, 'utf-8');
  const parsed = JSON.parse(raw) as DepartmentTreeScrapeRequest;

  if (!parsed.sourceKey || !parsed.rootLabel || !parsed.node) {
    throw new Error('Config must include sourceKey, rootLabel, and node.');
  }

  return parsed;
}

async function run(): Promise<void> {
  const options = parseCliArgs(process.argv.slice(2));

  if (options.help || !options.configPath) {
    printUsage();
    process.exitCode = options.help ? 0 : 1;
    return;
  }

  const config = loadConfig(options.configPath);

  if (options.url) {
    config.sourceUrl = options.url;
  }

  if (options.htmlFile) {
    const htmlPath = path.resolve(process.cwd(), options.htmlFile);
    config.html = fs.readFileSync(htmlPath, 'utf-8');
  }

  const scraper = new DepartmentTreeScraper();
  const result = await scraper.scrape(config);
  const flatNodes = flattenDepartmentTree(result.sourceKey, result.tree);

  if (flatNodes.length === 0) {
    throw new Error(
      'No academic organization nodes were extracted. Aborting sync to protect existing data.',
    );
  }

  if (options.dryRun) {
    console.log(
      JSON.stringify(
        {
          sourceKey: result.sourceKey,
          sourceUrl: result.sourceUrl,
          nodeCount: result.nodeCount,
          preview: flatNodes.slice(0, 10),
        },
        null,
        2,
      ),
    );
    return;
  }

  await mongoose.connect(MONGO_URI);

  try {
    await AcademicOrganizationNode.bulkWrite(
      flatNodes.map((node) => ({
        updateOne: {
          filter: {
            sourceKey: node.sourceKey,
            nodeKey: node.nodeKey,
          },
          update: {
            $set: {
              ...node,
              sourceUrl: result.sourceUrl,
              fetchedAt: result.fetchedAt,
            },
          },
          upsert: true,
        },
      })),
      { ordered: false },
    );

    await AcademicOrganizationNode.deleteMany({
      sourceKey: result.sourceKey,
      nodeKey: { $nin: flatNodes.map((node) => node.nodeKey) },
    });

    console.log(
      `Synced ${flatNodes.length} academic organization nodes for source '${result.sourceKey}'.`,
    );
  } finally {
    await mongoose.disconnect();
  }
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
