import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface PageBackButtonProps {
  /** Where to go when there's no in-app history to pop back to. */
  fallbackPath: string;
  label?: string;
  className?: string;
}

/**
 * Back button that pops the in-app history when possible, otherwise navigates
 * to a sensible parent route.
 */
export function PageBackButton({
  fallbackPath,
  label = 'Back',
  className,
}: PageBackButtonProps) {
  const navigate = useNavigate();

  const handleClick = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate(fallbackPath);
    }
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={handleClick}
      className={cn('gap-1.5 -ml-2 text-muted-foreground', className)}
    >
      <ArrowLeft className="h-4 w-4" />
      {label}
    </Button>
  );
}
