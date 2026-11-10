import Link from "next/link";

export default function NotFound() {
  return (
    <div className="error-boundary">
      <h1>That page does not exist.</h1>
      <p>The desk has four views: triage, pipeline, benchmarks and policy.</p>
      <Link className="button primary" href="/">
        Back to the desk
      </Link>
    </div>
  );
}
