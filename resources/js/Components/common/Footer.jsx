import React from 'react';

const Footer = () => {
    return (
        <footer className="bg-gray-900 text-white py-8 mt-auto">
            <div className="max-w-7xl mx-auto px-4 text-center">
                <p className="font-display font-bold text-lg mb-2">Eloquente Catering</p>
                <div className="flex justify-center space-x-4 mb-4 text-sm text-gray-400">
                    <a href="#" className="hover:text-white transition-colors">About Us</a>
                    <a href="#" className="hover:text-white transition-colors">Contact</a>
                    <a href="#" className="hover:text-white transition-colors">Privacy Policy</a>
                    <a href="#" className="hover:text-white transition-colors">Terms of Service</a>
                </div>
                <p className="text-gray-500 text-xs">© 2026 Eloquente Catering Services. All rights reserved.</p>
            </div>
        </footer>
    );
};

export default Footer;
