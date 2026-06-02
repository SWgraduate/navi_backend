import axios from 'axios';
import { load, Cheerio, CheerioAPI } from 'cheerio';

export const ACADEMIC_ORGANIZATION_NODE_TYPES = [
  'college',
  'department',
  'major',
  'program',
  'track',
] as const;

export type AcademicOrganizationNodeType =
  (typeof ACADEMIC_ORGANIZATION_NODE_TYPES)[number];

export interface DepartmentTreeNode {
  key: string;
  label: string;
  type: AcademicOrganizationNodeType;
  path: string[];
  depth: number;
  sortOrder: number;
  url?: string;
  children: DepartmentTreeNode[];
}

export interface DepartmentNodeSelectorConfig {
  type: AcademicOrganizationNodeType;
  list: string;
  item: string;
  labelSelector: string;
  urlSelector?: string;
  urlAttribute?: string;
  children?: DepartmentNodeSelectorConfig;
}

export interface DepartmentTreeScrapeRequest {
  sourceKey: string;
  rootLabel: string;
  sourceUrl?: string;
  html?: string;
  rootScope?: string;
  node: DepartmentNodeSelectorConfig;
}

export interface ScrapedDepartmentTree {
  sourceKey: string;
  rootLabel: string;
  sourceUrl?: string;
  fetchedAt: Date;
  nodeCount: number;
  tree: DepartmentTreeNode[];
}

export interface FlattenedDepartmentNode {
  sourceKey: string;
  nodeKey: string;
  parentKey: string | null;
  label: string;
  type: AcademicOrganizationNodeType;
  path: string[];
  depth: number;
  sortOrder: number;
  url?: string;
}

type HtmlLoader = (url: string) => Promise<string>;

const SELF_SELECTOR = '__self__';

async function defaultHtmlLoader(url: string): Promise<string> {
  const response = await axios.get<string>(url, {
    responseType: 'text',
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36',
    },
  });

  return response.data;
}

function normalizeLabel(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function buildNodeKey(path: string[]): string {
  return path.map((segment) => normalizeLabel(segment).toLowerCase()).join(' > ');
}

function countNodes(tree: DepartmentTreeNode[]): number {
  return tree.reduce((total, node) => total + 1 + countNodes(node.children), 0);
}

function resolveAbsoluteUrl(url: string | undefined, sourceUrl?: string): string | undefined {
  if (!url) {
    return undefined;
  }

  if (!sourceUrl) {
    return url;
  }

  try {
    return new URL(url, sourceUrl).toString();
  } catch {
    return url;
  }
}

export class DepartmentTreeScraper {
  constructor(private readonly htmlLoader: HtmlLoader = defaultHtmlLoader) {}

  async scrape(input: DepartmentTreeScrapeRequest): Promise<ScrapedDepartmentTree> {
    if (!input.html && !input.sourceUrl) {
      throw new Error('Either html or sourceUrl must be provided.');
    }

    const html = input.html ?? (await this.htmlLoader(input.sourceUrl!));

    return this.parseHtml(html, input);
  }

  parseHtml(
    html: string,
    input: Omit<DepartmentTreeScrapeRequest, 'html'>,
  ): ScrapedDepartmentTree {
    const $ = load(html);
    const scope = this.resolveRootScope($, input.rootScope);
    const tree = this.parseNodes($, scope, input.node, [], input.sourceUrl);

    return {
      sourceKey: input.sourceKey,
      rootLabel: input.rootLabel,
      sourceUrl: input.sourceUrl,
      fetchedAt: new Date(),
      nodeCount: countNodes(tree),
      tree,
    };
  }

  private resolveRootScope($: CheerioAPI, rootScope?: string): Cheerio<any> {
    if (!rootScope) {
      return $.root();
    }

    const scope = $(rootScope).first();

    if (scope.length === 0) {
      throw new Error(`Root scope selector did not match anything: ${rootScope}`);
    }

    return scope;
  }

  private parseNodes(
    $: CheerioAPI,
    scope: Cheerio<any>,
    config: DepartmentNodeSelectorConfig,
    path: string[],
    sourceUrl?: string,
  ): DepartmentTreeNode[] {
    const listScope = this.resolveListScope(scope, config.list);

    if (listScope.length === 0) {
      return [];
    }

    const items = this.resolveItems(listScope, config.item);
    const nodes: DepartmentTreeNode[] = [];

    items.each((index, element) => {
      const item = $(element);
      const label = this.readText(item, config.labelSelector);

      if (!label) {
        return;
      }

      const nextPath = [...path, label];
      const rawUrl = this.readAttribute(
        item,
        config.urlSelector,
        config.urlAttribute ?? 'href',
      );
      const children = config.children
        ? this.parseNodes($, item, config.children, nextPath, sourceUrl)
        : [];

      nodes.push({
        key: buildNodeKey(nextPath),
        label,
        type: config.type,
        path: nextPath,
        depth: nextPath.length - 1,
        sortOrder: index,
        url: resolveAbsoluteUrl(rawUrl, sourceUrl),
        children,
      });
    });

    return nodes;
  }

  private resolveListScope(
    scope: Cheerio<any>,
    selector: string,
  ): Cheerio<any> {
    if (selector === SELF_SELECTOR) {
      return scope;
    }

    const directMatch = scope.children(selector).first();

    if (directMatch.length > 0) {
      return directMatch;
    }

    return scope.find(selector).first();
  }

  private resolveItems(
    listScope: Cheerio<any>,
    selector: string,
  ): Cheerio<any> {
    const directChildren = listScope.children(selector);

    if (directChildren.length > 0) {
      return directChildren;
    }

    return listScope.find(selector);
  }

  private readText(scope: Cheerio<any>, selector: string): string {
    const target =
      selector === SELF_SELECTOR ? scope.first() : scope.find(selector).first();

    return normalizeLabel(target.text());
  }

  private readAttribute(
    scope: Cheerio<any>,
    selector: string | undefined,
    attributeName: string,
  ): string | undefined {
    if (!selector) {
      return undefined;
    }

    const target =
      selector === SELF_SELECTOR ? scope.first() : scope.find(selector).first();
    const value = target.attr(attributeName);

    if (!value) {
      return undefined;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
}

export function flattenDepartmentTree(
  sourceKey: string,
  tree: DepartmentTreeNode[],
): FlattenedDepartmentNode[] {
  const nodes: FlattenedDepartmentNode[] = [];

  const visit = (
    entries: DepartmentTreeNode[],
    parentKey: string | null,
  ): void => {
    for (const entry of entries) {
      nodes.push({
        sourceKey,
        nodeKey: entry.key,
        parentKey,
        label: entry.label,
        type: entry.type,
        path: entry.path,
        depth: entry.depth,
        sortOrder: entry.sortOrder,
        url: entry.url,
      });

      visit(entry.children, entry.key);
    }
  };

  visit(tree, null);

  return nodes;
}
