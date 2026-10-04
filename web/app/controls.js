"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { startTransition, useEffect, useOptimistic, useRef, useState } from "react";

const dmy = (date) => date.split("-").reverse().join("/");

// The page address holds the day and the chosen categories, e.g. /?date=2026-10-04&categories=2,6
const pageUrl = (date, categories) => `/?date=${date}` + (categories.length ? `&categories=${categories.join(",")}` : "");

function Arrow({ to, label, categories, children }) {
  if (!to) return <span className="off">{children}</span>;
  return (
    <span className="tip">
      <Link href={pageUrl(to, categories)} aria-label={`${label}: ${dmy(to)}`}>{children}</Link>
      <span className="tip-text below">{`${label}: ${dmy(to)}`}</span>
    </span>
  );
}

// Arrows jump to the nearest day that has prices; the calendar can pick any day with data.
export function DatePicker({ date, earliest, latest, previous, next, today, categories }) {
  const router = useRouter();
  const calendar = useRef(null);
  const pick = (value) => {
    // Typing a date fires a change for every digit; only go once it is a full date in range.
    if (value >= earliest && value <= latest) router.push(pageUrl(value, categories));
  };

  return (
    <>
      {date === today ? (
        <span className="button off">Σήμερα</span>
      ) : (
        <Link className="button" href={pageUrl(today, categories)}>Σήμερα</Link>
      )}
      <div className="datebar">
        <Arrow to={previous} label="Προηγούμενη ημέρα" categories={categories}>‹</Arrow>
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
        <Arrow to={next} label="Επόμενη ημέρα" categories={categories}>›</Arrow>
      </div>
    </>
  );
}

// "All" shows every category; ticking categories shows only those.
export function CategoryFilter({ options, selected, date }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  // Tick boxes right away instead of waiting for the new page to load.
  const [ticked, setTicked] = useOptimistic(selected);
  const box = useRef(null);

  // Close when clicking anywhere else or pressing Escape.
  useEffect(() => {
    if (!open) return;
    const onClick = (e) => !box.current.contains(e.target) && setOpen(false);
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const choose = (ids) => {
    // Ticking every category is the same as "All".
    const next = ids.length === options.length ? [] : options.map((o) => o.id).filter((id) => ids.includes(id));
    startTransition(() => {
      setTicked(next);
      router.push(pageUrl(date, next), { scroll: false });
    });
  };
  const toggle = (id) => choose(ticked.includes(id) ? ticked.filter((t) => t !== id) : [...ticked, id]);

  const label =
    ticked.length === 0 ? "Όλες οι κατηγορίες"
    : ticked.length === 1 ? options.find((o) => o.id === ticked[0]).name
    : `${ticked.length} κατηγορίες`;

  return (
    <div className="filter" ref={box}>
      <button type="button" className="button" onClick={() => setOpen(!open)} aria-expanded={open}>
        {label} <span className="chevron">▾</span>
      </button>
      {open && (
        <div className="menu">
          <label>
            <input type="checkbox" checked={ticked.length === 0} onChange={() => choose([])} /> Όλες
          </label>
          <hr />
          {options.map((o) => (
            <label key={o.id}>
              <input type="checkbox" checked={ticked.includes(o.id)} onChange={() => toggle(o.id)} /> {o.name}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
