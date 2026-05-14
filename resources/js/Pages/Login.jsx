import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Link, router } from '@inertiajs/react';
import { useToast } from '../context/ToastContext';
import logoImg from '../../images/ECS_LOGO.png';

const Login = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const { login } = useAuth();
    const toast = useToast();

    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [rememberMe, setRememberMe] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const result = await login(username, password, rememberMe);

            if (!result.success) {
                setError(result.message);
                toast.error(`Login Error: ${result.message}`);
                setLoading(false);
            }
        } catch (err) {
            toast.error('An unexpected error occurred during login.');
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex font-sans" style={{animation:'fadeIn .4s ease both'}}>
            {/* Left: Brand Panel */}
            <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden items-center justify-center" style={{background:'linear-gradient(135deg, #450a0a, #7f1d1d, #991b1b)'}}>
                <div className="absolute inset-0 opacity-[.06]" style={{backgroundImage:'radial-gradient(circle at 30% 40%,#f0aa0b,transparent 60%)'}} />
                <div className="absolute inset-0 opacity-[.03]" style={{backgroundImage:'radial-gradient(circle at 70% 80%,#f0aa0b,transparent 40%)'}} />
                <div className="relative z-10 text-center px-12 max-w-lg">
                    <img src={logoImg} alt="Eloquente Catering" className="h-20 w-auto mx-auto mb-8 drop-shadow-lg" />
                    <h1 className="font-bold text-3xl mb-4 leading-tight" style={{color:'#ffffff'}}>Welcome Back to<br />Eloquente Catering</h1>
                    <p className="text-sm leading-relaxed" style={{color:'rgba(255,255,255,0.65)'}}>
                        Sign in to manage your bookings, track payments, and access exclusive features for your upcoming events.
                    </p>
                    <div className="mt-12 flex justify-center gap-6 text-xs" style={{color:'rgba(255,255,255,0.35)'}}>
                        <div className="flex items-center gap-2">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                            Secure Login
                        </div>
                        <div className="flex items-center gap-2">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            24/7 Access
                        </div>
                    </div>
                </div>
            </div>

            {/* Right: Form Panel */}
            <div className="flex-1 flex items-center justify-center bg-gray-50 px-4 sm:px-6 lg:px-8 py-12">
                <div className="max-w-md w-full">
                    {/* Back Button */}
                    <Link href="/" className="inline-flex items-center text-sm text-gray-400 hover:text-red-900 transition-colors mb-8">
                        <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                        Back to Home
                    </Link>

                    {/* Mobile Logo */}
                    <div className="lg:hidden flex justify-center mb-6">
                        <img src={logoImg} alt="Eloquente Catering" className="h-14 w-auto" />
                    </div>

                    <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
                        <div className="px-8 py-6 lg:hidden" style={{background:'linear-gradient(90deg, #7f1d1d, #991b1b)'}}>
                            <h2 className="font-bold text-xl" style={{color:'#ffffff'}}>Welcome Back</h2>
                            <p className="text-sm mt-1" style={{color:'rgba(255,255,255,0.65)'}}>Sign in to your account</p>
                        </div>
                        <div className="hidden lg:block px-8 pt-8 pb-2">
                            <h2 className="text-gray-900 font-bold text-2xl">Sign In</h2>
                            <p className="text-gray-500 text-sm mt-1">Enter your credentials to continue</p>
                        </div>

                        <form className="px-8 py-6 space-y-5" onSubmit={handleSubmit}>
                            <div>
                                <label htmlFor="username" className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Username</label>
                                <div className="relative">
                                    <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" /></svg>
                                    <input
                                        id="username"
                                        type="text"
                                        required
                                        className="w-full pl-11 pr-4 py-3.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-900 focus:border-transparent outline-none text-gray-900 font-medium placeholder:text-gray-300 transition-all"
                                        placeholder="Enter your username"
                                        value={username}
                                        onChange={(e) => setUsername(e.target.value)}
                                    />
                                </div>
                            </div>
                            <div>
                                <label htmlFor="password" className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Password</label>
                                <div className="relative">
                                    <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" /></svg>
                                    <input
                                        id="password"
                                        type={showPassword ? 'text' : 'password'}
                                        required
                                        className="w-full pl-11 pr-12 py-3.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-900 focus:border-transparent outline-none text-gray-900 font-medium placeholder:text-gray-300 transition-all"
                                        placeholder="Enter your password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                                    >
                                        {showPassword ? (
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" /></svg>
                                        ) : (
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                        )}
                                    </button>
                                </div>
                            </div>

                            {/* Remember Me */}
                            <div className="flex items-center justify-between">
                                <label className="flex items-center gap-2 cursor-pointer group">
                                    <input
                                        type="checkbox"
                                        checked={rememberMe}
                                        onChange={(e) => setRememberMe(e.target.checked)}
                                        className="h-4 w-4 text-red-900 border-gray-300 rounded focus:ring-red-900 cursor-pointer"
                                    />
                                    <span className="text-sm text-gray-500 group-hover:text-gray-700 transition-colors">Remember me for 30 days</span>
                                </label>
                            </div>

                            {error && (
                                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                                    <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.27 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
                                    {error}
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={loading}
                                className={`w-full py-3.5 rounded-xl font-bold text-sm uppercase tracking-wider transition-all transform active:scale-[.98] shadow-lg ${loading
                                    ? 'bg-red-400 cursor-not-allowed text-white/70'
                                    : 'bg-red-900 text-white hover:bg-red-800 hover:shadow-xl'
                                }`}
                            >
                                {loading ? (
                                    <span className="flex items-center justify-center gap-2">
                                        <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/></svg>
                                        Signing in...
                                    </span>
                                ) : 'Sign In'}
                            </button>
                        </form>

                        <div className="px-8 pb-8 text-center">
                            <p className="text-sm text-gray-500">
                                Don't have an account?{' '}
                                <Link href="/register" className="font-bold text-red-900 hover:text-red-700 transition-colors">
                                    Create one here
                                </Link>
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Login;
