import { Link } from 'react-router';

// Any path no other route matches. Task 4 gives it its real copy.
export default function NotFound() {
  return (
    <>
      <h1>404</h1>
      <p>
        <Link to="/">Home</Link>
      </p>
    </>
  );
}
