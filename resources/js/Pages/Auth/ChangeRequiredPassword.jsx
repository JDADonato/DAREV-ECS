import { useState } from 'react';
import axios from 'axios';
import { usePage } from '@inertiajs/react';
import { Loader2, LockKeyhole } from 'lucide-react';
import AuthShell from '../../Components/auth/AuthShell';
import { useToast } from '../../context/ToastContext';

const dashboardForRole = (role) => {
    if (role === 'Admin') return '/dashboard/admin';
    if (role === 'Marketing') return '/dashboard/marketing';
    if (role === 'Accounting') return '/dashboard/accounting';
    return '/';
};

const ChangeRequiredPassword = () => {
    const toast = useToast();
    const { auth } = usePage().props;
    const [processing, setProcessing] = useState(false);
    const [errors, setErrors] = useState({});
    const [redirectTarget, setRedirectTarget] = useState(null);
    const [form, setForm] = useState({
        password: '',
        password_confirmation: '',
    });

    const signOut = async () => {
        setProcessing(true);

        try {
            await axios.post('/logout');
        } catch (error) {
            // Even if the session is already stale, leave the trapped page.
        } finally {
            window.location.replace('/login');
        }
    };

    const submit = async (event) => {
        event.preventDefault();
        setProcessing(true);
        setErrors({});

        try {
            const response = await axios.post('/password/change-required', form, {
                headers: {
                    Accept: 'application/json',
                },
            });
            const target = response.data?.redirect || dashboardForRole(auth?.user?.role);
            setRedirectTarget(target);

            if (response.data?.must_change_password) {
                toast.error('Password was saved, but your account still needs a password reset. Please try signing in again.');
                return;
            }

            toast.success('Password updated.');
            window.location.replace(target);
            window.setTimeout(() => {
                if (window.location.pathname === '/password/change-required') {
                    window.location.href = target;
                }
            }, 800);
        } catch (error) {
            const nextErrors = error.response?.data?.errors || {};
            setErrors(nextErrors);
            toast.error(error.response?.status === 419
                ? 'Your session expired. Refresh and try again.'
                : 'Please check your new password.');
        } finally {
            setProcessing(false);
        }
    };

    return (
        <AuthShell
            mode="login"
            compact
            simple
            brandTitle="Set your own password."
            brandCopy="For account safety, temporary staff passwords must be replaced before opening the workspace."
            title="Change password"
            subtitle="Use at least 8 characters. Choose something only you know."
            features={[]}
            hideAuthSwitch
            hideHomeLink
        >
            <form className="space-y-5" onSubmit={submit}>
                {['password', 'password_confirmation'].map((field) => (
                    <div key={field}>
                        <label htmlFor={field} className="mb-2 block text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                            {field === 'password' ? 'New password' : 'Confirm password'}
                        </label>
                        <div className="auth-field">
                            <LockKeyhole className="h-5 w-5 text-slate-400" />
                            <input
                                id={field}
                                type="password"
                                required
                                minLength={8}
                                className="auth-input"
                                value={form[field]}
                                onChange={(event) => setForm((current) => ({ ...current, [field]: event.target.value }))}
                            />
                        </div>
                        {errors[field] && <p className="mt-2 text-xs font-bold text-red-700">{errors[field]}</p>}
                    </div>
                ))}

                <button type="submit" disabled={processing} className="auth-submit">
                    {processing ? (
                        <span className="flex items-center justify-center gap-2">
                            <Loader2 className="h-5 w-5 animate-spin" />
                            Updating...
                        </span>
                    ) : 'Update password'}
                </button>

                {redirectTarget && (
                    <a
                        href={redirectTarget}
                        className="block rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-center text-sm font-black text-amber-800 transition hover:bg-amber-100"
                    >
                        Continue to dashboard
                    </a>
                )}

                <button
                    type="button"
                    disabled={processing}
                    onClick={signOut}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                    Sign out and use another account
                </button>
            </form>
        </AuthShell>
    );
};

export default ChangeRequiredPassword;
