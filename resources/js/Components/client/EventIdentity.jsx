import { useState, useEffect } from 'react';

const EventIdentity = ({ bookingData, updateBooking, onNext, onBack }) => {
    const [selected, setSelected] = useState(bookingData.eventType || '');
    const [eventName, setEventName] = useState(bookingData.eventName || '');
    const [eventTypes, setEventTypes] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch('/api/event-types?per_page=50')
            .then(res => res.json())
            .then(data => {
                setEventTypes(Array.isArray(data.data) ? data.data : []);
                setLoading(false);
            })
            .catch(err => {
                console.error('Error fetching event types:', err);
                setLoading(false);
            });
    }, []);

    const handleSelect = (eventType) => {
        setSelected(eventType.label);
        updateBooking({
            eventType: eventType.label,
            eventTypeSlug: eventType.slug,
            package_category: eventType.package_category || 'standard',
            event_applicable_setups: eventType.applicable_setups || [],
            event_security_type: eventType.security_type,
            event_security_label: eventType.security_label,
            event_security_description: eventType.security_description,
        });
    };

    const handleNext = () => {
        if (!selected) return;
        updateBooking({ eventType: selected, eventName });
        onNext(true);
    };

    return (
        <div className="booking-step">
            <div className="booking-step-grid">
                <section className="booking-step-panel">
                    <div className="booking-step-copy">
                        <p className="booking-step-kicker">Occasion</p>
                        <h2>Start with the celebration.</h2>
                        <p>Pick the closest event type and optionally give it a name. This keeps the next choices relevant without asking for too much too early.</p>
                    </div>

                    <label htmlFor="eventName" className="booking-field-label">Event name or note <span>Optional</span></label>
                    <input
                        id="eventName"
                        type="text"
                        value={eventName}
                        onChange={(event) => {
                            setEventName(event.target.value);
                            updateBooking({ eventName: event.target.value });
                        }}
                        placeholder="e.g. Ana and Miguel's wedding"
                        className="booking-input"
                    />
                </section>

                <section className="booking-choice-area">
                    {loading ? (
                        <div className="booking-empty-state">Loading event types...</div>
                    ) : (
                        <div className="booking-event-grid">
                            {eventTypes.map((eventType) => {
                                const isSelected = selected === eventType.label;
                                return (
                                    <button
                                        key={eventType.id}
                                        type="button"
                                        onClick={() => handleSelect(eventType)}
                                        className={`booking-event-option ${isSelected ? 'booking-event-option-active' : ''}`}
                                    >
                                        <span className="booking-event-image" style={{ backgroundImage: `url(${eventType.image})` }} />
                                        <span className="booking-event-content">
                                            <strong>{eventType.label}</strong>
                                            <small>{eventType.description}</small>
                                        </span>
                                        {isSelected && <span className="booking-selected-dot">Selected</span>}
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </section>
            </div>

            <div className="booking-step-actions">
                {onBack ? (
                    <button onClick={onBack} className="booking-secondary-btn">Back</button>
                ) : <span />}
                <button onClick={handleNext} disabled={!selected} className="booking-primary-btn">
                    Continue
                </button>
            </div>
        </div>
    );
};

export default EventIdentity;
