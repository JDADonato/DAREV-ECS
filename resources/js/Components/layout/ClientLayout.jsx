import React from 'react';
import { Outlet } from 'react-router-dom';
import ClientNavbar from '../common/ClientNavbar';
import Footer from '../common/Footer';

const ClientLayout = () => {
    return (
        <div className="min-h-screen flex flex-col bg-gray-50">
            <ClientNavbar />
            <div className="flex-grow">
                <Outlet />
            </div>
            <Footer />
        </div>
    );
};

export default ClientLayout;
