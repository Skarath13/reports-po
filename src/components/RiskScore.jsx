import { useEffect, useRef, useState } from 'react';
import { Popover } from 'radix-ui';
import { X } from 'lucide-react';
import './RiskScore.css';

export default function RiskScore({ score, color, description }) {
  const [open, setOpen] = useState(false);
  const modeRef = useRef('hover');
  const closeTimerRef = useRef(null);

  const cancelClose = () => clearTimeout(closeTimerRef.current);
  const changeOpen = (next) => {
    cancelClose();
    setOpen(next);
  };
  const enter = (event) => {
    cancelClose();
    if (event.pointerType !== 'touch' && !open) {
      modeRef.current = 'hover';
      setOpen(true);
    }
  };
  const leave = () => {
    if (modeRef.current !== 'hover') return;
    cancelClose();
    // Allow the pointer to cross the small gap into the breakdown.
    closeTimerRef.current = setTimeout(() => setOpen(false), 120);
  };

  useEffect(() => () => clearTimeout(closeTimerRef.current), []);

  return (
    <Popover.Root open={open} onOpenChange={changeOpen}>
      <Popover.Trigger
        className="risk-score-trigger"
        style={{ color }}
        title=""
        aria-label={`Risk score ${score} out of 100. Show breakdown`}
        onPointerEnter={enter}
        onPointerLeave={leave}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          const next = !(open && modeRef.current === 'click');
          modeRef.current = 'click';
          changeOpen(next);
        }}
      >
        {score}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className="risk-score-popover"
          aria-label="Risk score breakdown"
          side="top"
          align="start"
          sideOffset={6}
          collisionPadding={12}
          onPointerEnter={cancelClose}
          onPointerLeave={leave}
          onOpenAutoFocus={(event) => {
            if (modeRef.current === 'hover') event.preventDefault();
          }}
          onCloseAutoFocus={(event) => {
            if (modeRef.current === 'hover') event.preventDefault();
          }}
        >
          <div className="risk-score-heading">
            <strong>Risk breakdown</strong>
            <Popover.Close aria-label="Close risk breakdown">
              <X size={18} />
            </Popover.Close>
          </div>
          <pre>{description}</pre>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
