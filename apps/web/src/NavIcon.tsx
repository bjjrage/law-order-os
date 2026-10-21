export default function NavIcon({ name }: { name: string }) {
  const paths: Record<string, string> = {
    team: "M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M2 21v-2a5 5 0 0 1 5-5h4a5 5 0 0 1 5 5v2 M17 4a4 4 0 0 1 0 7 M22 21v-2a5 5 0 0 0-3-4",
    dashboard: "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z",
    day: "M12 8v5l3 2 M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0",
    clients:
      "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0 M16 3a4 4 0 0 1 0 8 M22 21v-2a4 4 0 0 0-3-4",
    matters: "M3 7h18v14H3z M8 7V3h8v4 M3 12h18 M10 12v3h4v-3",
    agenda: "M3 5h18v16H3z M7 3v4 M17 3v4 M3 10h18 M7 14h2 M13 14h2 M7 18h2",
    work: "M9 3h6v4H9z M7 5H4v16h16V5h-3 M8 12h8 M8 16h5",
    library: "M3 4h5v17H3z M10 4h5v17h-5z M17 5l4-1 3 16-4 1z",
    admin: "M3 6h18 M3 12h18 M3 18h18 M8 3v6 M16 9v6 M10 15v6",
  };
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name] ?? paths.matters} />
    </svg>
  );
}
