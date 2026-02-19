import { createFileRoute, redirect } from '@tanstack/react-router'
import { supabase } from '@/lib/supabase'
import { AuthenticatedLayout } from '@/components/layout/authenticated-layout'

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      throw redirect({ to: '/sign-in' })
    }
  },
  component: AuthenticatedLayout,
})
