type StatCardProps = {
    label: string;
    value: string | number;
    helper?: string;
  };
  
  export function StatCard({ label, value, helper }: StatCardProps) {
    return (
      <section className="stat-card">
        <div className="stat-label">{label}</div>
        <div className="stat-value">{value}</div>
        {helper ? <div className="stat-helper">{helper}</div> : null}
      </section>
    );
  }