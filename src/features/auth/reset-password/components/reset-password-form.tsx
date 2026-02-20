import { useState } from 'react'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate } from '@tanstack/react-router'
import { Loader2, KeyRound } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/context/auth-provider'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { PasswordInput } from '@/components/password-input'

const formSchema = z
  .object({
    password: z
      .string()
      .min(1, 'Inserisci la nuova password')
      .min(7, 'La password deve essere di almeno 7 caratteri'),
    confirmPassword: z.string().min(1, 'Conferma la nuova password'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Le password non coincidono.',
    path: ['confirmPassword'],
  })

export function ResetPasswordForm({
  className,
  ...props
}: React.HTMLAttributes<HTMLFormElement>) {
  const [isLoading, setIsLoading] = useState(false)
  const navigate = useNavigate()
  const { updatePassword } = useAuth()

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { password: '', confirmPassword: '' },
  })

  async function onSubmit(data: z.infer<typeof formSchema>) {
    setIsLoading(true)

    const { error } = await updatePassword(data.password)

    if (error) {
      toast.error(error.message || 'Errore durante il reset della password')
      setIsLoading(false)
      return
    }

    toast.success('Password aggiornata con successo!')
    navigate({ to: '/sign-in', replace: true })
    setIsLoading(false)
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className={cn('grid gap-3', className)}
        {...props}
      >
        <FormField
          control={form.control}
          name='password'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nuova password</FormLabel>
              <FormControl>
                <PasswordInput placeholder='********' {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name='confirmPassword'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Conferma nuova password</FormLabel>
              <FormControl>
                <PasswordInput placeholder='********' {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button className='mt-2' disabled={isLoading}>
          {isLoading ? <Loader2 className='animate-spin' /> : <KeyRound />}
          Aggiorna password
        </Button>
      </form>
    </Form>
  )
}