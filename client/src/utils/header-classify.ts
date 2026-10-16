const NON_METRIC_HEADER_RE = /(^|[^a-z0-9])id([^a-z0-9]|$)|_id|^id$|名称|名|name/i;

export function isNonMetricHeader(label: string): boolean {
    const text = label.trim();
    if (!text) return false;
    return NON_METRIC_HEADER_RE.test(text);
}
