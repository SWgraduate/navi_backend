import {
  DepartmentTreeScraper,
  flattenDepartmentTree,
} from 'src/services/DepartmentTreeScraper';

describe('DepartmentTreeScraper', () => {
  it('parses a configured academic organization tree from HTML', async () => {
    const scraper = new DepartmentTreeScraper();

    const html = `
      <div id="org-root">
        <ul class="colleges">
          <li class="college">
            <a class="label" href="/college/engineering">공과대학</a>
            <ul class="departments">
              <li class="department">
                <a class="label" href="/department/software">소프트웨어학부</a>
                <ul class="majors">
                  <li class="major">
                    <a class="label" href="/major/ai">인공지능전공</a>
                  </li>
                  <li class="major">
                    <a class="label" href="/major/data">데이터사이언스전공</a>
                  </li>
                </ul>
              </li>
            </ul>
          </li>
          <li class="college">
            <a class="label" href="/college/business">경상대학</a>
          </li>
        </ul>
      </div>
    `;

    const result = await scraper.scrape({
      sourceKey: 'sample-university',
      rootLabel: '학과 트리',
      sourceUrl: 'https://example.edu/organization',
      html,
      rootScope: '#org-root',
      node: {
        type: 'college',
        list: 'ul.colleges',
        item: 'li.college',
        labelSelector: 'a.label',
        urlSelector: 'a.label',
        children: {
          type: 'department',
          list: 'ul.departments',
          item: 'li.department',
          labelSelector: 'a.label',
          urlSelector: 'a.label',
          children: {
            type: 'major',
            list: 'ul.majors',
            item: 'li.major',
            labelSelector: 'a.label',
            urlSelector: 'a.label',
          },
        },
      },
    });

    expect(result.nodeCount).toBe(5);
    expect(result.tree).toHaveLength(2);
    expect(result.tree[0]?.label).toBe('공과대학');
    expect(result.tree[0]?.url).toBe('https://example.edu/college/engineering');
    expect(result.tree[0]?.children[0]?.label).toBe('소프트웨어학부');
    expect(result.tree[0]?.children[0]?.children[1]?.label).toBe('데이터사이언스전공');
  });

  it('flattens parent-child relationships for database upserts', () => {
    const nodes = flattenDepartmentTree('sample-university', [
      {
        key: '공과대학',
        label: '공과대학',
        type: 'college',
        path: ['공과대학'],
        depth: 0,
        sortOrder: 0,
        children: [
          {
            key: '공과대학 > 소프트웨어학부',
            label: '소프트웨어학부',
            type: 'department',
            path: ['공과대학', '소프트웨어학부'],
            depth: 1,
            sortOrder: 0,
            children: [],
          },
        ],
      },
    ]);

    expect(nodes).toEqual([
      {
        sourceKey: 'sample-university',
        nodeKey: '공과대학',
        parentKey: null,
        label: '공과대학',
        type: 'college',
        path: ['공과대학'],
        depth: 0,
        sortOrder: 0,
        url: undefined,
      },
      {
        sourceKey: 'sample-university',
        nodeKey: '공과대학 > 소프트웨어학부',
        parentKey: '공과대학',
        label: '소프트웨어학부',
        type: 'department',
        path: ['공과대학', '소프트웨어학부'],
        depth: 1,
        sortOrder: 0,
        url: undefined,
      },
    ]);
  });

  it('fails fast when neither sourceUrl nor html is provided', async () => {
    const scraper = new DepartmentTreeScraper();

    await expect(
      scraper.scrape({
        sourceKey: 'sample-university',
        rootLabel: '학과 트리',
        node: {
          type: 'college',
          list: 'ul.colleges',
          item: 'li.college',
          labelSelector: 'a.label',
        },
      }),
    ).rejects.toThrow('Either html or sourceUrl must be provided.');
  });
});
