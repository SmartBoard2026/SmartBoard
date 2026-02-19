import { useNavigate } from '@tanstack/react-router'
import { useAuth } from '@/context/auth-provider'
import { ConfirmDialog } from '@/components/confirm-dialog'

interface SignOutDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SignOutDialog({ open, onOpenChange }: SignOutDialogProps) {
  const navigate = useNavigate()
  const { signOut } = useAuth()

  const handleSignOut = async () => {
    await signOut()
    navigate({ to: '/sign-in', replace: true })
  }

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title='Esci'
      desc='Sei sicuro di voler uscire? Dovrai effettuare nuovamente il login per accedere al tuo account.'
      confirmText='Esci'
      destructive
      handleConfirm={handleSignOut}
      className='sm:max-w-sm'
    />
  )
}
