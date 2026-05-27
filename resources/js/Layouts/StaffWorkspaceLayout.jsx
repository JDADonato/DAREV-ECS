import React from 'react';
import { Link } from '@inertiajs/react';

const StaffWorkspaceLayout = ({
    brand = 'Eloquente',
    title,
    roleLabel,
    username,
    profileHref = '/profile',
    navGroups = [],
    active,
    onNavigate,
    onLogout,
    children,
}) => {
    return (
        <div className="staff-workspace">
            <aside className="staff-sidebar">
                <div className="staff-sidebar-brand">
                    <p>{brand}</p>
                    <h1>{title}</h1>
                </div>

                <nav className="staff-sidebar-nav custom-scrollbar">
                    {navGroups.map((group) => (
                        <section key={group.label} className="staff-sidebar-group">
                            <p>{group.label}</p>
                            {group.items.map((item) => (
                                <button
                                    key={item.id}
                                    type="button"
                                    onClick={() => onNavigate(item.id)}
                                    className={`staff-sidebar-item ${active === item.id ? 'is-active' : ''}`}
                                >
                                    <span>{item.label}</span>
                                    {item.count > 0 && <em>{item.count}</em>}
                                </button>
                            ))}
                        </section>
                    ))}
                </nav>

                <div className="staff-sidebar-user">
                    <div>
                        <p>{roleLabel}</p>
                        <strong>{username || 'Staff'}</strong>
                    </div>
                    <div className="staff-sidebar-user-actions">
                        {profileHref && <Link href={profileHref}>Profile</Link>}
                        <button type="button" onClick={onLogout}>Logout</button>
                    </div>
                </div>
            </aside>

            <div className="staff-workspace-main">
                <main>{children}</main>
            </div>
        </div>
    );
};

export default StaffWorkspaceLayout;
