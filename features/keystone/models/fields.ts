import { integer, relationship, select, text } from '@keystone-6/core/fields'
import { denyAll } from '../access'
import { nextNumber, type NumberKind } from '../lib/core'

export function humanize(value: string) {
  return value
    .replace(/_/g, ' ')
    .replace(/^./, (c) => c.toUpperCase())
}

function options(values: readonly string[]) {
  return values.map((value) => ({ label: humanize(value), value }))
}

/** Money in minor units (cents). */
export const money = (config: { defaultValue?: number | null; nullable?: boolean; description?: string } = {}) =>
  integer({
    defaultValue: config.nullable ? undefined : (config.defaultValue ?? 0),
    validation: config.nullable ? { min: 0 } : { min: 0, isRequired: true },
    ui: config.description ? { description: config.description } : undefined,
  })

/** An editable choice. */
export const choice = (values: readonly string[], defaultValue?: string, type: 'enum' | 'string' = 'enum') =>
  select({
    type,
    options: options(values),
    ...(defaultValue ? { defaultValue, validation: { isRequired: true } } : {}),
  })

/**
 * A lifecycle status. It cannot be written through the generic list API: the only
 * way to change it is a transition mutation, which runs inside a locked transaction
 * through the domain database client.
 */
export const status = (values: readonly string[], defaultValue: string) =>
  select({
    type: 'enum',
    options: options(values),
    defaultValue,
    validation: { isRequired: true },
    access: { create: denyAll, update: denyAll },
    ui: { createView: { fieldMode: 'hidden' }, itemView: { fieldMode: 'read' } },
  })

/** A server-assigned document number. */
export const documentNumber = () =>
  text({
    isIndexed: 'unique',
    db: { isNullable: true },
    access: { create: denyAll, update: denyAll },
    ui: { createView: { fieldMode: 'hidden' }, itemView: { fieldMode: 'read' } },
  })

/** Read-only in the admin UI; written by mutations only. */
export const readOnly = { access: { create: denyAll, update: denyAll }, ui: { createView: { fieldMode: 'hidden' as const }, itemView: { fieldMode: 'read' as const } } }

/** A stored file (documents, photos, PDFs). Files live in Postgres; see StoredFile. */
export const fileRef = (config: { readOnly?: boolean } = {}) =>
  relationship({
    ref: 'StoredFile',
    ...(config.readOnly ? { access: { create: denyAll, update: denyAll } } : {}),
    ui: { displayMode: 'select', labelField: 'filename', ...(config.readOnly ? { itemView: { fieldMode: 'read' as const }, createView: { fieldMode: 'hidden' as const } } : {}) },
  })

/** One-sided link to a user (actor fields). */
export const userRef = (config: { readOnly?: boolean } = {}) =>
  relationship({
    ref: 'User',
    ...(config.readOnly ? { access: { create: denyAll, update: denyAll }, ui: { itemView: { fieldMode: 'read' as const }, createView: { fieldMode: 'hidden' as const } } } : {}),
  })

export const addressFields = () => ({
  addressLine1: text(),
  addressLine2: text(),
  city: text(),
  region: text(),
  postalCode: text(),
  countryCode: text({ defaultValue: 'US' }),
})

/** resolveInput hook: assign the document number from its database sequence on create. */
export function assignNumber(kind: NumberKind, field: string) {
  return async ({ operation, resolvedData, context }: any) => {
    if (operation === 'create' && !resolvedData[field]) {
      return { ...resolvedData, [field]: await nextNumber(context.prisma, kind) }
    }
    return resolvedData
  }
}

/** An optional unique key (null when absent, so many rows may lack it). */
export const uniqueKey = (config: { hidden?: boolean; readable?: boolean } = {}) =>
  text({
    isIndexed: 'unique',
    db: { isNullable: true },
    ...(config.hidden ? { access: { read: denyAll, create: denyAll, update: denyAll }, ui: { itemView: { fieldMode: 'hidden' as const }, listView: { fieldMode: 'hidden' as const }, createView: { fieldMode: 'hidden' as const } } } : { access: { create: denyAll, update: denyAll }, ui: { itemView: { fieldMode: 'read' as const }, createView: { fieldMode: 'hidden' as const } } }),
  })
