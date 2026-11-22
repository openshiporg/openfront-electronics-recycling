// Keystone 6.5 wraps context.prisma in an extension that catches every Prisma error,
// logs it and *returns* a GraphQLError instead of throwing. Domain code would then
// carry on with an error object as if it were a row: a failed unique insert looks
// like success, an aborted transaction keeps running, and P2002 checks (webhook
// replay, idempotency) never fire. This extension wraps Keystone's and throws again,
// with the original Prisma code and meta, so a failed query always fails.

export class PrismaQueryError extends Error {
  code: string
  meta: unknown
  constructor(message: string, code: string, meta: unknown) {
    super(message)
    this.name = 'PrismaQueryError'
    this.code = code
    this.meta = meta
  }
}

function isKeystonePrismaError(value: unknown): value is { message: string; extensions: Record<string, any> } {
  return Boolean(value && typeof value === 'object' && (value as any).name === 'GraphQLError' && (value as any).extensions?.code === 'KS_PRISMA_ERROR')
}

export function rethrowPrismaErrors(client: any) {
  return client.$extends({
    query: {
      async $allOperations({ args, query }: { args: unknown; query: (args: unknown) => Promise<unknown> }) {
        const result = await query(args)
        if (isKeystonePrismaError(result)) {
          const prisma = result.extensions.prisma ?? {}
          const message = result.extensions.debug?.message ?? result.message
          throw new PrismaQueryError(message, prisma.code ?? 'KS_PRISMA_ERROR', prisma.meta)
        }
        return result
      },
    },
  })
}
