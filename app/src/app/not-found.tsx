import Link from "next/link";

export default function NotFound() {
  return (
    <main className="shell" style={{ paddingTop: "5rem", maxWidth: 560 }}>
      <h1>Page not found</h1>
      <p className="lede">That link doesn&apos;t point anywhere on this site.</p>
      <Link className="btn" href="/">
        Back to booking
      </Link>
    </main>
  );
}
