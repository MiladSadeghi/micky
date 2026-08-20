import type { SVGProps } from 'react'

export type MickyLogoProps = SVGProps<SVGSVGElement> & {
  title?: string
}

export function MickyLogo({ title, ...props }: MickyLogoProps): React.JSX.Element {
  return (
    <svg
      viewBox="0 0 72 64"
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      focusable="false"
      {...props}
    >
      {title ? <title>{title}</title> : null}
      <path
        d="M17.3 54C8.8 54 2 47.3 2 38.9c0-7.4 5.3-13.5 12.4-15.1C16.6 14.1 25.2 7 35.5 7c10.5 0 19.2 7.4 21.2 17.4C64.2 25.5 70 31.8 70 39.3 70 47.5 63.3 54 54.8 54H17.3Z"
        fill="var(--micky-logo-fill, #f2e4c8)"
        stroke="var(--micky-logo-ink, #151512)"
        strokeWidth="2.3"
        strokeLinejoin="round"
      />
      <ellipse cx="27.3" cy="37.4" rx="2.8" ry="3.8" fill="var(--micky-logo-ink, #151512)" />
      <ellipse cx="44.3" cy="37.4" rx="2.8" ry="3.8" fill="var(--micky-logo-ink, #151512)" />
      <path
        d="M30.7 43.5c2.7 4.1 7.7 4.1 10.5 0"
        fill="none"
        stroke="var(--micky-logo-ink, #151512)"
        strokeWidth="3.2"
        strokeLinecap="round"
      />
    </svg>
  )
}
