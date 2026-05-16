import React, { useState, useEffect } from 'react';
import { router } from '@inertiajs/react';

const PackageBuilder = ({ initialPackages, initialMenuItems }) => {
    const [packages, setPackages] = useState(initialPackages || []);
    const [menuItems, setMenuItems] = useState(initialMenuItems || []);
    const [activeTab, setActiveTab] = useState('packages'); // 'packages' or 'menu'
    
    // Package Editing State
    const [editingPackageId, setEditingPackageId] = useState(null);
    const [packageForm, setPackageForm] = useState({ name: '', base_price: 0, description: '' });
    
    // Menu Editing State
    const [editingMenuItemId, setEditingMenuItemId] = useState(null);
    const [menuItemForm, setMenuItemForm] = useState({ price_adj: 0, cost_per_head: 0, is_active: true });
    
    const [saving, setSaving] = useState(false);
    const [toast, setToast] = useState(null);

    const startEditingPackage = (pkg) => {
        setEditingPackageId(pkg.id);
        setPackageForm({
            name: pkg.name,
            base_price: pkg.basePrice || pkg.base_price,
            description: pkg.description || ''
        });
    };

    const savePackage = () => {
        setSaving(true);
        router.put(`/admin/settings/packages/${editingPackageId}`, packageForm, {
            preserveScroll: true,
            onSuccess: () => {
                setToast({ type: 'success', message: 'Package updated successfully.' });
                setEditingPackageId(null);
                // In a full implementation, you might update the local state array here too
            },
            onError: () => setToast({ type: 'error', message: 'Failed to update package.' }),
            onFinish: () => setSaving(false)
        });
    };

    const startEditingMenuItem = (item) => {
        setEditingMenuItemId(item.id);
        setMenuItemForm({
            price_adj: item.price_adj || item.priceAdj || 0,
            cost_per_head: item.cost_per_head || item.costPerHead || 0,
            is_active: item.is_active !== false // default to true
        });
    };

    const saveMenuItem = () => {
        setSaving(true);
        router.put(`/admin/settings/menu-items/${editingMenuItemId}`, menuItemForm, {
            preserveScroll: true,
            onSuccess: () => {
                setToast({ type: 'success', message: 'Menu item updated successfully.' });
                setEditingMenuItemId(null);
            },
            onError: () => setToast({ type: 'error', message: 'Failed to update menu item.' }),
            onFinish: () => setSaving(false)
        });
    };

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="flex border-b border-gray-100">
                <button 
                    onClick={() => setActiveTab('packages')}
                    className={`flex-1 py-4 text-sm font-bold uppercase tracking-widest ${activeTab === 'packages' ? 'bg-[#720101] text-white' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}
                >
                    Preset Packages
                </button>
                <button 
                    onClick={() => setActiveTab('menu')}
                    className={`flex-1 py-4 text-sm font-bold uppercase tracking-widest ${activeTab === 'menu' ? 'bg-[#720101] text-white' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}
                >
                    Menu Pricing & Availability
                </button>
            </div>

            <div className="p-6 sm:p-8">
                {toast && (
                    <div className={`mb-6 p-4 rounded-xl text-sm font-bold border flex items-center gap-2 ${toast.type === 'success' ? 'bg-green-50 text-green-700 border-green-100' : 'bg-red-50 text-red-700 border-red-100'}`}>
                        {toast.message}
                    </div>
                )}

                {activeTab === 'packages' && (
                    <div>
                        <div className="flex justify-between items-center mb-6">
                            <div>
                                <h2 className="text-xl font-display font-bold text-gray-900">Manage Packages</h2>
                                <p className="text-sm text-gray-500">Edit base prices and descriptions for your event packages.</p>
                            </div>
                            <button className="bg-[#1a1a1a] text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-black">
                                + New Package
                            </button>
                        </div>

                        <div className="space-y-4">
                            {packages.length === 0 && <p className="text-gray-500 text-sm">No packages loaded.</p>}
                            {packages.map(pkg => (
                                <div key={pkg.id} className="border border-gray-100 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gray-50">
                                    {editingPackageId === pkg.id ? (
                                        <div className="flex-1 grid gap-4 sm:grid-cols-2">
                                            <input 
                                                type="text" 
                                                value={packageForm.name} 
                                                onChange={(e) => setPackageForm({...packageForm, name: e.target.value})}
                                                className="border rounded-lg p-2 font-bold text-sm"
                                                placeholder="Package Name"
                                            />
                                            <input 
                                                type="number" 
                                                value={packageForm.base_price} 
                                                onChange={(e) => setPackageForm({...packageForm, base_price: e.target.value})}
                                                className="border rounded-lg p-2 font-bold text-sm"
                                                placeholder="Base Price (₱)"
                                            />
                                            <input 
                                                type="text" 
                                                value={packageForm.description} 
                                                onChange={(e) => setPackageForm({...packageForm, description: e.target.value})}
                                                className="border rounded-lg p-2 text-sm sm:col-span-2"
                                                placeholder="Description"
                                            />
                                        </div>
                                    ) : (
                                        <div className="flex-1">
                                            <h4 className="font-bold text-gray-900">{pkg.name} <span className="text-sm font-semibold text-[#720101] ml-2">₱{(pkg.basePrice || pkg.base_price || 0).toLocaleString()}</span></h4>
                                            <p className="text-sm text-gray-500 mt-1">{pkg.description || 'No description'}</p>
                                        </div>
                                    )}

                                    <div className="flex shrink-0 gap-2">
                                        {editingPackageId === pkg.id ? (
                                            <>
                                                <button onClick={() => setEditingPackageId(null)} className="px-4 py-2 text-sm font-bold text-gray-600 bg-white border rounded-lg hover:bg-gray-50">Cancel</button>
                                                <button onClick={savePackage} disabled={saving} className="px-4 py-2 text-sm font-bold text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50">Save</button>
                                            </>
                                        ) : (
                                            <button onClick={() => startEditingPackage(pkg)} className="px-4 py-2 text-sm font-bold text-[#720101] bg-[#720101]/10 rounded-lg hover:bg-[#720101]/20">Edit</button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {activeTab === 'menu' && (
                    <div>
                        <div className="flex justify-between items-center mb-6">
                            <div>
                                <h2 className="text-xl font-display font-bold text-gray-900">Manage Menu Pricing</h2>
                                <p className="text-sm text-gray-500">Add premium surcharges to dishes or mark them inactive to hide from selections.</p>
                            </div>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                            {menuItems.length === 0 && <p className="text-gray-500 text-sm">No menu items loaded.</p>}
                            {menuItems.map(item => (
                                <div key={item.id} className={`border rounded-xl p-4 flex flex-col gap-3 ${item.is_active === false ? 'opacity-50 bg-gray-100' : 'bg-white'}`}>
                                    <div className="flex gap-3 items-start">
                                        <img src={item.image || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c'} alt="" className="w-12 h-12 rounded object-cover" />
                                        <div>
                                            <p className="text-sm font-bold text-gray-900 leading-tight">{item.name}</p>
                                            <p className="text-[10px] uppercase font-bold text-gray-500 mt-1">{item.category}</p>
                                        </div>
                                    </div>

                                    {editingMenuItemId === item.id ? (
                                        <div className="space-y-2 mt-2">
                                            <div className="flex items-center justify-between text-xs font-bold">
                                                <span>Base Cost (₱)</span>
                                                <input type="number" className="w-20 border rounded px-2 py-1 text-right" value={menuItemForm.cost_per_head} onChange={e => setMenuItemForm({...menuItemForm, cost_per_head: e.target.value})} />
                                            </div>
                                            <div className="flex items-center justify-between text-xs font-bold text-[#720101]">
                                                <span>Premium Adj (₱)</span>
                                                <input type="number" className="w-20 border border-[#720101]/30 rounded px-2 py-1 text-right" value={menuItemForm.price_adj} onChange={e => setMenuItemForm({...menuItemForm, price_adj: e.target.value})} />
                                            </div>
                                            <div className="flex items-center justify-between text-xs font-bold">
                                                <span>Active Status</span>
                                                <input type="checkbox" checked={menuItemForm.is_active} onChange={e => setMenuItemForm({...menuItemForm, is_active: e.target.checked})} className="w-4 h-4 text-[#720101]" />
                                            </div>
                                            <div className="flex gap-2 pt-2 border-t">
                                                <button onClick={() => setEditingMenuItemId(null)} className="flex-1 py-1.5 text-xs font-bold text-gray-600 bg-gray-100 rounded hover:bg-gray-200">Cancel</button>
                                                <button onClick={saveMenuItem} disabled={saving} className="flex-1 py-1.5 text-xs font-bold text-white bg-[#720101] rounded hover:bg-[#5a0101] disabled:opacity-50">Save</button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex justify-between items-end mt-auto pt-2">
                                            <div>
                                                <p className="text-xs text-gray-500">Cost: ₱{item.cost_per_head || item.costPerHead || 0}</p>
                                                {(item.price_adj > 0 || item.priceAdj > 0) && (
                                                    <p className="text-xs font-bold text-[#720101]">Premium: +₱{item.price_adj || item.priceAdj}</p>
                                                )}
                                            </div>
                                            <button onClick={() => startEditingMenuItem(item)} className="text-xs font-bold text-[#720101] underline hover:text-[#5a0101]">Edit</button>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PackageBuilder;
