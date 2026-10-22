import { createClient } from '@sanity/client'

export const client = createClient({
  projectId: '1nw5nzux',
  dataset: 'production',
  apiVersion: '2024-01-01',
  useCdn: true,
})