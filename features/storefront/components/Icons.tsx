/** The mark beside the business name: a heavy angled stroke in the house yellow. */
export function LogoMark({ className = 'ar-logo-mark' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 44 32" aria-hidden="true">
      <polygon points="0,32 9,0 19,0 13,22 29,0 44,0 35,32 25,32 31,10 15,32" fill="#fdcc28" />
    </svg>
  )
}
