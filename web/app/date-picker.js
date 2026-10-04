"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef } from "react";

const dmy = (date) => date.split("-").reverse().join("/");

function Arrow({ to, label, children }) {
  if (!to) return <span className="off">{children}</span>;
  return (
    <span className="tip">
      <Link href={`/?date=${to}`} aria-label={`${label}: ${dmy(to)}`}>{children}</Link>
      <span className="tip-text below">{`${label}: ${dmy(to)}`}</span>
    </span>
  );
}

// Arrows jump to the nearest day that has prices; the calendar can pick any day with data.
export default function DatePicker({ date, earliest, latest, previous, next }) {
  const router = useRouter();
  const calendar = useRef(null);
  const pick = (value) => {
    // Typing a date fires a change for every digit; only go once it is a full date in range.
    if (value >= earliest && value <= latest) router.push(`/?date=${value}`);
  };

  return (
    <div className="datebar">
      <Arrow to={previous} label="Previous day">‹</Arrow>
      {/* The browser shows date fields in its own format, so we show dd/mm/yyyy and open its calendar. */}
      <div className="datefield">
        <button type="button" onClick={() => calendar.current.showPicker()}>{dmy(date)}</button>
        <input
          ref={calendar}
          key={date}
          type="date"
          defaultValue={date}
          min={earliest}
          max={latest}
          onChange={(e) => pick(e.target.value)}
          tabIndex={-1}
          aria-hidden="true"
        />
      </div>
      <Arrow to={next} label="Next day">›</Arrow>
    </div>
  );
}
