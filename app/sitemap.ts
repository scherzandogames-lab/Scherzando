import type { MetadataRoute } from 'next';
import { siteOrigin } from '@/lib/origin';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const site = await siteOrigin();
  return [{ url: `${site}/`, changeFrequency: 'weekly', priority: 1 }];
}
