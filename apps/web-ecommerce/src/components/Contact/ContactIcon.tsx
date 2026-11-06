import { useId } from 'react';

// Icons for contact channels. Brand marks (Zalo, Messenger, TikTok) keep their own colors; line icons use currentColor.
type Name = 'phone' | 'zalo' | 'messenger' | 'tiktok' | 'mail' | 'pin' | 'clock' | 'copy' | 'chat' | 'close';

const LINE: Record<Exclude<Name, 'zalo' | 'messenger' | 'tiktok'>, string> = {
  phone:
    'M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z',
  mail: 'M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z m18 2-10 7L2 6',
  pin: 'M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z M15 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0z',
  clock: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z M12 6v6l4 2',
  copy: 'M9 9h13v13H9z M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1',
  chat: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z M8 9h8 M8 13h5',
  close: 'm6 6 12 12 M6 18 18 6',
};

export default function ContactIcon({ name, size = 20 }: { name: Name; size?: number }) {
  const gradient = `mu-messenger-${useId().replace(/:/g, '')}`;
  if (name === 'zalo')
    return (
      <svg width={size} height={size} viewBox="0 0 28 28" aria-hidden="true">
        <circle cx="14" cy="14" r="14" fill="#0068FF" />
        <g transform="translate(4 8) scale(.67)">
          <path
            fill="#fff"
            d="M12.49 10.272v-.45h1.347v6.322h-.77a.576.576 0 0 1-.577-.573v.001a3.27 3.27 0 0 1-1.938.632a3.284 3.284 0 0 1-3.284-3.282a3.284 3.284 0 0 1 3.284-3.282a3.27 3.27 0 0 1 1.937.632zM6.919 7.79v.205c0 .382-.051.694-.3 1.06l-.03.034a8 8 0 0 0-.242.285L2.024 14.8h4.895v.768a.576.576 0 0 1-.577.576H0v-.362c0-.443.11-.641.25-.847L4.858 9.23H.192V7.79zm8.551 8.354a.48.48 0 0 1-.48-.48V7.79h1.441v8.354zM20.693 9.6a3.306 3.306 0 1 1 .002 6.612a3.306 3.306 0 0 1-.002-6.612m-10.14 5.253a1.932 1.932 0 1 0 0-3.863a1.932 1.932 0 0 0 0 3.863m10.14-.003a1.945 1.945 0 1 0 0-3.89a1.945 1.945 0 0 0 0 3.89"
          />
        </g>
      </svg>
    );
  if (name === 'messenger')
    return (
      <svg width={size} height={size} viewBox="0 0 28 28" aria-hidden="true">
        <defs>
          <linearGradient id={gradient} x1="0" y1="1" x2="1" y2="0">
            <stop offset="0" stopColor="#0866FF" />
            <stop offset=".6" stopColor="#A033FF" />
            <stop offset="1" stopColor="#FF5C87" />
          </linearGradient>
        </defs>
        <circle cx="14" cy="14" r="14" fill={`url(#${gradient})`} />
        <path
          fill="#fff"
          d="m7.5 17.2 3.6-5.7a1.8 1.8 0 0 1 2.6-.5l2.9 2.1 4-3-3.6 5.7a1.8 1.8 0 0 1-2.6.5l-2.9-2.1z"
        />
      </svg>
    );
  if (name === 'tiktok')
    return (
      <svg width={size} height={size} viewBox="0 0 28 28" aria-hidden="true">
        <circle cx="14" cy="14" r="14" fill="#111" />
        <path
          fill="#fff"
          d="M18.2 9.1a3.9 3.9 0 0 1-2.7-1.2V15a4 4 0 1 1-3.4-4v2.2a1.9 1.9 0 1 0 1.3 1.8V6.2h2.1a3.9 3.9 0 0 0 2.7 2.3z"
        />
      </svg>
    );
  return (
    <svg
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
      <path d={LINE[name]} />
    </svg>
  );
}
