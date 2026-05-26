import React from 'react';

const StaffPageHeader = ({ eyebrow, title, actions, metrics = [] }) => (
    <section className="staff-page-header">
        <div>
            {eyebrow && <p className="marketing-kicker">{eyebrow}</p>}
            <h2>{title}</h2>
        </div>
        {metrics.length > 0 && (
            <div className="staff-header-metrics" style={{ '--metric-count': metrics.length }}>
                {metrics.map((metric) => (
                    <div key={metric.label}>
                        <span>{metric.label}</span>
                        <strong>{metric.value}</strong>
                    </div>
                ))}
            </div>
        )}
        {actions && <div className="staff-header-actions">{actions}</div>}
    </section>
);

export default StaffPageHeader;
