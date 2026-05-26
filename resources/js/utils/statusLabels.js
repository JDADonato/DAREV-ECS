const settledPaymentStatuses = ['Paid', 'Verified', 'Refunded'];

export const paymentTypeLabel = (type) => ({
    Reservation: 'Reservation Fee',
    DownPayment: 'Down Payment',
    Downpayment: 'Down Payment',
    Final: 'Final Payment',
}[type] || type || 'Payment');

export const isSettledPaymentStatus = (status) => ['Paid', 'Verified'].includes(status);

export const customerBookingStatus = (status) => {
    const normalized = String(status || '').toLowerCase();

    if (normalized === 'confirmed' || normalized === 'reserved') {
        return { label: 'Approved', tone: 'success' };
    }
    if (normalized === 'cancelled' || normalized === 'canceled') {
        return { label: 'Cancelled', tone: 'danger' };
    }
    if (normalized === 'completed') {
        return { label: 'Completed', tone: 'neutral' };
    }
    if (normalized === 'pending' || normalized === 'pending review') {
        return { label: 'Being Reviewed', tone: 'warning' };
    }

    return { label: status || 'Being Reviewed', tone: 'warning' };
};

export const customerPaymentStatus = (status, dueDate = null) => {
    const normalized = String(status || '').toLowerCase();
    const isOverdue = dueDate && new Date(dueDate) < new Date() && !settledPaymentStatuses.map(item => item.toLowerCase()).includes(normalized);

    if (isOverdue) {
        return { label: 'Overdue', tone: 'danger' };
    }
    if (normalized === 'paid' || normalized === 'verified') {
        return { label: 'Paid', tone: 'success' };
    }
    if (normalized === 'refunded') {
        return { label: 'Refunded', tone: 'neutral' };
    }
    if (normalized === 'rejected' || normalized === 'failed') {
        return { label: 'Needs Review', tone: 'danger' };
    }
    if (normalized === 'pending review') {
        return { label: 'Being Checked', tone: 'warning' };
    }

    return { label: 'Payment Due', tone: 'warning' };
};

export const staffPaymentStatus = (status, dueDate = null) => {
    const normalized = String(status || '').toLowerCase();
    const isOverdue = dueDate && new Date(dueDate) < new Date() && !settledPaymentStatuses.map(item => item.toLowerCase()).includes(normalized);

    if (isOverdue) {
        return { label: 'Overdue', tone: 'danger' };
    }
    if (normalized === 'paid') {
        return { label: 'Paid Online', tone: 'success' };
    }
    if (normalized === 'verified') {
        return { label: 'Verified', tone: 'success' };
    }
    if (normalized === 'refunded') {
        return { label: 'Refunded', tone: 'neutral' };
    }
    if (normalized === 'rejected') {
        return { label: 'Rejected', tone: 'neutral' };
    }
    if (normalized === 'failed') {
        return { label: 'Failed', tone: 'danger' };
    }

    return { label: 'Pending', tone: 'warning' };
};

export const statusToneClasses = {
    success: {
        light: 'bg-green-100 text-green-700',
        dark: 'text-green-300',
    },
    warning: {
        light: 'bg-yellow-100 text-yellow-700',
        dark: 'text-[#f0aa0b]',
    },
    danger: {
        light: 'bg-red-100 text-red-700',
        dark: 'text-red-300',
    },
    neutral: {
        light: 'bg-slate-100 text-slate-600',
        dark: 'text-white/65',
    },
};
