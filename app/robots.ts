import type { MetadataRoute } from 'next';
import { siteOrigin } from '@/lib/origin';

export default async function robots(): Promise<MetadataRoute.Robots> {
  const site = await siteOrigin();
  return { rules: [{ userAgent: '*', allow: '/', disallow: ['/admin', '/api', '/gracias'] }], sitemap: `${site}/sitemap.xml` };
}
