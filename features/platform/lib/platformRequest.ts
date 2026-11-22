import { ClientError, GraphQLClient } from 'graphql-request'
import { getAuthHeaders } from '@/features/dashboard/lib/cookies'
import { getGraphQLEndpoint } from '@/features/dashboard/lib/getBaseUrl'

/**
 * Server-side GraphQL call for platform pages and commands (copied from Openfront
 * Barbershop). Keystone validation and access messages, and our domain refusals, are
 * written for staff, so they are shown; anything else stays generic.
 */
export type PlatformResult<T> = { ok: true; data: T } | { ok: false; error: string }

export const GENERIC = 'This couldn’t be saved. Check the fields and try again.'

function readable(error: unknown): string {
  if (!(error instanceof ClientError)) return GENERIC
  const first = error.response.errors?.[0]
  const code = first?.extensions?.code
  const message = String(first?.message || '')
  if (code === 'KS_VALIDATION_FAILURE') {
    const lines = message.split('\n').slice(1).map((line) => line.replace(/^\s*-\s*/, '').replace(/^[\w.]+:\s*/, '').trim()).filter(Boolean)
    return lines.join(' ') || GENERIC
  }
  if (code === 'KS_ACCESS_DENIED') return 'Your role doesn’t allow this.'
  if (code === 'KS_USER_INPUT_ERROR' || code === 'BAD_USER_INPUT') return 'Some fields are not valid.'
  // Domain refusals thrown by custom queries (fail()) are plain sentences.
  if (message && message.length < 300 && !/prisma|invalid `|\n/i.test(message)) return message
  return GENERIC
}

export async function platformRequest<T>(query: string, variables: Record<string, unknown> = {}): Promise<PlatformResult<T>> {
  try {
    const client = new GraphQLClient(await getGraphQLEndpoint(), { headers: (await getAuthHeaders()) || {}, redirect: 'error' })
    return { ok: true, data: await client.request<T>(query, variables) }
  } catch (error) {
    return { ok: false, error: readable(error) }
  }
}

/** Domain commands answer { success, error, data }; their errors are already staff copy. */
export async function platformCommand(name: string, input: unknown): Promise<{ success: boolean; error: string | null; data?: unknown }> {
  if (!/^[a-zA-Z]\w{1,60}$/.test(name)) return { success: false, error: GENERIC }
  const result = await platformRequest<Record<string, { success: boolean; error?: string | null; data?: unknown }>>(
    `mutation Run($input: JSON) { result: ${name}(input: $input) { success error data } }`,
    { input },
  )
  if (!result.ok) return { success: false, error: result.error }
  const outcome = result.data.result
  return outcome?.success ? { success: true, error: null, data: outcome.data } : { success: false, error: outcome?.error || GENERIC }
}

/** A custom query (JSON result). */
export async function platformQuery<T = any>(name: string, input: unknown = {}): Promise<PlatformResult<T>> {
  if (!/^[a-zA-Z]\w{1,60}$/.test(name)) return { ok: false, error: GENERIC }
  const result = await platformRequest<{ result: T }>(`query Read($input: JSON) { result: ${name}(input: $input) }`, { input })
  return result.ok ? { ok: true, data: result.data.result } : result
}

/** A list query; pages show the error in place of the table. */
export async function listQuery<T = any>(query: string, variables: Record<string, unknown> = {}): Promise<PlatformResult<T>> {
  return platformRequest<T>(query, variables)
}
