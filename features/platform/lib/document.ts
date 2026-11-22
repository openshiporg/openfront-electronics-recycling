/** Plain text ⇄ a Keystone document (one paragraph per blank-line block). Shared by server and client code. */
export function textToDocument(text: string) {
  const blocks = text.replace(/\r/g, '').split(/\n{2,}/).map((b) => b.trim()).filter(Boolean)
  return (blocks.length ? blocks : ['']).map((b) => ({ type: 'paragraph', children: [{ text: b }] }))
}

export function documentToText(doc: unknown): string {
  const walk = (node: any): string => (typeof node?.text === 'string' ? node.text : Array.isArray(node?.children) ? node.children.map(walk).join('') : '')
  return Array.isArray(doc) ? doc.map(walk).filter(Boolean).join('\n\n') : ''
}
