import { describe, it, expect } from 'vitest';
import { getExternalLinks } from './externalLinks.js';
import type { ToolNode } from '../api/types.js';

function makeNode(overrides: Partial<ToolNode>): ToolNode {
  return {
    id: 'test-node',
    role: 'transform',
    tool: 'generic-tool',
    config: {},
    ...overrides,
  };
}

describe('getExternalLinks', () => {
  // Right: dagId present → Airflow DAG Grid link with dagId in href
  it('returns a link containing dagId in href when config.dagId is set', () => {
    const node = makeNode({ tool: 'apache-airflow', config: { dagId: 'my-dag' } });
    const links = getExternalLinks(node);
    const dagLink = links.find((l) => l.href.includes('my-dag'));
    expect(dagLink).toBeDefined();
    expect(dagLink!.href).toContain('localhost:8080/dags/my-dag/grid');
  });

  // Right: tool='apache-nifi', no dagId → NiFi UI link
  it('returns a NiFi UI link for apache-nifi tool', () => {
    const node = makeNode({ tool: 'apache-nifi', config: {} });
    const links = getExternalLinks(node);
    const nifiLink = links.find((l) => l.href.includes('localhost:8443/nifi'));
    expect(nifiLink).toBeDefined();
  });

  // Right: tool='apache-airflow', no dagId → Airflow home link
  it('returns Airflow home link for apache-airflow without dagId', () => {
    const node = makeNode({ tool: 'apache-airflow', config: {} });
    const links = getExternalLinks(node);
    const homeLink = links.find((l) => l.href.includes('localhost:8080'));
    expect(homeLink).toBeDefined();
  });

  // Existence/Cardinality: no dagId and no matching tool → empty array
  it('returns empty array when no dagId and tool is unknown', () => {
    const node = makeNode({ tool: 'some-unknown-tool', config: {} });
    const links = getExternalLinks(node);
    expect(links).toEqual([]);
  });

  // Conformance: each item has { label: string, href: string } and href starts with http:// or https://
  it('every returned link conforms to { label: string, href: string } with valid protocol', () => {
    const node = makeNode({ tool: 'apache-airflow', config: { dagId: 'conf-dag' } });
    const links = getExternalLinks(node);
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      expect(typeof link.label).toBe('string');
      expect(typeof link.href).toBe('string');
      expect(link.href).toMatch(/^https?:\/\//);
    }
  });
});
