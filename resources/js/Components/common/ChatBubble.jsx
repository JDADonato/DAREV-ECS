import React, { useState, useEffect, useRef, useCallback } from 'react';
import useSmartRefresh from '../../hooks/useSmartRefresh';

/**
 * Phase 2: Client Chat Bubble — WebSocket-powered.
 *
 * Key changes from Phase 1:
 *  - No staff picker: clients just type and it goes to the general queue
 *  - Listens for Reverb events for instant message updates via Echo
 *  - Typing indicator: "Staff is typing..." shown briefly
 *  - Conversation-based: all messages flow through /api/chat/* endpoints
 *
 * Preserves existing floating bubble UI design and Tailwind classes.
 */
const ChatBubble = ({ user }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [conversation, setConversation] = useState(null);
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [sending, setSending] = useState(false);
    const [unreadTotal, setUnreadTotal] = useState(0);
    const [bookings, setBookings] = useState([]);
    const [showBookingPicker, setShowBookingPicker] = useState(false);
    const [staffTyping, setStaffTyping] = useState(false);
    const [loadingConv, setLoadingConv] = useState(false);
    const messagesEndRef = useRef(null);
    const typingTimeoutRef = useRef(null);
    const echoChannelRef = useRef(null);
    const conversationRef = useRef(null);

    // Keep ref in sync
    useEffect(() => { conversationRef.current = conversation; }, [conversation]);

    // ─── Fetch Data ───

    const fetchUnreadCount = useCallback(async () => {
        try {
            const res = await fetch('/api/chat/unread-count');
            if (res.ok) { const d = await res.json(); setUnreadTotal(d.count); }
        } catch (e) { /* silent */ }
    }, []);

    const fetchConversation = useCallback(async () => {
        try {
            const res = await fetch('/api/chat/conversations');
            if (res.ok) {
                const d = await res.json();
                const convList = d.conversations || [];
                if (convList.length > 0) {
                    setConversation(convList[0]); // Client has one active conversation
                    return convList[0];
                }
            }
        } catch (e) { /* silent */ }
        return null;
    }, []);

    const fetchMessages = useCallback(async (convId) => {
        try {
            const res = await fetch(`/api/chat/conversations/${convId}/messages`);
            if (res.ok) {
                const d = await res.json();
                setMessages(d);
                fetchUnreadCount();
            }
        } catch (e) { /* silent */ }
    }, [fetchUnreadCount]);

    const fetchBookings = async () => {
        try {
            const res = await fetch('/api/chat/my-bookings');
            if (res.ok) setBookings(await res.json());
        } catch (e) { /* silent */ }
    };

    // ─── Unread Count Poll (global, even when closed) ───

    useEffect(() => {
        if (!user) return;
        fetchUnreadCount();
    }, [user, fetchUnreadCount]);

    useSmartRefresh({
        enabled: Boolean(user),
        interval: isOpen ? 15000 : 30000,
        idleAfter: 180000,
        refresh: fetchUnreadCount,
    });

    // ─── Echo: Subscribe When Conversation Exists ───

    useEffect(() => {
        if (!conversation?.id || !window.Echo) return;

        const channelName = `conversation.${conversation.id}`;

        // Avoid double-subscribe
        if (echoChannelRef.current === channelName) return;

        // Leave old channel
        if (echoChannelRef.current) {
            window.Echo.leave(echoChannelRef.current);
        }

        window.Echo.private(channelName)
            .listen('.message.sent', (e) => {
                // Skip our own messages — they're already added from the HTTP response
                if (e.messageData.sender_id === user?.id) return;

                if (conversationRef.current?.id === e.conversationId) {
                    setMessages(prev => {
                        if (prev.find(m => m.id === e.messageData.id)) return prev;
                        return [...prev, { ...e.messageData, is_mine: false }];
                    });

                    setStaffTyping(false);
                }
                fetchUnreadCount();
            })
            .listen('.conversation.claimed', (e) => {
                // Update the local conversation to reflect the claim
                setConversation(prev => prev ? { ...prev, staff_id: e.conversationData.staff_id, staff_name: e.conversationData.staff_name } : prev);
            });

        echoChannelRef.current = channelName;

        return () => {
            // Don't leave on re-render, only on unmount
        };
    }, [conversation?.id, fetchUnreadCount]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (echoChannelRef.current && window.Echo) {
                window.Echo.leave(echoChannelRef.current);
                echoChannelRef.current = null;
            }
        };
    }, []);

    // Auto-scroll
    useEffect(() => {
        if (messagesEndRef.current) messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // ─── Actions ───

    const handleOpen = async () => {
        setIsOpen(true);
        setLoadingConv(true);
        setShowBookingPicker(false);
        fetchBookings();

        const conv = await fetchConversation();
        if (conv) {
            await fetchMessages(conv.id);
        }
        setLoadingConv(false);
    };

    const handleClose = () => {
        setIsOpen(false);
        setShowBookingPicker(false);
    };

    const handleSend = async (e) => {
        e.preventDefault();
        if (!newMessage.trim() || sending) return;
        setSending(true);

        try {
            if (conversation) {
                // Send to existing conversation
                const res = await fetch(`/api/chat/conversations/${conversation.id}/messages`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                    body: JSON.stringify({ message: newMessage.trim() }),
                });
                if (res.ok) {
                    const msg = await res.json();
                    setMessages(prev => [...prev, msg]);
                    setNewMessage('');
                }
            } else {
                // Start new conversation
                const res = await fetch('/api/chat/conversations', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                    body: JSON.stringify({ message: newMessage.trim() }),
                });
                if (res.ok) {
                    const d = await res.json();
                    setConversation(d.conversation);
                    setMessages([d.message]);
                    setNewMessage('');
                }
            }
        } catch (e) { console.error('Send failed'); }
        finally { setSending(false); }
    };

    const shareBooking = async (booking) => {
        if (sending) return;
        setSending(true);
        const text = `📋 BOOKING DETAILS\n━━━━━━━━━━━━━━━\n📅 Date: ${booking.event_date}\n⏰ Time: ${booking.event_time || 'TBD'}\n🎉 Event: ${booking.event_type}\n👥 Guests: ${booking.pax} pax\n📍 Venue: ${booking.venue_city || 'TBD'}\n💰 Total: ₱${Number(booking.total_cost || 0).toLocaleString()}\n📌 Status: ${booking.status}\n━━━━━━━━━━━━━━━`;

        try {
            if (conversation) {
                const res = await fetch(`/api/chat/conversations/${conversation.id}/messages`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                    body: JSON.stringify({ message: text }),
                });
                if (res.ok) {
                    const msg = await res.json();
                    setMessages(prev => [...prev, msg]);
                    setShowBookingPicker(false);
                }
            } else {
                const res = await fetch('/api/chat/conversations', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                    body: JSON.stringify({ message: text }),
                });
                if (res.ok) {
                    const d = await res.json();
                    setConversation(d.conversation);
                    setMessages([d.message]);
                    setShowBookingPicker(false);
                }
            }
        } catch (e) { console.error('Share failed'); }
        finally { setSending(false); }
    };

    // ─── Rendering Helpers ───

    const isBookingCard = (text) => text && text.startsWith('📋 BOOKING DETAILS');

    const renderBookingCard = (text, isMine) => {
        const lines = text.split('\n').filter(l => l.trim() && !l.includes('━'));
        return (
            <div className={`rounded-xl overflow-hidden border ${isMine ? 'border-white/20' : 'border-gray-200'}`}>
                <div className={`px-3 py-2 text-xs font-bold ${isMine ? 'bg-white/10 text-white' : 'bg-primary-50 text-primary-700'}`}>
                    {lines[0]}
                </div>
                <div className={`px-3 py-2 space-y-1 text-xs ${isMine ? 'bg-white/5' : 'bg-white'}`}>
                    {lines.slice(1).map((line, i) => (
                        <p key={i} className={`leading-relaxed ${isMine ? 'text-white/90' : 'text-gray-700'}`}>{line}</p>
                    ))}
                </div>
            </div>
        );
    };

    if (!user) return null;

    return (
        <>
            {/* Floating Bubble Button */}
            {!isOpen && (
                <button onClick={handleOpen} id="chat-bubble"
                    className="fixed bottom-6 right-6 z-50 flex h-16 items-center gap-3 rounded-full border border-white/70 bg-white/95 px-4 pr-5 text-left text-[#1a1a1a] shadow-2xl shadow-black/20 backdrop-blur-md transition-all hover:-translate-y-0.5 hover:shadow-[#720101]/25">
                    <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#720101] text-white shadow-lg shadow-[#720101]/30">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                    </span>
                    <span className="hidden sm:block">
                        <span className="block text-[11px] font-black uppercase tracking-widest text-[#720101]">Support</span>
                        <span className="block text-xs font-bold text-gray-500">Message the team</span>
                    </span>
                    {unreadTotal > 0 && (
                        <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[20px] h-[20px] text-[10px] font-bold text-white bg-[#f0aa0b] rounded-full px-1 shadow-sm animate-pulse">
                            {unreadTotal > 99 ? '99+' : unreadTotal}
                        </span>
                    )}
                </button>
            )}

            {/* Chat Panel */}
            {isOpen && (
                <div className="fixed bottom-6 right-6 w-[calc(100%-2rem)] max-w-[390px] h-[540px] bg-white rounded-3xl shadow-2xl flex flex-col z-50 overflow-hidden border border-gray-200" style={{ animation: 'fadeIn .25s ease' }}>
                    {/* Header */}
                    <div className="px-4 py-4 flex items-center justify-between flex-shrink-0 text-white border-b border-[#5a0101]" style={{ background: 'linear-gradient(90deg, #720101 0%, #3a0101 100%)' }}>
                        <div className="flex items-center gap-2">
                            <svg className="w-5 h-5 text-[#f0aa0b]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                            <div>
                                <h3 className="text-sm font-bold" style={{ color: '#ffffff' }}>Eloquente Support</h3>
                                <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.72)' }}>
                                    {conversation?.staff_name
                                        ? `Chatting with ${conversation.staff_name}`
                                        : (conversation ? 'Waiting for staff...' : 'Send a message to get started')}
                                </p>
                            </div>
                        </div>
                        <button onClick={handleClose} className="text-white/80 hover:text-white p-1 hover:bg-white/10 rounded transition-colors">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    </div>

                    {/* Messages Body */}
                    <div className="flex-1 overflow-y-auto">
                        {loadingConv ? (
                            <div className="flex items-center justify-center h-full">
                                <div className="text-center">
                                    <div className="animate-spin w-6 h-6 border-2 border-[#720101] border-t-transparent rounded-full mx-auto mb-2"></div>
                                    <p className="text-xs text-gray-400">Loading...</p>
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col h-full">
                                <div className="flex-1 overflow-y-auto p-4 space-y-3" style={{ maxHeight: 'calc(520px - 130px)' }}>
                                    {/* Status Indicator */}
                                    {!conversation && (
                                        <div className="text-center py-6">
                                            <div className="w-16 h-16 bg-[#720101]/5 rounded-full flex items-center justify-center mx-auto mb-3">
                                                <svg className="w-8 h-8 text-[#720101]/30" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                                            </div>
                                            <p className="text-sm font-medium text-gray-600">How can we help you?</p>
                                            <p className="text-xs text-gray-400 mt-1">Send a message and our team will respond shortly</p>
                                        </div>
                                    )}

                                    {conversation && messages.length === 0 && (
                                        <div className="text-center py-8">
                                            <p className="text-sm text-gray-400">No messages yet</p>
                                            <p className="text-xs text-gray-300 mt-1">Say hello! 👋</p>
                                        </div>
                                    )}

                                    {messages.map(msg => (
                                        <div key={msg.id} className={`flex ${msg.is_mine ? 'justify-end' : 'justify-start'}`}>
                                            <div className={`max-w-[80%] rounded-2xl px-3.5 py-2 ${msg.is_mine ? 'bg-[#720101] text-white rounded-br-md' : 'bg-gray-100 text-gray-800 rounded-bl-md'}`}>
                                                {!msg.is_mine && msg.sender_name && (
                                                    <p className="text-[10px] font-bold text-[#720101] mb-0.5">{msg.sender_name}</p>
                                                )}
                                                {isBookingCard(msg.message) ? renderBookingCard(msg.message, msg.is_mine) : (
                                                    <p className="text-sm leading-relaxed break-words whitespace-pre-wrap">{msg.message}</p>
                                                )}
                                                <p className={`text-[10px] mt-1 ${msg.is_mine ? 'text-white/50' : 'text-gray-400'}`}>{msg.time}</p>
                                            </div>
                                        </div>
                                    ))}

                                    {/* Typing indicator */}
                                    {staffTyping && (
                                        <div className="flex justify-start">
                                            <div className="bg-gray-100 rounded-2xl rounded-bl-md px-4 py-2.5">
                                                <div className="flex gap-1">
                                                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                                                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                                                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    <div ref={messagesEndRef} />
                                </div>

                                {/* Booking Picker Popup */}
                                {showBookingPicker && (
                                    <div className="border-t border-gray-100 bg-gray-50 max-h-44 overflow-y-auto">
                                        <div className="px-3 py-2 flex items-center justify-between">
                                            <p className="text-xs font-bold text-gray-600">Share a Booking</p>
                                            <button onClick={() => setShowBookingPicker(false)} className="text-gray-400 hover:text-gray-600">
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                            </button>
                                        </div>
                                        {bookings.length === 0 ? (
                                            <p className="text-xs text-gray-400 text-center py-4">No bookings found</p>
                                        ) : (
                                            <div className="px-2 pb-2 space-y-1.5">
                                                {bookings.map(b => (
                                                    <button key={b.id} onClick={() => shareBooking(b)} disabled={sending}
                                                        className="w-full flex items-center gap-2.5 p-2.5 bg-white rounded-lg border border-gray-200 hover:border-primary-300 hover:bg-primary-50/30 transition-all text-left">
                                                        <div className="w-9 h-9 rounded-lg bg-primary-50 flex items-center justify-center flex-shrink-0">
                                                            <span className="text-base">🎉</span>
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-xs font-bold text-gray-900 truncate">{b.event_type}</p>
                                                            <p className="text-[10px] text-gray-400">{b.event_date} • {b.pax} pax • <span className={b.status === 'Confirmed' ? 'text-green-600' : b.status === 'Pending' ? 'text-amber-500' : 'text-gray-500'}>{b.status}</span></p>
                                                        </div>
                                                        <svg className="w-4 h-4 text-gray-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Input bar — always visible (no staff picker needed) */}
                    <form onSubmit={handleSend} className="border-t border-gray-200 px-3 py-2 flex items-center gap-2 bg-white flex-shrink-0">
                        {bookings.length > 0 && (
                            <button type="button" onClick={() => { fetchBookings(); setShowBookingPicker(!showBookingPicker); }}
                                title="Share booking details"
                                className={`w-8 h-8 flex items-center justify-center rounded-full transition-colors flex-shrink-0 ${showBookingPicker ? 'bg-[#720101] text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                            </button>
                        )}
                        <input type="text" value={newMessage} onChange={(e) => setNewMessage(e.target.value)}
                            placeholder="Type a message..."
                            className="flex-1 text-sm px-3 py-2 rounded-full bg-gray-100 focus:bg-white focus:ring-2 focus:ring-[#720101]/20 border border-gray-200 focus:border-[#720101]/30 outline-none transition-all"
                            maxLength={2000} autoFocus />
                        <button type="submit" disabled={!newMessage.trim() || sending}
                            className="w-9 h-9 bg-[#720101] hover:bg-[#5a0101] disabled:bg-gray-300 text-white rounded-full flex items-center justify-center transition-colors flex-shrink-0">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                        </button>
                    </form>
                </div>
            )}
        </>
    );
};

export default ChatBubble;
