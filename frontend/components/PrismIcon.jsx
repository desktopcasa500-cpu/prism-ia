const PATHS = {
  home: <path d="M4 10.5 12 4l8 6.5V20H4z" />,
  search: <><circle cx="10.5" cy="10.5" r="5.5" /><path d="m15 15 4.5 4.5" /></>,
  plus: <><path d="M12 5v14" /><path d="M5 12h14" /></>,
  folder: <path d="M3.5 7.5h6l2-2h3.5l1.3 2H20v10.5H3.5z" />,
  layers: <><rect x="4" y="5" width="16" height="4" rx="1" /><rect x="4" y="10" width="16" height="4" rx="1" /><rect x="4" y="15" width="16" height="4" rx="1" /></>,
  model: <><circle cx="12" cy="12" r="3.2" /><circle cx="12" cy="4" r="1.4" /><circle cx="12" cy="20" r="1.4" /><circle cx="4" cy="12" r="1.4" /><circle cx="20" cy="12" r="1.4" /><path d="M12 8.8V5.4M12 15.2v3.4M8.8 12H5.4M15.2 12h3.4" /></>,
  searchDoc: <><circle cx="10" cy="10" r="5.5" /><path d="m14 14 5 5" /><path d="M7.5 8.5h5M7.5 11h3.5" /></>,
  settings: <><path d="M12 3.5v2M12 18.5v2M20.5 12h-2M5.5 12h-2M18 6l-1.4 1.4M7.4 16.6 6 18M18 18l-1.4-1.4M7.4 7.4 6 6" /><circle cx="12" cy="12" r="3.5" /></>,
  stop: <rect x="7" y="7" width="10" height="10" rx="1.5" />,
  send: <path d="M4 5.5 20 12 4 18.5l2.1-5.1L15 12 6.1 10.6z" />,
  check: <path d="m5.5 12.5 4 4 9-9" />,
  tool: <><path d="m15.5 6.5 2-2a3 3 0 0 0-3.7 3.7l-7 7a3 3 0 1 0 1.9 1.9l7-7a3 3 0 0 0 3.7-3.7z" /><path d="m14 10 2 2" /></>,
  code: <><path d="m8 8-4 4 4 4M16 8l4 4-4 4M13.5 5.5 10.5 18.5" /></>,
  menu: <><path d="M4 7h16M4 12h16M4 17h16" /></>,
  close: <><path d="m6 6 12 12M18 6 6 18" /></>,
  sun: <><circle cx="12" cy="12" r="3.5" /><path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4" /></>,
  moon: <path d="M19 15.4A7.5 7.5 0 0 1 8.6 5a7.6 7.6 0 1 0 10.4 10.4Z" />,
  chevronLeft: <path d="m14.5 5.5-6.5 6.5 6.5 6.5" />,
  chevronRight: <path d="m9.5 5.5 6.5 6.5-6.5 6.5" />,
  copy: <><rect x="8" y="8" width="11" height="11" rx="2" /><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" /></>,

};

export default function PrismIcon({ name, size = 16, strokeWidth = 1.8, className = '' }) {
  return <svg className={`prism-icon ${className}`.trim()} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{PATHS[name] || PATHS.layers}</svg>;
}
