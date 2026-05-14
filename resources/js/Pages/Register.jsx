import React, { useState, useRef, useEffect } from 'react';
import { Link, router } from '@inertiajs/react';
import logoImg from '../../images/ECS_LOGO.png';
const Register = () => {
    const [formData, setFormData] = useState({
        username: '',
        email: '',
        phone: '',
        password: '',
        confirmPassword: ''
    });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const [showTerms, setShowTerms] = useState(false);
    const [agreedToTerms, setAgreedToTerms] = useState(false);
    const [canAgree, setCanAgree] = useState(false);
    const termsRef = useRef(null);

    useEffect(() => {
        if (showTerms && termsRef.current) {
            if (termsRef.current.scrollHeight <= termsRef.current.clientHeight + 5) {
                setCanAgree(true);
            }
        }
    }, [showTerms]);

    const handleTermsScroll = (e) => {
        const { scrollTop, scrollHeight, clientHeight } = e.target;
        if (scrollHeight - scrollTop <= clientHeight + 5) {
            setCanAgree(true);
        }
    };

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        setError('');

        if (formData.password !== formData.confirmPassword) {
            setError("Passwords do not match");
            return;
        }

        if (!agreedToTerms) {
            setError("You must agree to the Terms and Conditions to register.");
            return;
        }

        setLoading(true);

        router.post('/register', {
            username: formData.username,
            password: formData.password,
            email: formData.email,
            phone: formData.phone,
        }, {
            onError: (errors) => {
                const msg = errors.username || errors.password || errors.email || errors.phone || 'Registration failed. Please try again.';
                setError(msg);
                setLoading(false);
            },
            onFinish: () => {
                setLoading(false);
            },
        });
    };

    return (
        <div className="min-h-screen flex font-sans" style={{animation:'fadeIn .4s ease both'}}>
            {/* Left: Brand Panel */}
            <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden items-center justify-center" style={{background:'linear-gradient(135deg, #450a0a, #7f1d1d, #991b1b)'}}>
                <div className="absolute inset-0 opacity-[.06]" style={{backgroundImage:'radial-gradient(circle at 30% 40%,#f0aa0b,transparent 60%)'}} />
                <div className="absolute inset-0 opacity-[.03]" style={{backgroundImage:'radial-gradient(circle at 70% 80%,#f0aa0b,transparent 40%)'}} />
                <div className="relative z-10 text-center px-12 max-w-lg">
                    <img src={logoImg} alt="Eloquente Catering" className="h-20 w-auto mx-auto mb-8 drop-shadow-lg" />
                    <h1 className="font-bold text-3xl mb-4 leading-tight" style={{color:'#ffffff'}}>Join<br />Eloquente Catering</h1>
                    <p className="text-sm leading-relaxed" style={{color:'rgba(255,255,255,0.65)'}}>
                        Create your account to start booking premium catering services for your special events.
                    </p>
                    <div className="mt-12 flex justify-center gap-6 text-xs" style={{color:'rgba(255,255,255,0.35)'}}>
                        <div className="flex items-center gap-2">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                            Browse Menu
                        </div>
                        <div className="flex items-center gap-2">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                            Book Events
                        </div>
                        <div className="flex items-center gap-2">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                            Track Payments
                        </div>
                    </div>
                </div>
            </div>

            {/* Right: Form Panel */}
            <div className="flex-1 flex items-center justify-center bg-gray-50 px-4 sm:px-6 lg:px-8 py-12">
                <div className="max-w-md w-full">
                    <Link href="/" className="inline-flex items-center text-sm text-gray-400 hover:text-red-900 transition-colors mb-8">
                        <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                        Back to Home
                    </Link>

                    <div className="lg:hidden flex justify-center mb-6">
                        <img src={logoImg} alt="Eloquente Catering" className="h-14 w-auto" />
                    </div>

                    <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
                        <div className="px-8 py-6 lg:hidden" style={{background:'linear-gradient(90deg, #7f1d1d, #991b1b)'}}>
                            <h2 className="font-bold text-xl" style={{color:'#ffffff'}}>Create Account</h2>
                            <p className="text-sm mt-1" style={{color:'rgba(255,255,255,0.65)'}}>Fill in your details to get started</p>
                        </div>
                        <div className="hidden lg:block px-8 pt-8 pb-2">
                            <h2 className="text-gray-900 font-bold text-2xl">Create Account</h2>
                            <p className="text-gray-500 text-sm mt-1">Fill in your details to get started</p>
                        </div>

                <form className="px-8 py-6 space-y-4" onSubmit={handleSubmit}>
                    <div>
                        <label htmlFor="username" className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Username</label>
                        <input
                            id="username" name="username" type="text" required
                            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-900 focus:border-transparent outline-none text-gray-900 font-medium placeholder:text-gray-300 transition-all"
                            placeholder="Choose a username" value={formData.username} onChange={handleChange}
                        />
                    </div>
                    <div>
                        <label htmlFor="email" className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Email</label>
                        <input
                            id="email" name="email" type="email" required
                            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-900 focus:border-transparent outline-none text-gray-900 font-medium placeholder:text-gray-300 transition-all"
                            placeholder="your@email.com" value={formData.email} onChange={handleChange}
                        />
                    </div>
                    <div>
                        <label htmlFor="phone" className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Mobile Number</label>
                        <input
                            id="phone" name="phone" type="tel" required
                            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-900 focus:border-transparent outline-none text-gray-900 font-medium placeholder:text-gray-300 transition-all"
                            placeholder="09XX XXX XXXX" value={formData.phone} onChange={handleChange}
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label htmlFor="password" className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Password</label>
                            <input
                                id="password" name="password" type="password" required
                                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-900 focus:border-transparent outline-none text-gray-900 font-medium placeholder:text-gray-300 transition-all"
                                placeholder="••••••••" value={formData.password} onChange={handleChange}
                            />
                        </div>
                        <div>
                            <label htmlFor="confirmPassword" className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Confirm</label>
                            <input
                                id="confirmPassword" name="confirmPassword" type="password" required
                                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-900 focus:border-transparent outline-none text-gray-900 font-medium placeholder:text-gray-300 transition-all"
                                placeholder="••••••••" value={formData.confirmPassword} onChange={handleChange}
                            />
                        </div>
                    </div>

                    <div className="flex items-start pt-2">
                        <div className="flex items-center h-5">
                            <input
                                id="terms" name="terms" type="checkbox"
                                checked={agreedToTerms}
                                onChange={(e) => {
                                    if (e.target.checked && !canAgree) { setShowTerms(true); }
                                    else { setAgreedToTerms(e.target.checked); }
                                }}
                                className="focus:ring-red-900 h-4 w-4 text-red-900 border-gray-300 rounded cursor-pointer"
                            />
                        </div>
                        <div className="ml-3 text-sm">
                            <label htmlFor="terms" className="text-gray-600">
                                I agree to the{' '}
                                <button type="button" onClick={() => setShowTerms(true)} className="font-bold text-red-900 hover:text-red-700 underline">Terms and Conditions</button>
                            </label>
                        </div>
                    </div>

                    {error && (
                        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                            <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.27 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
                            {error}
                        </div>
                    )}

                    <button
                        type="submit" disabled={loading}
                        className={`w-full py-3.5 rounded-xl font-bold text-sm uppercase tracking-wider transition-all transform active:scale-[.98] shadow-lg ${loading ? 'bg-red-400 cursor-not-allowed text-white/70' : 'bg-red-900 text-white hover:bg-red-800 hover:shadow-xl'}`}
                    >
                        {loading ? 'Creating account...' : 'Create Account'}
                    </button>
                </form>
                        <div className="px-8 pb-6 text-center">
                            <p className="text-sm text-gray-500">
                                Already have an account?{' '}
                                <Link href="/login" className="font-bold text-red-900 hover:text-red-700 transition-colors">Sign in</Link>
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Terms and Conditions Modal */}
            {showTerms && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
                    <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col">
                        <div className="p-6 border-b border-gray-200">
                            <h3 className="text-xl font-bold text-gray-900">Terms and Conditions</h3>
                        </div>
                        <div
                            className="p-6 overflow-y-auto flex-1 text-sm text-gray-700 space-y-4"
                            onScroll={handleTermsScroll}
                            ref={termsRef}
                        >
                            <p>Welcome to the Eloquente Catering Services Booking Portal. By accessing our system and reserving our services, you agree to comply with and be bound by the following Terms and Conditions. Please review them carefully.</p>

                            <h4 className="font-bold text-base mt-4">1. Booking & Reservation Policy</h4>
                            <ul className="list-disc pl-5 space-y-2">
                                <li><strong>Lead Time:</strong> All bookings must be finalized at least seven (7) days prior to the event date. The system will automatically block reservations that do not meet this lead time.</li>
                                <li><strong>Capacity Limits:</strong> Eloquente accepts a maximum of 10 events per day or a cumulative total of 3,500 pax per day. If your selected date has reached this operational threshold, the system will not permit the booking.</li>
                                <li><strong>Validation:</strong> A submitted booking is considered Pending until reviewed and officially validated by our Marketing Department regarding venue logistics and schedule feasibility.</li>
                            </ul>

                            <h4 className="font-bold text-base mt-4">2. Payment Terms & Financial Integration</h4>
                            <p>All financial transactions are processed securely through our automated online payment gateway.</p>
                            <ul className="list-disc pl-5 space-y-2">
                                <li><strong>Reservation Fee:</strong> A non-refundable 10% reservation fee of the total contract price is required to officially block your date and generate the Digital Contract.</li>
                                <li><strong>Down Payment:</strong> A 70% down payment must be settled at least one (1) month prior to the event date.</li>
                                <li><strong>Final Payment:</strong> The remaining 20% final payment must be settled at least ten (10) days prior to the event date.</li>
                                <li><strong>Automated Processing:</strong> Upon executing a payment via e-wallet or bank transfer through the system's integrated gateway, the platform will automatically authenticate the funds, update your booking status, and issue a digital receipt to your account dashboard.</li>
                            </ul>

                            <h4 className="font-bold text-base mt-4">3. Surcharges and Additional Fees</h4>
                            <p>To ensure the highest quality of service, specific logistical challenges will incur system surcharges based on the details provided during booking:</p>
                            <ul className="list-disc pl-5 space-y-2">
                                <li><strong>Out-of-Town Fee:</strong> Events located in categorized &quot;Near Provinces&quot; require additional logistics and fuel. A 20% surcharge will be applied to the Total Contract Amount.</li>
                                <li><strong>High-Rise Building Fee:</strong> Venues located in high-rise buildings requiring the use of elevators or stairs for ingress/egress will incur a 3% surcharge based strictly on the Total Food Amount.</li>
                                <li><strong>Overtime Fee:</strong> Catering services extending beyond the standard contracted hours will be billed a flat rate of ₱5,000.00 per extra hour.</li>
                                <li><strong>Hauling Fee:</strong> The hauling fee is variable and is dynamically assessed depending on the final number of guests (pax) and the specific setup requirements requested by the client.</li>
                                <li><strong>Outside Food &amp; Corkage Rules:</strong> Corkage fees for outside food are set by the venue management. However, Eloquente implements the following operational charges for outside food:
                                    <ul className="list-[circle] pl-5 mt-2 space-y-1">
                                        <li>If clients bring their own lechon (roast pig), an extra manpower charge is applied for our staff to chop and serve the lechon.</li>
                                        <li>If clients bring multiple outside food items or alcoholic beverages, specific rental fees will apply for the use of our catering equipment (e.g., chafing dishes, ice supplies) to accommodate these items.</li>
                                    </ul>
                                </li>
                            </ul>

                            <h4 className="font-bold text-base mt-4">4. Outsourced Services &amp; Third-Party Vendors</h4>
                            <ul className="list-disc pl-5 space-y-2">
                                <li>Through the portal, clients may request recommendations for supplementary services (e.g., Emcees, Photographers, Lights &amp; Sounds).</li>
                                <li><strong>Non-Liability:</strong> Eloquente provides these contacts as a courtesy. We do not act as a financial middleman. Clients must negotiate, contract, and pay these third-party vendors directly. Eloquente is not liable for the performance, scheduling, or financial disputes involving outsourced personnel.</li>
                            </ul>

                            <h4 className="font-bold text-base mt-4">5. Client Responsibilities</h4>
                            <ul className="list-disc pl-5 space-y-2">
                                <li><strong>Accuracy of Information:</strong> The client is responsible for providing accurate guest headcounts (pax), correct venue addresses, and specific dietary restrictions via the portal's special notes section.</li>
                                <li><strong>Lock-in Period (7-Day Rule):</strong> Event details, including menu customizations, color motifs, and headcount adjustments, cannot be edited anymore once the event is within seven (7) days of the scheduled date. This strict cutoff is required for final kitchen and logistical preparations. Reductions in pax on the day of the event will not result in a refund.</li>
                            </ul>

                            <h4 className="font-bold text-base mt-4">6. Cancellations &amp; Refunds</h4>
                            <ul className="list-disc pl-5 space-y-2">
                                <li>Cancellations must be formally submitted through the portal's messaging interface.</li>
                                <li>The initial 10% reservation fee is strictly non-refundable to cover preparatory logistics, administrative blocking of the date, and food sourcing.</li>
                                <li><strong>Strict 7-Day Non-Refundable Policy:</strong> Payments cannot be refunded anymore if the cancellation request is made within seven (7) days of the scheduled event date.</li>
                                <li>Refunds for cancelled events outside of the 7-day window (minus the non-refundable 10% reservation fee) are subject to review by Management and will be processed by the Accounting Department.</li>
                            </ul>

                            <p className="font-semibold text-gray-900 mt-4">By clicking &quot;I Agree&quot; during the checkout process, the Client legally acknowledges and accepts all terms, conditions, and surcharges stipulated in this agreement.</p>
                        </div>
                        <div className="p-4 border-t border-gray-200 flex flex-col sm:flex-row justify-between items-center gap-3 bg-gray-50 rounded-b-lg">
                            {!canAgree ? (
                                <div className="text-xs text-primary-600 font-medium animate-pulse">
                                    Please scroll to the bottom to agree &darr;
                                </div>
                            ) : (
                                <div className="text-xs text-green-600 font-medium flex items-center gap-1">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                    You can now agree
                                </div>
                            )}
                            <div className="flex gap-3 w-full sm:w-auto">
                                <button
                                    type="button"
                                    onClick={() => setShowTerms(false)}
                                    className="flex-1 sm:flex-none px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    disabled={!canAgree}
                                    onClick={() => {
                                        setAgreedToTerms(true);
                                        setShowTerms(false);
                                    }}
                                    className={`flex-1 sm:flex-none px-6 py-2 text-sm font-medium rounded-md text-white transition-all duration-200 ${canAgree ? 'bg-primary-600 hover:bg-primary-700 shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500' : 'bg-gray-300 cursor-not-allowed'}`}
                                >
                                    I Agree
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Register;
