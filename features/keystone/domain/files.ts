import { audit, fail, inTransaction, requireStaff, str, type Ctx } from '../lib/core'
import { storeUpload, type FileInput } from '../lib/services'

/**
 * Staff uploads that attach a stored file to a record. StoredFile rows are never
 * created through the generic list API (create: denyAll), so each attach target
 * names the record, the permission it needs and whether the file is public.
 */
const TARGETS: Record<string, { perm: any[]; visibility: 'public' | 'private'; purpose: string }> = {
  lot_image: { perm: ['canManageLots'], visibility: 'private', purpose: 'lot_image' },
  logo: { perm: ['canManageSettings'], visibility: 'public', purpose: 'logo' },
  certification_document: { perm: ['canManageSettings', 'canIssueCertificates'], visibility: 'private', purpose: 'certification' },
  vendor_due_diligence: { perm: ['canManageDownstream'], visibility: 'private', purpose: 'vendor_due_diligence' },
}

export async function attachFile(context: Ctx, args: { target: string; id?: string | null; file: FileInput; caption?: string }) {
  const target = TARGETS[str(args.target, 40)] ?? fail('Unknown upload target.')
  const session = requireStaff(context, ...target.perm)
  const id = str(args.id, 60)
  return inTransaction(context, async (tx) => {
    // Lot images stay private files; the file route opens them once the lot is not a draft.
    const stored = await storeUpload(tx, args.file, { purpose: target.purpose, visibility: target.visibility, uploadedById: session.itemId })
    if (!stored) fail('Choose a file.')
    if (args.target !== 'logo' && !id) fail('Choose the record.')
    let entityType = ''
    if (args.target === 'lot_image') {
      if (!/^image\//.test((await tx.storedFile.findUnique({ where: { id: stored.id }, select: { mimeType: true } })).mimeType)) fail('Lot photos must be images.')
      const lot = (await tx.lot.findUnique({ where: { id }, select: { id: true, _count: { select: { images: true } } } })) ?? fail('Lot not found.')
      await tx.lotImage.create({ data: { lotId: lot.id, imageId: stored.id, caption: str(args.caption, 200), sortOrder: lot._count.images } })
      entityType = 'Lot'
    } else if (args.target === 'logo') {
      await tx.storeSettings.update({ where: { id: 1 }, data: { logoId: stored.id } })
      entityType = 'StoreSettings'
    } else if (args.target === 'certification_document') {
      ;(await tx.certification.findUnique({ where: { id } })) ?? fail('Certification not found.')
      await tx.certification.update({ where: { id }, data: { documentId: stored.id } })
      entityType = 'Certification'
    } else {
      ;(await tx.downstreamVendor.findUnique({ where: { id } })) ?? fail('Vendor not found.')
      await tx.downstreamVendor.update({ where: { id }, data: { dueDiligenceFileId: stored.id } })
      entityType = 'DownstreamVendor'
    }
    await audit(tx, { actorId: session.itemId, action: `file.attach.${args.target}`, entityType, entityId: id || '1', after: { fileId: stored.id, filename: stored.filename } })
    return { fileId: stored.id }
  })
}
