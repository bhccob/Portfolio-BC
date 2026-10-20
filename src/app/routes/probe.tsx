import { Link } from 'react-router';

// A temporary second page that proves the canvas survives client navigation
// between pages and locales. Task 4 removes it.
export default function Probe() {
  return (
    <>
      <h1>Needle probe</h1>
      <nav aria-label="Probe">
        <Link to="/">Home (NL)</Link> · <Link to="/en/">Home (EN)</Link> · <Link to="/probe/">Probe (NL)</Link> ·{' '}
        <Link to="/en/probe/">Probe (EN)</Link>
      </nav>
    </>
  );
}
