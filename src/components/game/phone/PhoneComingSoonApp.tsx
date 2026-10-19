import { type LucideIcon, Sparkles } from "lucide-react";

export function PhoneComingSoonApp({
  title,
  icon: Icon,
  description,
  onHome,
}: {
  title: string;
  icon: LucideIcon;
  description?: string;
  onHome: () => void;
}) {
  return (
    <div className="phone-coming-soon-screen" role="region" aria-label={`${title} coming soon`}>
      <div className="phone-coming-soon-content">
        <span className="phone-coming-soon-badge">
          <Sparkles className="h-4 w-4" aria-hidden="true" />
          <span>Under Development</span>
        </span>
        <div className="phone-coming-soon-icon">
          <Icon className="h-12 w-12" aria-hidden="true" />
        </div>
        <h2>{title}</h2>
        <p>
          {description ??
            `The ${title} application is being tuned for Osogbo Life. Full features will arrive in an upcoming town update.`}
        </p>
        <div className="phone-coming-soon-actions">
          <button type="button" className="phone-btn-primary" onClick={onHome}>
            Return to Apps
          </button>
        </div>
      </div>
    </div>
  );
}
