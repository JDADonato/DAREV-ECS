import React from 'react';

const Modal = ({ isOpen, onClose, title, message, type = 'info', onConfirm, confirmText }) => {
    if (!isOpen) return null;

    const isSuccess = type === 'success';
    const isError = type === 'error';

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden transform transition-all scale-100 animate-scaleIn">
                <div className={`p-6 text-center ${isSuccess ? 'bg-green-50' : isError ? 'bg-red-50' : 'bg-blue-50'}`}>
                    <div className={`mx-auto flex items-center justify-center h-16 w-16 rounded-full mb-4 ${isSuccess ? 'bg-green-100' : isError ? 'bg-red-100' : 'bg-blue-100'}`}>
                        {isSuccess && (
                            <svg className="h-8 w-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                        )}
                        {isError && (
                            <svg className="h-8 w-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        )}
                        {!isSuccess && !isError && (
                            <svg className="h-8 w-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        )}
                    </div>
                    <h3 className={`text-xl font-bold ${isSuccess ? 'text-green-900' : isError ? 'text-red-900' : 'text-blue-900'}`}>{title}</h3>
                    <p className="mt-2 text-gray-600">{message}</p>
                </div>
                <div className="p-6 bg-white">
                    <button
                        onClick={() => {
                            if (onConfirm) onConfirm();
                            onClose();
                        }}
                        className={`w-full py-3 px-4 rounded-xl font-bold text-white shadow-lg transition-all transform active:scale-95 ${isSuccess
                            ? 'bg-green-600 hover:bg-green-700 shadow-green-200'
                            : isError
                                ? 'bg-red-600 hover:bg-red-700 shadow-red-200'
                                : 'bg-blue-600 hover:bg-blue-700 shadow-blue-200'
                            }`}
                    >
                        {confirmText || (isSuccess ? 'Great!' : isError ? 'Try Again' : 'Okay')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Modal;
