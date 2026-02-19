import { Link } from '@tanstack/react-router'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { AuthLayout } from '../auth-layout'
import { SignUpForm } from './components/sign-up-form'

export function SignUp() {
  return (
    <AuthLayout>
      <Card className='gap-4'>
        <CardHeader>
          <CardTitle className='text-lg tracking-tight'>
            Crea un account
          </CardTitle>
          <CardDescription>
            Inserisci email e password per registrarti. <br />
            Hai già un account?{' '}
            <Link
              to='/sign-in'
              className='underline underline-offset-4 hover:text-primary'
            >
              Accedi
            </Link>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SignUpForm />
        </CardContent>
      </Card>
    </AuthLayout>
  )
}
