// Copied from Openfront Barbershop: read a request body without trusting Content-Length.
export class BoundedBodyError extends Error {
  constructor(message: string, public readonly status = 400) { super(message) }
}

/** Reads at most maxBytes and returns the exact received bytes. */
export async function boundedRequestBytes(request: Request, maxBytes: number): Promise<Uint8Array> {
  const reader = request.body?.getReader()
  if (!reader) throw new BoundedBodyError('Request body is required')
  let size = 0
  const chunks: Uint8Array[] = []
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > maxBytes) throw new BoundedBodyError('Request body exceeds the supported limit', 413)
      chunks.push(value)
    }
    return new Uint8Array(Buffer.concat(chunks))
  } finally { reader.releaseLock() }
}
