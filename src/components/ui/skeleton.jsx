// Adapted from shadcn/ui (7c9eaba1c0a6404c990c144a654792e3313c650d); MIT, see licenses/shadcn-ui.md.
import { cn } from '@/lib/utils';
function Skeleton({ className, ...props }) {
  return (
    <div
      data-slot="skeleton"
      className={cn('animate-pulse rounded-md bg-accent', className)}
      {...props}
    />
  );
}
export { Skeleton };
