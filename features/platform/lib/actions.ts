'use server'

import { revalidatePath } from 'next/cache'
import { GENERIC, platformCommand, platformQuery, platformRequest } from './platformRequest'

export type ActionResult = { success: boolean; error?: string | null; data?: unknown }

/**
 * One server action for every domain command. It forwards to the GraphQL mutation
 * with the signed-in staff cookie, so the resolver's role check and the domain rules
 * decide; nothing here grants access.
 */
export async function runOperation(name: string, input: unknown): Promise<ActionResult> {
  const result = await platformCommand(name, input)
  if (result.success) revalidatePath('/dashboard/platform', 'layout')
  return result
}

/** Read-only custom query from a client component (previews, bid sheet checks). */
export async function readOperation(name: string, input: unknown): Promise<ActionResult> {
  const result = await platformQuery(name, input)
  return result.ok ? { success: true, data: result.data } : { success: false, error: result.error }
}

const LIST = /^[A-Z][A-Za-z]{1,40}$/

/** Keystone list create/update (list ops in the feature matrix). Keystone access applies. */
export async function saveItem(listKey: string, id: string | null, data: Record<string, unknown>): Promise<ActionResult> {
  if (!LIST.test(listKey)) return { success: false, error: GENERIC }
  const query = id
    ? `mutation Save($id: ID!, $data: ${listKey}UpdateInput!) { item: update${listKey}(where: { id: $id }, data: $data) { id } }`
    : `mutation Save($data: ${listKey}CreateInput!) { item: create${listKey}(data: $data) { id } }`
  const result = await platformRequest<{ item: { id: string } | null }>(query, id ? { id, data } : { data })
  if (!result.ok) return { success: false, error: result.error }
  if (!result.data.item) return { success: false, error: 'Your role doesn’t allow this.' }
  revalidatePath('/dashboard/platform', 'layout')
  return { success: true, data: result.data.item }
}

export async function deleteItem(listKey: string, id: string): Promise<ActionResult> {
  if (!LIST.test(listKey)) return { success: false, error: GENERIC }
  const result = await platformRequest<{ item: { id: string } | null }>(`mutation Remove($id: ID!) { item: delete${listKey}(where: { id: $id }) { id } }`, { id })
  if (!result.ok) return { success: false, error: result.error }
  if (!result.data.item) return { success: false, error: 'This can’t be removed.' }
  revalidatePath('/dashboard/platform', 'layout')
  return { success: true }
}
