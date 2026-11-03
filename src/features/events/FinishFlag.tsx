/** Zielflagge (Karomuster) in Akzentfarbe, kennzeichnet Events. */
export function FinishFlag({ size = 22, className }: { size?: number; className?: string }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 21V3" />
      <rect x="5" y="4" width="14" height="10" rx="1" />
      <path d="M9.5 4v10M14 4v10M5 9h14" strokeWidth="1.5" />
      <path d="M5 4h4.5v5H5zM14 4h5v5h-5zM9.5 9H14v5H9.5z" fill="currentColor" stroke="none" />
    </svg>
  );
}
