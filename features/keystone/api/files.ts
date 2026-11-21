import type { IncomingMessage } from 'node:http'
import { keystoneContext } from '@/features/keystone/context'
import { hasPermission, type Session } from '@/features/keystone/access'

/**
 * Serves a StoredFile. Public files (lot photos, logo, public certification documents)
 * are open. Private files need staff, or a buyer/client whose company or organisation
 * owns the file.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const sudo = keystoneContext.sudo() as any
  const file = await sudo.prisma.storedFile.findUnique({ where: { id: String(id).slice(0, 60) } })
  if (!file) return new Response('Not found', { status: 404 })

  if (file.visibility !== 'public' && !(await publicByUse(sudo.prisma, file.id))) {
    const context = await keystoneContext.withRequest({ headers: { cookie: request.headers.get('cookie') || '' }, method: 'GET', url: `/api/files/${id}` } as IncomingMessage)
    const session = context.session as Session | undefined
    if (!session) return new Response('Sign in to see this file.', { status: 401 })
    const staff = hasPermission(session, 'canAccessDashboard')
    const user = staff ? null : await sudo.prisma.user.findUnique({ where: { id: session.itemId }, select: { isActive: true, buyerCompanyId: true, clientOrganizationId: true } })
    const owner = Boolean(user?.isActive && (
      (file.ownerBuyerCompanyId && user.buyerCompanyId === file.ownerBuyerCompanyId) ||
      (file.ownerClientOrganizationId && user.clientOrganizationId === file.ownerClientOrganizationId)
    ))
    if (!staff && !owner) return new Response('Not found', { status: 404 })
  }

  const bytes = Buffer.from(file.data || '', 'base64')
  const inline = /^image\/(png|jpe?g|gif|webp)$/.test(file.mimeType) || file.mimeType === 'application/pdf'
  const safeName = String(file.filename || 'file').replace(/[^\w.\- ]+/g, '_')
  return new Response(bytes, {
    headers: {
      'Content-Type': inline ? file.mimeType : 'application/octet-stream',
      'Content-Length': String(bytes.length),
      'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename="${safeName}"`,
      'Cache-Control': file.visibility === 'public' ? 'public, max-age=300' : 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'",
    },
  })
}

/** Staff upload these through the list UI, which stores them private by default. */
async function publicByUse(prisma: any, fileId: string) {
  const [lotImage, logo, certification] = await Promise.all([
    prisma.lotImage.findFirst({ where: { imageId: fileId, lot: { status: { not: 'draft' } } }, select: { id: true } }),
    prisma.storeSettings.findFirst({ where: { logoId: fileId }, select: { id: true } }),
    prisma.certification.findFirst({ where: { documentId: fileId, isPublic: true }, select: { id: true } }),
  ])
  return Boolean(lotImage || logo || certification)
}
