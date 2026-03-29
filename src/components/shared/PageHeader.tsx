interface PageHeaderProps {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
}

export function PageHeader({ title, subtitle, children }: PageHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
      <div>
        <h2 className="text-3xl font-display font-bold text-foreground">{title}</h2>
        {subtitle && <p className="text-muted-foreground mt-1">{subtitle}</p>}
      </div>
      {children && (
        <div className="flex items-center gap-3 w-full sm:w-auto">{children}</div>
      )}
    </div>
  );
}
