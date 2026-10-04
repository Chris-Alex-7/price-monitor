"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

// Arrows jump to the nearest day that has prices; the calendar can pick any day with data in range.
export default function DatePicker({ date, earliest, latest, previous, next }) {
  const router = useRouter();
  const pick = (value) => {
    // Typing a date fires a change for every digit; only go once it is a full date in range.
    if (value >= earliest && value <= latest) router.push(`/?date=${value}`);
  };

  return (
    <div className="datebar">
      {previous ? (
        <Link href={`/?date=${previous}`} title={previous} aria-label="Previous day">‹</Link>
      ) : (
        <span className="off">‹</span>
      )}
      <input
        key={date}
        type="date"
        defaultValue={date}
        min={earliest}
        max={latest}
        onChange={(e) => pick(e.target.value)}
        aria-label="Date"
      />
      {next ? (
        <Link href={`/?date=${next}`} title={next} aria-label="Next day">›</Link>
      ) : (
        <span className="off">›</span>
      )}
    </div>
  );
}
