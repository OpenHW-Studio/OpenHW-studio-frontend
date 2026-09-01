import React from 'react';

/**
 * AdminCard — base card component that uses admin.css `.ad-card` token class.
 * Extra className is appended for overrides (padding, layout etc.)
 */
const AdminCard = ({ children, className = '', ...props }) => {
    return (
        <div className={`ad-card ${className}`} {...props}>
            {children}
        </div>
    );
};

export default AdminCard;
