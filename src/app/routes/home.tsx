import { Link } from 'react-router';

// Placeholder home until Task 4 brings the real pages.
export default function Home() {
  return (
    <>
      <h1>Bob Chung</h1>
      <nav aria-label="Probe">
        <Link to="/probe/">Probe (NL)</Link> · <Link to="/en/probe/">Probe (EN)</Link>
      </nav>
    </>
  );
}
