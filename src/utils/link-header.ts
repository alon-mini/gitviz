export function parseLinkHeader(header: string | null): Record<string, string> {
  if (!header) return {};

  return header.split(',').reduce<Record<string, string>>((links, part) => {
    const match = part.match(/<([^>]+)>;\s*rel="([^"]+)"/);
    if (match) {
      links[match[2]] = match[1];
    }
    return links;
  }, {});
}

export function getPageFromUrl(url: string | undefined): number | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    const page = parsed.searchParams.get('page');
    return page ? Number.parseInt(page, 10) : null;
  } catch {
    return null;
  }
}
