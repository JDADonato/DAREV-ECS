import { useState } from 'react';
import { router, Link } from '@inertiajs/react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import useBookingDraft, { saveBookingDraft } from '../../hooks/useBookingDraft';
import CalendarView from '../../Components/client/CalendarView';
import EventIdentity from '../../Components/client/EventIdentity';
import GuestLogistics from '../../Components/client/GuestLogistics';
import MenuBuilder from '../../Components/client/MenuBuilder';
import EventSurcharges from '../../Components/client/EventSurcharges';
import FoodTastingStep from '../../Components/client/FoodTastingStep';
import BlueprintPanel from '../../Components/client/BlueprintPanel';
import Modal from '../../Components/common/Modal';
import UserDropdown from '../../Components/common/UserDropdown';
import NotificationBell from '../../Components/common/NotificationBell';
import ChatBubble from '../../Components/common/ChatBubble';
import logoImg from '../../../images/ECS_LOGO.png';
import ClientNavbar from '../../Components/common/ClientNavbar';

const BookingWizard = () => {
    const { user } = useAuth();
    const toast = useToast();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const {
        bookingData,
        clearDraft,
        currentStep,
        handleResumeContinue,
        handleResumeStartFresh,
        resumeStep,
        setCurrentStep,
        showResumeModal,
        updateBooking,
    } = useBookingDraft(user, toast);

    const validateStep = (stepToValidate, dataToValidate = bookingData) => {
        if (stepToValidate === 1) {
            if (!dataToValidate.eventType) {
                showModal('error', 'Tell us the occasion', 'Choose the kind of event you are planning so we can shape the next steps around it.');
                return false;
            }
        }
        if (stepToValidate === 2) {
            if (!dataToValidate.date || !dataToValidate.time) {
                showModal('error', 'Choose your schedule', 'Select your preferred date and start time so we can check availability for your event.');
                return false;
            }
        }
        if (stepToValidate === 3) {
            if (!dataToValidate.pax || dataToValidate.pax < 20) {
                showModal('error', 'Guest count needed', 'Please enter at least 20 guests so we can price the event properly.');
                return false;
            }
        }
        if (stepToValidate === 4) {
            const totalDishCount = Object.values(dataToValidate.selectedDishes || {}).reduce((sum, arr) => sum + (arr?.length || 0), 0);
            if (totalDishCount === 0) {
                showModal('error', 'Pick your first dish', 'Choose at least one dish so your event plan has a menu to review.');
                return false;
            }
        }
        if (stepToValidate === 5) {
            if (!dataToValidate.client_full_name || !dataToValidate.client_email || !dataToValidate.client_phone || !dataToValidate.venue_city || !dataToValidate.venue_address_line) {
                showModal('error', 'A few details are needed', 'Complete your contact and venue details so the team knows where and how to prepare.');
                return false;
            }
        }
        return true;
    };

    const nextStep = (skipValidation = false) => {
        if (skipValidation || validateStep(currentStep)) {
            setCurrentStep(prev => prev + 1);
        }
    };
    
    const prevStep = () => setCurrentStep(prev => prev - 1);

    const handleStepperClick = (targetStep) => {
        // Allow backward navigation freely
        if (targetStep < currentStep) {
            setCurrentStep(targetStep);
            return;
        }
        // If clicking forward, ensure all intermediate steps are valid
        for (let s = currentStep; s < targetStep; s++) {
            if (!validateStep(s)) {
                setCurrentStep(s);
                return;
            }
        }
        setCurrentStep(targetStep);
    };

    const [modal, setModal] = useState({
        isOpen: false,
        type: 'info',
        title: '',
        message: '',
        onConfirm: null,
        confirmText: null
    });
    const [isSubmittingBooking, setIsSubmittingBooking] = useState(false);

    const showModal = (type, title, message, onConfirm = null, confirmText = null) => {
        setModal({ isOpen: true, type, title, message, onConfirm, confirmText });
    };

    const closeModal = () => {
        setModal(prev => ({ ...prev, isOpen: false }));
    };

    const submitBooking = async (extraData = {}) => {
        if (isSubmittingBooking) return;
        const merged = { ...bookingData, ...extraData };

        // Full validation pass
        for (let s = 1; s <= 5; s++) {
            if (!validateStep(s, merged)) {
                setCurrentStep(s);
                return;
            }
        }
        if (merged.wantsTasting) {
            if (!merged.tasting_guest_name || !merged.tasting_guest_email || !merged.tasting_preferred_date) {
                showModal('error', 'Missing Tasting Details', 'Please complete the required food tasting information.');
                setCurrentStep(6);
                return;
            }
        }

        if (!user) {
            // Save current booking progress so they can resume after registering
            saveBookingDraft(merged, currentStep);
            showModal('error', 'Save your event plan', 'You have already built your event plan. Create an account to save it, submit it, and continue from your dashboard.', () => router.get('/register'), 'Register Now');
            return;
        }

        // Calculate final total with surcharges
        let transportFee = 0;
        if (merged.venueDistance === 'outside-16-30') transportFee = 1500;
        if (merged.venueDistance === 'outside-31-50') transportFee = 3000;
        
        const highRiseFee = merged.isHighRise ? Math.round((merged.totalCost || 0) * 0.03) : 0;
        const overtimeFee = Math.max(0, (merged.duration || 4) - 4) * 5000;
        const laborSurcharge = highRiseFee + overtimeFee;
        
        const finalTotal = (merged.totalCost || 0) + transportFee + laborSurcharge;

        const payload = {
            user_id: user.id,
            event_date: merged.date,
            event_time: merged.time,
            event_type: merged.eventType,
            pax: merged.pax,
            budget: merged.budget,
            dietary_notes: merged.dietaryNotes,
            package_id: 'custom',
            client_full_name: merged.client_full_name,
            venue_address_line: merged.venue_address_line,
            venue_street: merged.venue_street,
            venue_city: merged.venue_city,
            venue_province: merged.venue_province,
            venue_zip_code: merged.venue_zip_code,
            client_email: merged.client_email,
            client_phone: merged.client_phone,
            venue_distance: merged.venueDistance,
            is_high_rise: merged.isHighRise,
            transport_fee: transportFee,
            labor_surcharge: laborSurcharge,
            total_cost: finalTotal,
            selected_menu: merged.customMenu
        };

        setIsSubmittingBooking(true);
        try {
            const response = await axios.post('/api/bookings', payload);

            // If food tasting requested, submit that too
            if (merged.wantsTasting) {
                try {
                    await axios.post('/api/food-tasting', {
                        guest_name: merged.tasting_guest_name,
                        guest_email: merged.tasting_guest_email,
                        guest_phone: merged.tasting_guest_phone,
                        preferred_date: merged.tasting_preferred_date,
                        preferred_time: merged.tasting_preferred_time,
                        notes: merged.tasting_notes
                    });
                } catch (err) {
                    console.error("Food tasting submission error:", err);
                }
            }

            clearDraft();
            showModal(
                'success',
                'Booking Submitted',
                'Your event plan has been submitted. Open your dashboard to track approval, payments, event details, menu edits, tastings, and messages from the Eloquente team.',
                () => router.get('/dashboard/client'),
                'Go to Dashboard'
            );
        } catch (error) {
            console.error("Submission Error:", error);
            let errorMsg = 'An error occurred while submitting your booking. Please try again.';
            
            if (error.response && error.response.data) {
                const data = error.response.data;
                errorMsg = data.error || data.message || errorMsg;
                
                if (data.errors) {
                    const validationErrors = Object.values(data.errors).flat().join(' ');
                    errorMsg += ' ' + validationErrors;
                }
            }
            
            showModal('error', 'Booking Failed', errorMsg);
        } finally {
            setIsSubmittingBooking(false);
        }
    };

    const totalSteps = 6;

    const stepLabels = [
        { step: 1, label: 'Vision' },
        { step: 2, label: 'Date' },
        { step: 3, label: 'Guests' },
        { step: 4, label: 'Menu' },
        { step: 5, label: 'Details' },
        { step: 6, label: 'Review' }
    ];

    const stepMessages = {
        1: { eyebrow: 'Start with the occasion', greeting: 'What are we helping you celebrate?', icon: <svg className="w-8 h-8 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>, sub: 'Tell us the event first. We will shape the schedule, menu, and details around it.' },
        2: { eyebrow: 'Choose the day', greeting: "Let's find your date", icon: <svg className="w-8 h-8 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>, sub: 'Pick your preferred schedule and we will check capacity right away.' },
        3: { eyebrow: 'Estimate the crowd', greeting: 'Who should we prepare for?', icon: <svg className="w-8 h-8 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>, sub: 'A close estimate is enough. You can still refine details later.' },
        4: { eyebrow: 'Personalize the spread', greeting: 'Build a menu your guests will remember', icon: <svg className="w-8 h-8 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>, sub: 'Choose dishes at your own pace. Your estimate updates as you go.' },
        5: { eyebrow: 'Set the logistics', greeting: 'Where should the team prepare?', icon: <svg className="w-8 h-8 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>, sub: 'Share contact and venue details so setup fees are clear before you submit.' },
        6: { greeting: 'One last thing before we finalize', icon: <svg className="w-8 h-8 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" /></svg>, sub: 'Would you like to taste our dishes before the event?' },
    };

    const progressPercent = Math.round(((currentStep - 1) / (totalSteps - 1)) * 100);

    const navLinks = [
        { name: 'Home', path: '/' },
        { name: 'Menu', path: '/menu' },
        { name: 'Book Now', path: '/book' },
        { name: 'About', path: '/about' },
        { name: 'Contact', path: '/contact' },
    ];

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col font-sans pt-[68px]">
            <ClientNavbar user={user} />
            {/* Navbar */}
            <nav className="hidden bg-brand-red shadow-lg py-4 relative z-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center">
                        <div className="flex-shrink-0 flex items-center">
                            <Link href="/">
                                <img src={logoImg} alt="Eloquente Catering" className="h-12 w-auto object-contain" />
                            </Link>
                        </div>

                        {/* Desktop Menu */}
                        <div className="hidden md:flex items-center space-x-8">
                            {navLinks.map((link) => (
                                <Link
                                    key={link.name}
                                    href={link.path}
                                    className="text-white hover:text-yellow-400 font-medium text-sm uppercase tracking-wider transition-colors"
                                >
                                    {link.name}
                                </Link>
                            ))}

                            <div className="border-l border-white/30 h-6 mx-4"></div>

                            {user ? (
                                <div className="flex items-center gap-2">
                                    <NotificationBell variant="light" />
                                    <UserDropdown 
                                        user={user} 
                                        dashLink={user.role === 'Client' ? '/dashboard/client' : user.role === 'Marketing' ? '/dashboard/marketing' : user.role === 'Accounting' ? '/dashboard/accounting' : '/dashboard/admin'} 
                                    />
                                </div>
                            ) : (
                                <div className="flex items-center space-x-4">
                                    <Link href="/login" className="text-white hover:text-yellow-400 text-sm font-medium uppercase tracking-wider">
                                        Login
                                    </Link>
                                    <Link
                                        href="/register"
                                        className="bg-yellow-500 hover:bg-yellow-400 text-red-900 font-bold py-2 px-6 rounded-full text-xs uppercase tracking-wider transition-transform transform hover:scale-105 shadow-lg"
                                    >
                                        Register
                                    </Link>
                                </div>
                            )}
                        </div>

                        {/* Mobile Menu Button */}
                        <div className="md:hidden flex items-center">
                            <button
                                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                                className="text-white hover:text-gray-200 focus:outline-none"
                            >
                                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    {isMobileMenuOpen ? (
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                    ) : (
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
                                    )}
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Mobile Menu Dropdown */}
                {isMobileMenuOpen && (
                    <div className="md:hidden bg-red-800 absolute top-full left-0 w-full shadow-xl">
                        <div className="px-4 pt-2 pb-4 space-y-2">
                            {navLinks.map((link) => (
                                <Link
                                    key={link.name}
                                    href={link.path}
                                    onClick={() => setIsMobileMenuOpen(false)}
                                    className="block text-white hover:bg-red-700 px-3 py-2 rounded-md text-base font-medium"
                                >
                                    {link.name}
                                </Link>
                            ))}
                            {user ? (
                                <>
                                    <Link href={user.role === 'Client' ? '/dashboard/client' : user.role === 'Marketing' ? '/dashboard/marketing' : user.role === 'Accounting' ? '/dashboard/accounting' : '/dashboard/admin'} className="block text-white hover:bg-red-700 px-3 py-2 rounded-md text-base font-medium" onClick={() => setIsMobileMenuOpen(false)}>
                                        Dashboard
                                    </Link>
                                    <Link href="/profile" className="block text-white hover:bg-red-700 px-3 py-2 rounded-md text-base font-medium" onClick={() => setIsMobileMenuOpen(false)}>
                                        My Profile
                                    </Link>
                                    <button
                                        onClick={() => { router.post('/logout'); setIsMobileMenuOpen(false); }}
                                        className="w-full text-left text-white hover:bg-red-700 px-3 py-2 rounded-md text-base font-medium"
                                    >
                                        Logout
                                    </button>
                                </>
                            ) : (
                                <div className="mt-4 flex flex-col space-y-2">
                                    <Link href="/login" className="block text-center text-white border border-white/30 px-3 py-2 rounded-md" onClick={() => setIsMobileMenuOpen(false)}>Login</Link>
                                    <Link href="/register" className="block text-center bg-yellow-500 text-red-900 px-3 py-2 rounded-md font-bold" onClick={() => setIsMobileMenuOpen(false)}>Register</Link>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </nav>

            {/* Resume Modal */}
            {showResumeModal && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" style={{animation:'fadeIn .3s ease'}}>
                    <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden" style={{animation:'imgZoomIn .35s cubic-bezier(0.22,1,0.36,1) both'}}>
                        <div className="p-8 text-center bg-gradient-to-br from-red-900 via-red-800 to-red-900">
                            <div className="mx-auto w-16 h-16 rounded-full bg-yellow-500/20 flex items-center justify-center mb-4">
                                <svg className="w-8 h-8 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            </div>
                            <h3 className="text-white font-display font-bold text-xl mb-2">Unfinished Booking</h3>
                            <p className="text-red-100/80 text-sm">You were on <span className="text-yellow-400 font-bold">Step {resumeStep}</span> of your booking. Would you like to continue where you left off?</p>
                        </div>
                        <div className="p-6 bg-white space-y-3">
                            <button onClick={handleResumeContinue} className="w-full py-3 px-4 rounded-xl font-bold text-white bg-red-900 hover:bg-red-800 shadow-lg transition-all active:scale-95">Continue Booking</button>
                            <button onClick={handleResumeStartFresh} className="w-full py-3 px-4 rounded-xl font-bold text-red-900 bg-gray-100 hover:bg-gray-200 transition-all active:scale-95">Start a New Booking</button>
                        </div>
                    </div>
                </div>
            )}

            <div className="flex-grow py-8 pt-12">
                <Modal
                isOpen={modal.isOpen}
                onClose={closeModal}
                title={modal.title}
                message={modal.message}
                type={modal.type}
                onConfirm={modal.onConfirm}
                confirmText={modal.confirmText}
            />

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* Back to Home Button */}
                <div className="mb-5">
                    <Link href="/" className="inline-flex items-center text-sm font-medium text-gray-500 hover:text-red-900 transition-colors">
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                        Back to Home
                    </Link>
                </div>

                {/* Main Content: Step + Booking Summary Panel */}
                <div className="flex flex-col lg:flex-row gap-8">
                    {/* Left: Main Card */}
                    <div className="flex-1 bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden flex flex-col min-h-[560px] transition-all duration-300">
                        {/* Top Header inside the card */}
                        <div className="bg-red-950 px-6 py-5 text-white relative overflow-hidden">
                            <div className="absolute inset-0 opacity-[.06]" style={{backgroundImage:'radial-gradient(circle at 20% 50%,#f0aa0b,transparent 60%)'}} />
                            
                            <div className="relative z-10">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-white/10 rounded-2xl flex shrink-0 items-center justify-center shadow-inner backdrop-blur-sm border border-white/20">
                                        {stepMessages[currentStep]?.icon}
                                    </div>
                                    <div className="min-w-0">
                                        <div className="flex flex-wrap items-center gap-3">
                                            <div className="text-yellow-400 text-[10px] font-bold uppercase tracking-widest">{stepMessages[currentStep]?.eyebrow || `Step ${currentStep} of ${totalSteps}`}</div>
                                            <span className="rounded-full bg-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-red-50">{progressPercent}% complete</span>
                                        </div>
                                        <h2 className="text-white font-bold text-2xl leading-tight">{stepMessages[currentStep]?.greeting}</h2>
                                        <p className="text-gray-300 text-sm mt-0.5">{stepMessages[currentStep]?.sub}</p>
                                    </div>
                                </div>

                                <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-6">
                                    {stepLabels.map((item) => (
                                        <button
                                            key={item.step}
                                            type="button"
                                            onClick={() => handleStepperClick(item.step)}
                                            className={`rounded-full border px-3 py-2 text-xs font-black transition ${
                                                currentStep === item.step
                                                    ? 'border-yellow-300 bg-yellow-300 text-red-950 shadow-lg shadow-red-950/20'
                                                    : currentStep > item.step
                                                        ? 'border-white/20 bg-white/15 text-white'
                                                        : 'border-white/10 bg-white/5 text-red-100/60 hover:bg-white/10 hover:text-white'
                                            }`}
                                        >
                                            {currentStep > item.step ? 'Done' : item.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Step Content */}
                        <div className="p-6 flex-1 flex flex-col">
                            <div key={currentStep} className="animate-fadeInUp flex-1">
                        {currentStep === 1 && (
                            <EventIdentity
                                bookingData={bookingData}
                                updateBooking={updateBooking}
                                onNext={nextStep}
                            />
                        )}
                        {currentStep === 2 && (
                            <CalendarView
                                bookingData={bookingData}
                                updateBooking={updateBooking}
                                onNext={nextStep}
                                onBack={prevStep}
                            />
                        )}
                        {currentStep === 3 && (
                            <GuestLogistics
                                bookingData={bookingData}
                                updateBooking={updateBooking}
                                onNext={nextStep}
                                onBack={prevStep}
                            />
                        )}
                        {currentStep === 4 && (
                            <MenuBuilder
                                bookingData={bookingData}
                                updateBooking={updateBooking}
                                onNext={nextStep}
                                onBack={prevStep}
                            />
                        )}
                        {currentStep === 5 && (
                            <EventSurcharges
                                bookingData={bookingData}
                                updateBooking={updateBooking}
                                onNext={nextStep}
                                onBack={prevStep}
                                user={user}
                            />
                        )}
                        {currentStep === 6 && (
                            <FoodTastingStep
                                bookingData={bookingData}
                                updateBooking={updateBooking}
                                onSubmit={submitBooking}
                                onBack={prevStep}
                                isSubmitting={isSubmittingBooking}
                            />
                        )}
                        </div>
                        </div>
                    </div>

                    {/* Right: Booking Summary Sidebar */}
                    <div className="w-full lg:w-[380px] flex-shrink-0 animate-fadeInRight">
                        <BlueprintPanel
                            bookingData={bookingData}
                            currentStep={currentStep}
                        />
                    </div>
                </div>
            </div>
            </div>
            
            {/* Footer */}
            <footer className="bg-gray-900 text-white py-8 mt-auto">
                <div className="max-w-7xl mx-auto px-4 text-center">
                    <p className="font-display font-bold text-lg mb-2">Eloquente Catering</p>
                    <p className="text-gray-400 text-sm">© 2026 All rights reserved.</p>
                </div>
            </footer>
            {/* Chat Bubble */}
            {user && <ChatBubble user={user} />}
        </div>
    );
};

export default BookingWizard;
