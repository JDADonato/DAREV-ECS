import React, { useState } from 'react';
import { usePage, router } from '@inertiajs/react';
import { useToast } from '../../context/ToastContext';
import Modal from '../common/Modal';

const OTPModal = () => {
    const { auth } = usePage().props;
    const user = auth?.user;
    const toast = useToast();
    const [otp, setOtp] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    if (!user || user.email_verified_at || user.role !== 'Client') {
        return null;
    }

    const handleSubmit = (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        router.post('/verify-otp', { otp }, {
            onSuccess: () => {
                setIsSubmitting(false);
                toast.success('Email verified successfully!');
            },
            onError: (errors) => {
                setIsSubmitting(false);
                if (errors.otp) {
                    toast.error(errors.otp);
                }
            }
        });
    };

    const handleResend = () => {
        router.post('/resend-otp', {}, {
            preserveScroll: true,
            onSuccess: () => toast.success('Verification code resent!')
        });
    };

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" style={{ animation: 'fadeIn .3s ease' }}>
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden" style={{ animation: 'imgZoomIn .35s cubic-bezier(0.22,1,0.36,1) both' }}>
                <div className="p-8 text-center bg-gradient-to-br from-red-900 via-red-800 to-red-900">
                    <div className="mx-auto w-16 h-16 rounded-full bg-yellow-500/20 flex items-center justify-center mb-4">
                        <svg className="w-8 h-8 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                    </div>
                    <h3 className="text-white font-display font-bold text-xl mb-2">Verify Your Email</h3>
                    <p className="text-red-100/80 text-sm">We've sent a 6-digit verification code to <br/><strong className="text-yellow-400">{user.email}</strong></p>
                </div>
                <div className="p-6 bg-white space-y-4 text-center">
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <input
                                type="text"
                                maxLength="6"
                                value={otp}
                                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                                placeholder="Enter 6-digit code"
                                className="w-full px-4 py-3 text-center text-2xl tracking-[0.5em] font-bold border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-900 focus:border-transparent outline-none"
                                required
                            />
                        </div>
                        <button 
                            type="submit" 
                            disabled={isSubmitting || otp.length !== 6}
                            className="w-full py-3 px-4 rounded-xl font-bold text-white bg-red-900 hover:bg-red-800 shadow-lg transition-all active:scale-95 disabled:opacity-50"
                        >
                            {isSubmitting ? 'Verifying...' : 'Verify Email'}
                        </button>
                    </form>
                    <p className="text-sm text-gray-500">
                        Didn't receive the code?{' '}
                        <button onClick={handleResend} className="text-red-900 font-bold hover:underline">
                            Resend Code
                        </button>
                    </p>
                    <p className="text-xs text-gray-400 mt-4">
                        If you need to change your email, you can <button onClick={() => router.post('/logout')} className="underline">logout</button> and register again.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default OTPModal;
