const paths = {
  search: 'm21 21-4.4-4.4M19 10.5a8.5 8.5 0 1 1-17 0 8.5 8.5 0 0 1 17 0Z',
  box: 'm3 7 9-5 9 5v10l-9 5-9-5V7Zm0 0 9 5 9-5M12 12v10M7.5 4.5l9 5',
  edit: 'm16 3 5 5M4 15 16 3a3.5 3.5 0 0 1 5 5L9 20l-6 1 1-6Z',
  sliders: 'M4 6h10m4 0h2M4 18h2m4 0h10M4 12h2m4 0h10M14 3v6M6 9v6M10 15v6',
  check: 'm5 12 4 4L19 6',
  close: 'm6 6 12 12M6 18 18 6',
  arrow: 'M4 12h16m-6-6 6 6-6 6',
  chevron: 'm6 9 6 6 6-6',
  chat: 'M21 11.5a8.4 8.4 0 0 1-9 8.5 9.8 9.8 0 0 1-4-.8L3 21l1.8-5A9 9 0 1 1 21 11.5Z',
} as const;

export default function ServiceIcon({ name, size = 18 }: { name: keyof typeof paths; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name]} />
    </svg>
  );
}
