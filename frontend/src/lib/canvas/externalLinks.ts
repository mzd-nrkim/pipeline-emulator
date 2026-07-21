import type { ToolNode } from '../api/types.js';

const AIRFLOW_UI_BASE = 'http://localhost:8080';
const NIFI_UI_BASE = 'https://localhost:8443';

interface ExternalLink {
  label: string;
  href: string;
}

export function getExternalLinks(node: ToolNode): ExternalLink[] {
  const links: ExternalLink[] = [];

  const dagId = node.config?.dagId as string | undefined;

  if (dagId) {
    links.push({ label: 'Airflow DAG Grid', href: `${AIRFLOW_UI_BASE}/dags/${dagId}/grid` });
  }

  if (node.tool === 'apache-airflow') {
    links.push({ label: 'Airflow UI', href: `${AIRFLOW_UI_BASE}/home` });
  }

  if (node.tool === 'apache-nifi') {
    links.push({ label: 'NiFi UI', href: `${NIFI_UI_BASE}/nifi` });
  }

  return links;
}
