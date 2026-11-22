import { ClientError, GraphQLClient } from 'graphql-request'
import { getAuthHeaders } from '@/features/dashboard/lib/cookies'
import { getGraphQLEndpoint } from '@/features/dashboard/lib/getBaseUrl'

/**
 * The storefront's only way to the backend: the custom operations of §4.9, called
 * with the visitor's own session cookie. No raw list queries.
 */

export const GENERIC_ERROR = 'Something went wrong on our side. Nothing was changed. Try again in a minute.'

export type Read<T> = { ok: true; data: T } | { ok: false; error: string }
export type Command<T = any> = { success: boolean; error: string | null; data: T | null }

function readable(error: unknown) {
  if (!(error instanceof ClientError)) return GENERIC_ERROR
  const message = String(error.response.errors?.[0]?.message || '')
  // Domain refusals (fail()) are short sentences written for the customer.
  if (message && message.length < 300 && !/prisma|invalid `|\n|cannot query|unexpected/i.test(message)) return message
  return GENERIC_ERROR
}

async function client() {
  return new GraphQLClient(await getGraphQLEndpoint(), { headers: (await getAuthHeaders()) || {}, redirect: 'error', cache: 'no-store' } as any)
}

export async function gql<T>(query: string, variables: Record<string, unknown> = {}): Promise<Read<T>> {
  try {
    return { ok: true, data: await (await client()).request<T>(query, variables) }
  } catch (error) {
    return { ok: false, error: readable(error) }
  }
}

const NAME = /^[a-zA-Z]\w{1,60}$/

/** A custom query (JSON). Throws are turned into { ok: false } with plain words. */
export async function op<T = any>(name: string, input: unknown = {}): Promise<Read<T>> {
  if (!NAME.test(name)) return { ok: false, error: GENERIC_ERROR }
  const result = await gql<{ result: T }>(`query Read($input: JSON) { result: ${name}(input: $input) }`, { input })
  return result.ok ? { ok: true, data: result.data.result } : result
}

/** A custom mutation; answers { success, error, data }. */
export async function cmd<T = any>(name: string, input: unknown = {}): Promise<Command<T>> {
  if (!NAME.test(name)) return { success: false, error: GENERIC_ERROR, data: null }
  const result = await gql<{ result: Command<T> }>(`mutation Run($input: JSON) { result: ${name}(input: $input) { success error data } }`, { input })
  if (!result.ok) return { success: false, error: result.error, data: null }
  const outcome = result.data.result
  return outcome?.success ? { success: true, error: null, data: outcome.data } : { success: false, error: outcome?.error || GENERIC_ERROR, data: null }
}
