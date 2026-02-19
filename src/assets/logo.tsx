import { type SVGProps } from 'react'
import { cn } from '@/lib/utils'

export function Logo({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      id='smartboard-logo'
      viewBox='0 0 24 24'
      xmlns='http://www.w3.org/2000/svg'
      height='24'
      width='24'
      fill='none'
      stroke='currentColor'
      strokeWidth='1.5'
      strokeLinecap='round'
      strokeLinejoin='round'
      className={cn('size-6', className)}
      {...props}
    >
      <title>SmartBoard</title>
      <rect x='3' y='3' width='18' height='18' rx='2' />
      <line x1='3' y1='9' x2='21' y2='9' />
      <line x1='3' y1='15' x2='21' y2='15' />
      <line x1='9' y1='3' x2='9' y2='21' />
      <line x1='15' y1='3' x2='15' y2='21' />
      <rect x='9' y='3' width='6' height='6' fill='currentColor' opacity='0.2' />
      <rect x='3' y='9' width='6' height='6' fill='currentColor' opacity='0.2' />
      <rect x='15' y='9' width='6' height='6' fill='currentColor' opacity='0.2' />
      <rect x='9' y='15' width='6' height='6' fill='currentColor' opacity='0.2' />
    </svg>
  )
}
