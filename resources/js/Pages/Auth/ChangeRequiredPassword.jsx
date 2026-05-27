import { useState } from 'react';
import { router } from '@inertiajs/react';
import { Loader2, LockKeyhole } from 'lucide-react';
import AuthShell from '../../Components/auth/AuthShell';
import { useToast } from '../../context/ToastContext';

const ChangeRequiredPassword = () => {
    const toast = useToast();
    const [processing, setProcessing] = useState(false);
    const [errors, setErrors] = useState({});
    const [form, setForm] = useState({
        password: '',
        password_confirmation: '',
    });

    const submit = (event) => {
        event.preventDefault();
        setProcessing(true);
        setErrors({});

        router.post('/password/change-required', form, {
            preserveScroll: true,
            onSuccess: () => toast.success('Password updated.'),
            onError: (nextErrors) => {
                setErrors(nextErrors);
                toast.error('Please check your new password.');
            },
            onFinish: () => setProcessing(false),
        });
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
            </form>
        </AuthShell>
    );
};

export default ChangeRequiredPassword;
