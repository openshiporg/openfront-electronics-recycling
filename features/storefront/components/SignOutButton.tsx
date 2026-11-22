import { LogOut } from 'lucide-react'
import { signOutAction } from '../lib/actions/auth'

export function SignOutButton() {
  return (
    <form action={signOutAction}>
      <button type="submit" className="ar-btn ar-btn-ghost ar-btn-sm"><LogOut size={16} aria-hidden="true" /> Sign out</button>
    </form>
  )
}
