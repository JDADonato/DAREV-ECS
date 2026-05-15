import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';

/**
 * Phase 2: Staff Messaging — WebSocket-powered Ticket/Claiming System.
 *
 * Sidebar split into two tabs:
 *  1. "Unassigned Inquiries" — conversations waiting to be claimed
 *  2. "My Active Chats" — conversations claimed by this staff member
 *
 * When viewing an unassigned inquiry: shows a "Claim Conversation" button.
 * When viewing a claimed chat: shows the text input + "Resolve" button.
 *
 * Preserves existing UI design and Tailwind classes from original StaffMessaging.
 */
const StaffMessaging = () => {
    const { user } = useAuth();
    const [sidebarTab, setSidebarTab] = useState('unassigned'); // 'unassigned' | 'my-chats'
    const [unassigned, setUnassigned] = useState([]);
    const [myChats, setMyChats] = useState([]);
    const [selectedConv, setSelectedConv] = useState(null);
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [sending, setSending] = useState(false);
    const [claiming, setClaiming] = useState(false);
    const [loading, setLoading] = useState(true);
    const [availableStaff, setAvailableStaff] = useState([]);
    const [showTransfer, setShowTransfer] = useState(false);
    const [transferring, setTransferring] = useState(false);
    const messagesEndRef = useRef(null);
    const echoChannelsRef = useRef({});
    const selectedConvRef = useRef(null);

    // Keep ref in sync for use in Echo callbacks
    useEffect(() => { selectedConvRef.current = selectedConv; }, [selectedConv]);

    // ─── Data Fetching ───

    const fetchConversations = useCallback(async () => {
        try {
            const res = await fetch('/api/chat/conversations');
            if (res.ok) {
                const d = await res.json();
                setUnassigned(d.unassigned || []);
                setMyChats(d.my_chats || []);
            }
        } catch (e) { /* silent */ }
        finally { setLoading(false); }
    }, []);

    const fetchMessages = useCallback(async (conversationId) => {
        try {
            const res = await fetch(`/api/chat/conversations/${conversationId}/messages`);
            if (res.ok) { const d = await res.json(); setMessages(d); }
        } catch (e) { /* silent */ }
    }, []);

    // ─── Initial Load + Echo Setup ───

    useEffect(() => {
        fetchConversations();

        // Listen on the staff.queue channel for new/claimed conversations
        if (window.Echo) {
            window.Echo.private('staff.queue')
                .listen('.conversation.created', () => {
                    fetchConversations();
                })
                .listen('.conversation.claimed', () => {
                    fetchConversations();
                });
        }

        // Also poll as fallback (every 8s) in case Echo isn't connected
        const pollInterval = setInterval(fetchConversations, 8000);

        return () => {
            clearInterval(pollInterval);
            if (window.Echo) {
                window.Echo.leave('staff.queue');
            }
        };
    }, [fetchConversations]);

    // ─── Subscribe to Conversation Channel When Selected ───

    useEffect(() => {
        if (!selectedConv || !window.Echo) return;

        const channelName = `conversation.${selectedConv.id}`;

        // Leave previous channel if different
        Object.keys(echoChannelsRef.current).forEach(ch => {
            if (ch !== channelName) {
                window.Echo.leave(ch);
                delete echoChannelsRef.current[ch];
            }
        });

        // Subscribe to new conversation channel
        if (!echoChannelsRef.current[channelName]) {
            const channel = window.Echo.private(channelName)
                .listen('.message.sent', (e) => {
                    // Skip our own messages — already added from HTTP response
                    if (e.messageData.sender_id === user?.id) return;

                    if (selectedConvRef.current?.id === e.conversationId) {
                        setMessages(prev => {
                            if (prev.find(m => m.id === e.messageData.id)) return prev;
                            return [...prev, { ...e.messageData, is_mine: false }];
                        });
                    }
                    fetchConversations();
                });
            echoChannelsRef.current[channelName] = channel;
        }

        return () => {
            // Cleanup on unmount
        };
    }, [selectedConv, fetchConversations]);

    // Auto-scroll
    useEffect(() => {
        if (messagesEndRef.current) messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // ─── Actions ───

    const selectConversation = (conv) => {
        setSelectedConv(conv);
        fetchMessages(conv.id);
    };

    const handleClaim = async () => {
        if (!selectedConv || claiming) return;
        setClaiming(true);
        try {
            const res = await fetch(`/api/chat/conversations/${selectedConv.id}/claim`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            });
            if (res.ok) {
                const d = await res.json();
                setSelectedConv({ ...selectedConv, staff_id: d.conversation.staff_id, staff_name: d.conversation.staff_name });
                setSidebarTab('my-chats');
                fetchConversations();
            } else {
                const err = await res.json();
                alert(err.error || 'Failed to claim conversation.');
            }
        } catch (e) { console.error('Claim failed:', e); }
        finally { setClaiming(false); }
    };

    const handleResolve = async () => {
        if (!selectedConv) return;
        if (!confirm('Are you sure you want to resolve (close) this conversation?')) return;
        try {
            const res = await fetch(`/api/chat/conversations/${selectedConv.id}/resolve`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            });
            if (res.ok) {
                setSelectedConv(null);
                setMessages([]);
                fetchConversations();
            }
        } catch (e) { console.error('Resolve failed:', e); }
    };

    const fetchAvailableStaff = async () => {
        try {
            const res = await fetch('/api/chat/staff/available');
            if (res.ok) setAvailableStaff(await res.json());
        } catch (e) { console.error(e); }
    };

    const handleTransfer = async (staffId) => {
        if (!selectedConv || transferring) return;
        setTransferring(true);
        try {
            const res = await fetch(`/api/chat/conversations/${selectedConv.id}/transfer`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                body: JSON.stringify({ new_staff_id: staffId })
            });
            if (res.ok) {
                setShowTransfer(false);
                setSelectedConv(null);
                setMessages([]);
                fetchConversations();
            } else {
                const err = await res.json();
                alert(err.error || 'Failed to transfer.');
            }
        } catch (e) { console.error('Transfer failed'); }
        finally { setTransferring(false); }
    };

    const handleSend = async (e) => {
        e.preventDefault();
        if (!newMessage.trim() || sending || !selectedConv) return;
        setSending(true);
        try {
            const res = await fetch(`/api/chat/conversations/${selectedConv.id}/messages`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                body: JSON.stringify({ message: newMessage.trim() }),
            });
            if (res.ok) {
                const msg = await res.json();
                setMessages(prev => [...prev, msg]);
                setNewMessage('');
                fetchConversations();
            }
        } catch (e) { console.error('Send failed'); }
        finally { setSending(false); }
    };

    // ─── Booking Card Rendering (preserved from original) ───

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

    // ─── Sidebar Helpers ───

    const currentList = sidebarTab === 'unassigned' ? unassigned : myChats;
    const totalUnread = [...unassigned, ...myChats].reduce((sum, c) => sum + (c.unread_count || 0), 0);
    const isClaimedByMe = selectedConv && selectedConv.staff_id != null;

    // ─── Render ───

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden" style={{ height: '600px' }}>
            <div className="flex h-full">
                {/* Sidebar */}
                <div className="w-80 border-r border-gray-200 flex flex-col flex-shrink-0">
                    {/* Sidebar Header */}
                    <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="text-sm font-bold text-gray-900">Client Messages</h3>
                            {totalUnread > 0 && (
                                <span className="bg-primary-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">{totalUnread} new</span>
                            )}
                        </div>
                        {/* Tab Switcher */}
                        <div className="flex bg-gray-100 rounded-lg p-0.5">
                            <button
                                onClick={() => setSidebarTab('unassigned')}
                                className={`flex-1 py-1.5 text-[11px] font-semibold rounded-md transition-all ${sidebarTab === 'unassigned' ? 'bg-white text-primary-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                Unassigned
                                {unassigned.length > 0 && (
                                    <span className="ml-1 bg-amber-100 text-amber-700 text-[9px] font-bold px-1.5 py-0.5 rounded-full">{unassigned.length}</span>
                                )}
                            </button>
                            <button
                                onClick={() => setSidebarTab('my-chats')}
                                className={`flex-1 py-1.5 text-[11px] font-semibold rounded-md transition-all ${sidebarTab === 'my-chats' ? 'bg-white text-primary-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                My Chats
                                {myChats.length > 0 && (
                                    <span className="ml-1 bg-green-100 text-green-700 text-[9px] font-bold px-1.5 py-0.5 rounded-full">{myChats.length}</span>
                                )}
                            </button>
                        </div>
                    </div>

                    {/* Conversation List */}
                    <div className="flex-1 overflow-y-auto">
                        {loading ? (
                            <div className="p-8 text-center">
                                <div className="animate-spin w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full mx-auto mb-2"></div>
                                <p className="text-xs text-gray-400">Loading conversations...</p>
                            </div>
                        ) : currentList.length === 0 ? (
                            <div className="p-8 text-center">
                                <svg className="w-12 h-12 text-gray-200 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                                <p className="text-sm text-gray-400">
                                    {sidebarTab === 'unassigned' ? 'No unassigned inquiries' : 'No active chats'}
                                </p>
                                <p className="text-xs text-gray-300 mt-1">
                                    {sidebarTab === 'unassigned' ? 'New client messages will appear here' : 'Claim an inquiry to start chatting'}
                                </p>
                            </div>
                        ) : (
                            <div className="divide-y divide-gray-50">
                                {currentList.map(conv => (
                                    <button key={conv.id} onClick={() => selectConversation(conv)}
                                        className={`w-full flex items-center gap-3 px-4 py-3 transition-colors text-left ${selectedConv?.id === conv.id ? 'bg-primary-50 border-l-[3px] border-l-primary-500' : 'hover:bg-gray-50'}`}>
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 ${conv.unread_count > 0 ? 'bg-primary-100 text-primary-700' : 'bg-gray-100 text-gray-500'}`}>
                                            {conv.client_name?.charAt(0).toUpperCase()}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between">
                                                <p className={`text-sm truncate ${conv.unread_count > 0 ? 'font-bold text-gray-900' : 'font-medium text-gray-700'}`}>{conv.client_name}</p>
                                                <span className="text-[10px] text-gray-400 ml-2 flex-shrink-0">{conv.last_message_time}</span>
                                            </div>
                                            {conv.client_email && <p className="text-[10px] text-gray-400 truncate">{conv.client_email}</p>}
                                            <p className="text-xs text-gray-400 truncate mt-0.5">{conv.last_message || 'No messages'}</p>
                                        </div>
                                        {conv.unread_count > 0 && (
                                            <span className="min-w-[20px] h-[20px] flex items-center justify-center bg-primary-600 text-white text-[10px] font-bold rounded-full px-1 flex-shrink-0">{conv.unread_count}</span>
                                        )}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Chat Area */}
                <div className="flex-1 flex flex-col">
                    {!selectedConv ? (
                        <div className="flex-1 flex items-center justify-center">
                            <div className="text-center">
                                <svg className="w-16 h-16 text-gray-200 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                                <p className="text-gray-400 font-medium">Select a conversation</p>
                                <p className="text-xs text-gray-300 mt-1">Choose a client from the left panel to start messaging</p>
                            </div>
                        </div>
                    ) : (
                        <>
                            {/* Chat Header */}
                            <div className="px-5 py-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-bold text-sm">{selectedConv.client_name?.charAt(0).toUpperCase()}</div>
                                    <div>
                                        <p className="text-sm font-bold text-gray-900">{selectedConv.client_name}</p>
                                        <p className="text-[11px] text-gray-400">
                                            {isClaimedByMe ? 'Claimed by you' : (
                                                <span className="text-amber-600 font-medium">⏳ Unassigned — Claim to reply</span>
                                            )}
                                        </p>
                                    </div>
                                </div>
                                {/* Actions (only when claimed) */}
                                {isClaimedByMe && (
                                    <div className="flex items-center gap-2">
                                        <div className="relative">
                                            <button onClick={() => { setShowTransfer(!showTransfer); if (!showTransfer) fetchAvailableStaff(); }}
                                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-primary-600 hover:bg-primary-50 rounded-lg border border-gray-200 hover:border-primary-200 transition-colors">
                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
                                                Transfer
                                            </button>
                                            {showTransfer && (
                                                <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-xl shadow-lg z-10 py-1">
                                                    <div className="px-3 py-2 border-b border-gray-100"><p className="text-xs font-bold text-gray-500">Select Staff</p></div>
                                                    {availableStaff.length === 0 ? (
                                                        <div className="px-3 py-2 text-xs text-gray-400">No staff available</div>
                                                    ) : (
                                                        availableStaff.map(staff => (
                                                            <button key={staff.id} onClick={() => handleTransfer(staff.id)} disabled={transferring}
                                                                className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center justify-between">
                                                                <span>{staff.username}</span>
                                                                <span className="text-[10px] text-gray-400">{staff.role}</span>
                                                            </button>
                                                        ))
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                        <button onClick={handleResolve}
                                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg border border-gray-200 hover:border-red-200 transition-colors">
                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                            Resolve
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Messages */}
                            <div className="flex-1 overflow-y-auto p-5 space-y-3 bg-gray-50/30">
                                {messages.length === 0 ? (
                                    <div className="text-center py-12">
                                        <p className="text-sm text-gray-400">No messages yet</p>
                                    </div>
                                ) : (
                                    messages.map(msg => (
                                        <div key={msg.id} className={`flex ${msg.is_mine ? 'justify-end' : 'justify-start'}`}>
                                            <div className={`max-w-[60%] rounded-2xl px-4 py-2.5 ${msg.is_mine ? 'bg-primary-600 text-white rounded-br-md' : 'bg-white text-gray-800 rounded-bl-md shadow-sm border border-gray-100'}`}>
                                                {!msg.is_mine && <p className="text-[10px] font-bold text-primary-600 mb-0.5">{msg.sender_name}</p>}
                                                {isBookingCard(msg.message) ? renderBookingCard(msg.message, msg.is_mine) : (
                                                    <p className="text-sm leading-relaxed break-words whitespace-pre-wrap">{msg.message}</p>
                                                )}
                                                <p className={`text-[10px] mt-1 ${msg.is_mine ? 'text-white/50' : 'text-gray-400'}`}>
                                                    {msg.time}{msg.is_mine && msg.read_at && ' • Read'}
                                                </p>
                                            </div>
                                        </div>
                                    ))
                                )}
                                <div ref={messagesEndRef} />
                            </div>

                            {/* Input Area OR Claim Button */}
                            {isClaimedByMe ? (
                                <form onSubmit={handleSend} className="border-t border-gray-200 px-4 py-3 flex items-center gap-3 bg-white">
                                    <input type="text" value={newMessage} onChange={(e) => setNewMessage(e.target.value)}
                                        placeholder="Type your reply..." maxLength={2000} autoFocus
                                        className="flex-1 text-sm px-4 py-2.5 rounded-lg bg-gray-100 focus:bg-white focus:ring-2 focus:ring-primary-500/20 border border-gray-200 focus:border-primary-300 outline-none transition-all" />
                                    <button type="submit" disabled={!newMessage.trim() || sending}
                                        className="bg-primary-600 hover:bg-primary-700 disabled:bg-gray-300 text-white px-5 py-2.5 rounded-lg font-medium text-sm transition-colors flex items-center gap-2">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                                        Send
                                    </button>
                                </form>
                            ) : (
                                <div className="border-t border-gray-200 px-4 py-4 bg-amber-50/50">
                                    <button onClick={handleClaim} disabled={claiming}
                                        className="w-full flex items-center justify-center gap-2 bg-primary-600 hover:bg-primary-700 disabled:bg-gray-300 text-white py-3 rounded-lg font-bold text-sm transition-colors shadow-sm">
                                        {claiming ? (
                                            <>
                                                <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
                                                Claiming...
                                            </>
                                        ) : (
                                            <>
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                                Claim This Conversation
                                            </>
                                        )}
                                    </button>
                                    <p className="text-center text-[11px] text-amber-700/60 mt-2">You must claim this conversation before you can reply</p>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default StaffMessaging;
