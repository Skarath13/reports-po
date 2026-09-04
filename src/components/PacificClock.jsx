import { useEffect, useState } from 'react';

const pacificTime = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Los_Angeles',
  hour: 'numeric',
  minute: '2-digit',
  second: '2-digit',
  hour12: true,
});

export default function PacificClock() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const update = () => setNow(new Date());
    const timer = window.setInterval(update, 1000);
    document.addEventListener('visibilitychange', update);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', update);
    };
  }, []);

  return (
    <span className="pacific-clock" aria-live="off">
      <span className="pacific-clock-dot" aria-hidden="true" />
      <span>Pacific time</span>
      <time dateTime={now.toISOString()}>{pacificTime.format(now)}</time>
    </span>
  );
}
