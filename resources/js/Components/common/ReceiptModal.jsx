import React from 'react';

const ReceiptModal = ({ isOpen, onClose, payment, booking }) => {
    if (!isOpen || !payment || !booking) return null;

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">

                {/* Print Section */}
                <div id="receipt-print-area" className="p-8 bg-white overflow-y-auto">
                    <div className="text-center mb-8 border-b pb-6">
                        <h2 className="text-2xl font-bold font-display text-primary-900 tracking-tight">ELOQUENTE CATERING</h2>
                        <p className="text-sm text-gray-500 mt-1">123 Culinary Ave, Metro Manila, Philippines</p>
                        <p className="text-sm text-gray-500">Contact: +63 917 123 4567 | info@eloquente.com</p>

                        <div className="mt-6 inline-block bg-green-50 text-green-800 px-4 py-2 rounded-full border border-green-200 uppercase tracking-widest font-bold text-sm">
                            Official Receipt
                        </div>
                    </div>

                    <div className="space-y-4 text-sm text-gray-700">
                        <div className="flex justify-between">
                            <span className="font-semibold">Receipt No:</span>
                            <span>#RCPT-{booking.id}-{payment.id}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="font-semibold">Date Verified:</span>
                            <span>{new Date(payment.verified_at || payment.payment_date).toLocaleDateString()}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="font-semibold">Client Name:</span>
                            <span>{booking.client_full_name || booking.username}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="font-semibold">Event Date:</span>
                            <span>{booking.event_date}</span>
                        </div>

                        <div className="mt-6 border-t pt-4">
                            <div className="flex justify-between font-bold text-gray-900">
                                <span>Payment Type:</span>
                                <span>{payment.payment_type} ({payment.payment_method})</span>
                            </div>
                            <div className="flex justify-between text-lg font-bold text-primary-700 mt-2">
                                <span>Amount Paid:</span>
                                <span>₱{payment.amount.toLocaleString()}</span>
                            </div>
                        </div>
                    </div>

                    <div className="mt-10 text-center text-xs text-gray-400 border-t pt-4">
                        <p>This is a computer-generated receipt.</p>
                        <p>Thank you for choosing Eloquente Catering!</p>
                    </div>
                </div>

                {/* Actions (Not Printed) */}
                <div className="bg-gray-50 px-6 py-4 flex justify-end gap-3 border-t print:hidden">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                        Close
                    </button>
                    <button
                        onClick={handlePrint}
                        className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors flex items-center gap-2 shadow-sm"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                        Print PDF
                    </button>
                </div>
            </div>

            <style jsx="true">{`
                @media print {
                    body * {
                        visibility: hidden;
                    }
                    #receipt-print-area, #receipt-print-area * {
                        visibility: visible;
                    }
                    #receipt-print-area {
                        position: absolute;
                        left: 0;
                        top: 0;
                        width: 100%;
                        height: 100%;
                        padding: 20px;
                        background: white;
                    }
                    .print\\:hidden { // Hack to hide buttons in print mode if needed
                        display: none !important;
                    }
                }
            `}</style>
        </div>
    );
};

export default ReceiptModal;
