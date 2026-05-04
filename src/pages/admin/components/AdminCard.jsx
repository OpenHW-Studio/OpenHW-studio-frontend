import React from 'react';

const AdminCard = ({ children, className = '', ...props }) => {
    return (
        <div 
            className={`universal-admin-card ${className}`} 
            {...props}
        >
            {children}
        </div>
    );
};

export default AdminCard;
