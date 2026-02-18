import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';

import { Mail, MessageSquare, Plus, RefreshCw, AlertCircle, Trash2, CheckCircle2, LayoutGrid, List, Power, ExternalLink, ChevronRight, Smartphone, RefreshCcw, Instagram, Globe, MessageCircle, ChevronDown, Share2, Image as ImageIcon, Video, Music, FileText, Reply, Film, Calendar, Loader2, MousePointerClick, GripVertical, ArrowUp, ArrowDown, Settings, Pencil, HelpCircle, Info, Clock, Camera, Mic, PlusSquare, Eye, X, Menu } from 'lucide-react';
import Card from '../../components/ui/card';
import LoadingOverlay from '../../components/ui/LoadingOverlay';
import ModernConfirmModal from '../../components/ui/ModernConfirmModal';
import ModernCalendar from '../../components/ui/ModernCalendar';
import ToggleSwitch from '../../components/ui/ToggleSwitch';

import { useDashboard } from '../../contexts/DashboardContext';
import { useAuth } from '../../contexts/AuthContext';
import TemplateSelector, { ReplyTemplate } from '../../components/dashboard/TemplateSelector';
import SharedMobilePreview from '../../components/dashboard/SharedMobilePreview';
import { useNavigate } from 'react-router-dom';

interface MenuItem {
    title: string;
    type: 'web_url' | 'postback';
    payload?: string;
    url?: string;
    webview_height_ratio?: 'full';
    followers_only?: boolean;
    template_type?: 'template_text' | 'template_carousel' | 'template_buttons' | 'template_media' | 'template_share_post' | 'template_quick_replies';
    template_data?: any; // Store template content for inline creation
    template_id?: string; // Template ID reference
}

const getByteLength = (str: string) => new Blob([str]).size;

const MAX_INBOX_MENU_ITEMS = 20;

const normalizeTitle = (value: string) => (value || '').trim().toLowerCase();
const suggestUniqueTitle = (base: string, existing: string[]) => {
    const trimmed = (base || '').trim();
    if (!trimmed) return trimmed;
    const existingSet = new Set(existing.map(t => (t || '').trim().toLowerCase()));
    if (!existingSet.has(trimmed.toLowerCase())) return trimmed;
    let i = 2;
    while (i < 1000) {
        const candidate = `${trimmed} (${i})`;
        if (!existingSet.has(candidate.toLowerCase())) return candidate;
        i += 1;
    }
    return `${trimmed} (${Date.now()})`;
};

// Coalesce duplicate share-post media fetches across strict-mode re-mounts
let sharedInboxMenuMediaPromise: Promise<any[]> | null = null;
let sharedInboxMenuMediaKey = '';

// Task 13: Validation Helper with red borders and error messages
const validateItem = (item: MenuItem) => {
    const errors: { [key: string]: string } = {};

    // Title validation
    if (!item.title) {
        errors.title = 'Title is required. This field is important.';
    } else if (getByteLength(item.title) > 25) {
        errors.title = 'Title too long (max 25 UTF-8 bytes)';
    }

    if (item.type === 'web_url') {
        if (!item.url) {
            errors.url = 'Destination URL is required. This field is important.';
        } else if (!/^https?:\/\//i.test(item.url)) {
            errors.url = 'URL must start with http:// or https://';
        }
    } else if (item.type === 'postback') {
        // Validate template selection
        if (!item.template_id) {
            errors.template = 'Please select a reply template';
        }
    }

    return errors;
};

interface InboxMenuData {
    ig_menu: MenuItem[];
    db_menu: MenuItem[];
    is_synced: boolean;
    status: 'match' | 'mismatch' | 'ig_only' | 'db_only' | 'none';
    issue: string | null;
    account_id: string;
}

const InboxMenu: React.FC = () => {
    const { activeAccountID, activeAccount, inboxMenuData, setInboxMenuData, fetchInboxMenu, inboxMenuLoading, dmAutomations, setCurrentView } = useDashboard();
    const { authenticatedFetch } = useAuth();

    // Check if there are any issues with the menu configuration
    const hasIssue = inboxMenuData && ['mismatch', 'ig_only', 'db_only'].includes(inboxMenuData.status);
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [isActionLoading, setIsActionLoading] = useState(false);
    const [isPublishing, setIsPublishing] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editingMenu, setEditingMenu] = useState<MenuItem[]>([]);
    const [isCreatingItem, setIsCreatingItem] = useState(false);
    const [newItem, setNewItem] = useState<MenuItem>({
        title: '',
        type: 'postback',
        followers_only: false,
        webview_height_ratio: 'full',
        template_type: 'template_text',
        template_data: {}
    });
    const [selectedTemplate, setSelectedTemplate] = useState<ReplyTemplate | null>(null);
    const [validationErrors, setValidationErrors] = useState<{ [key: string]: string }>({});
    const [fetchedAutomations, setFetchedAutomations] = useState<Record<string, any>>({});
    const [editingItemIndex, setEditingItemIndex] = useState<number | null>(null);
    const [initialMenu, setInitialMenu] = useState<MenuItem[]>([]);
    const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
    const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
    // Task 8: Carousel template state
    const [activeCarouselElementIdx, setActiveCarouselElementIdx] = useState(0);
    // Task 11: Share post template state
    const [sharePostContentType, setSharePostContentType] = useState<'all' | 'posts' | 'reels'>('all');
    const [sharePostDateRange, setSharePostDateRange] = useState<'all' | '7days' | '30days' | '90days' | 'custom'>('all');
    const [sharePostSortBy, setSharePostSortBy] = useState<'recent' | 'oldest'>('recent');
    const [sharePostCustomRange, setSharePostCustomRange] = useState<{ from: Date | null; to: Date | null }>({ from: null, to: null });
    const [sharePostMedia, setSharePostMedia] = useState<any[]>([]);
    const [sharePostSelectedMediaId, setSharePostSelectedMediaId] = useState<string | null>(null);
    const [mediaDateDropdownOpen, setMediaDateDropdownOpen] = useState(false);
    const [mediaSortDropdownOpen, setMediaSortDropdownOpen] = useState(false);
    const [isFetchingMedia, setIsFetchingMedia] = useState(false);
    const [itemBeforeEdit, setItemBeforeEdit] = useState<MenuItem | null>(null);
    const [initialFetchDone, setInitialFetchDone] = useState(false);
    const lastFetchRef = useRef<string>("");
    const [showMobilePreview, setShowMobilePreview] = useState(false);

    // Task 11: Share post template - automatic media fetching (Fetches 'all' and filters locally)
    const fetchSharePostMedia = useCallback(async (force = false) => {
        if (!activeAccountID) return;

        const currentParams = `${activeAccountID}-${sharePostDateRange}-${sharePostSortBy}-${sharePostCustomRange.from?.getTime()}-${sharePostCustomRange.to?.getTime()}`;
        if (!force && lastFetchRef.current === currentParams) return;
        lastFetchRef.current = currentParams;

        const params = new URLSearchParams({
            account_id: activeAccountID || '',
            type: 'all', // Always fetch all to filter locally
            date_range: sharePostDateRange,
            sort_by: sharePostSortBy,
            limit: '100'
        });
        if (sharePostDateRange === 'custom' && sharePostCustomRange.from && sharePostCustomRange.to) {
            params.append('from_date', sharePostCustomRange.from.toISOString());
            params.append('to_date', sharePostCustomRange.to.toISOString());
        }

        const requestKey = `${activeAccountID}|${params.toString()}`;
        const doFetch = async () => {
            const res = await authenticatedFetch(`${import.meta.env.VITE_API_BASE_URL}/api/instagram/media?${params}`);
            if (res.ok) {
                const data = await res.json();
                return data.data || [];
            }
            return [];
        };

        let promise: Promise<any[]>;
        if (!force && sharedInboxMenuMediaPromise && sharedInboxMenuMediaKey === requestKey) {
            promise = sharedInboxMenuMediaPromise;
        } else {
            sharedInboxMenuMediaKey = requestKey;
            promise = doFetch();
            if (!force) {
                sharedInboxMenuMediaPromise = promise;
            }
        }

        setIsFetchingMedia(true);
        try {
            const mediaItems = await promise;
            setSharePostMedia(mediaItems);

            // If nothing is selected yet, select the first one automatically for better UX
            // We use the functional update to avoid a stale check on newItem
            if (mediaItems.length > 0) {
                setNewItem(prev => {
                    if (!prev.template_data?.media_id) {
                        setSharePostSelectedMediaId(mediaItems[0].id);
                        return {
                            ...prev,
                            template_data: {
                                ...prev.template_data,
                                media_id: mediaItems[0].id,
                                media_url: mediaItems[0].thumbnail_url || mediaItems[0].media_url,
                                caption: mediaItems[0].caption || ''
                            }
                        };
                    }
                    return prev;
                });
            }
        } catch (error) {
            console.error('Failed to fetch media:', error);
            lastFetchRef.current = ""; // Reset on error to allow retry
        } finally {
            if (!force && sharedInboxMenuMediaPromise === promise) {
                sharedInboxMenuMediaPromise = null;
            }
            setIsFetchingMedia(false);
        }
    }, [activeAccountID, sharePostDateRange, sharePostSortBy, sharePostCustomRange, authenticatedFetch]);

    const filteredSharePostMedia = useMemo(() => {
        if (sharePostContentType === 'all') return sharePostMedia;
        if (sharePostContentType === 'posts') {
            return sharePostMedia.filter(m => m.media_product_type === 'FEED' || m.media_type === 'IMAGE' || m.media_type === 'CAROUSEL_ALBUM');
        }
        if (sharePostContentType === 'reels') {
            return sharePostMedia.filter(m => m.media_product_type === 'REELS' || (m.media_type === 'VIDEO' && m.media_product_type !== 'FEED'));
        }
        return sharePostMedia;
    }, [sharePostMedia, sharePostContentType]);

    useEffect(() => {
        if (newItem.template_type === 'template_share_post' && isCreatingItem) {
            fetchSharePostMedia();
        }
    }, [sharePostDateRange, sharePostSortBy, sharePostCustomRange, newItem.template_type, isCreatingItem, fetchSharePostMedia]);

    // Close mobile preview on Escape key
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && showMobilePreview) {
                setShowMobilePreview(false);
            }
        };

        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [showMobilePreview]);

    // Prevent body scroll when mobile preview is open
    useEffect(() => {
        if (showMobilePreview) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [showMobilePreview]);


    // Fetch full automation details when an automation is selected for preview/item creation
    useEffect(() => {
        const payloadToFetch = newItem.payload || (editingMenu.length > 0 ? editingMenu[editingMenu.length - 1].payload : null);
        if (!payloadToFetch || !activeAccountID) return;

        // Find which automation this payload refers to
        const target = (dmAutomations || []).find(a => a.template_id === payloadToFetch || a.$id === payloadToFetch);
        if (!target || !target.$id || fetchedAutomations[target.$id]) return;

        const fetchFull = async () => {
            try {
                const res = await authenticatedFetch(`${import.meta.env.VITE_API_BASE_URL}/api/instagram/automations/${target.$id}?account_id=${activeAccountID}`);
                if (res.ok) {
                    const fullData = await res.json();
                    setFetchedAutomations(prev => ({ ...prev, [target.$id]: fullData }));
                }
            } catch (e) {
                console.error("Failed to fetch full automation for preview", e);
            }
        };
        fetchFull();
    }, [newItem.payload, editingMenu, activeAccountID, dmAutomations, authenticatedFetch]);

    // Route Navigation Blocking
    // Route Navigation Blocking
    const {
        hasUnsavedChanges: globalHasUnsavedChanges,
        setHasUnsavedChanges,
        setSaveUnsavedChanges,
        setDiscardUnsavedChanges
    } = useDashboard();

    // Check for changes (item or menu)
    const hasAnyLocalChanges = useMemo(() => {
        const defaultNewItem = {
            title: '',
            type: 'postback',
            followers_only: false,
            webview_height_ratio: 'full',
            template_type: 'template_text',
            template_data: {}
        };
        const itemHasChanges = isCreatingItem && (editingItemIndex !== null
            ? JSON.stringify(newItem) !== JSON.stringify(itemBeforeEdit || editingMenu[editingItemIndex])
            : JSON.stringify(newItem) !== JSON.stringify(defaultNewItem));

        const menuHasChanges = JSON.stringify(editingMenu) !== JSON.stringify(initialMenu);

        return itemHasChanges || menuHasChanges;
    }, [isCreatingItem, editingItemIndex, newItem, itemBeforeEdit, editingMenu, initialMenu]);

    // Navigation Protection Sync
    useEffect(() => {
        if (globalHasUnsavedChanges !== hasAnyLocalChanges) {
            setHasUnsavedChanges(hasAnyLocalChanges);
        }
    }, [hasAnyLocalChanges, globalHasUnsavedChanges, setHasUnsavedChanges]);

    // Browser-level protection (refresh, close tab, navigate away via address bar)
    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (hasAnyLocalChanges || isCreatingItem) {
                e.preventDefault();
                e.returnValue = '';
            }
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [hasAnyLocalChanges, isCreatingItem]);


    // Modal State
    const [modalConfig, setModalConfig] = useState<{
        isOpen: boolean;
        title: string;
        description: string;
        type: 'danger' | 'info' | 'warning' | 'success';
        onConfirm: () => void;
        onSecondary?: () => void;
        confirmLabel?: string;
        secondaryLabel?: string;
        oneButton?: boolean;
        onClose?: () => void;
    }>({
        isOpen: false,
        title: '',
        description: '',
        type: 'info',
        onConfirm: () => { },
        oneButton: true, // Changed default to true as per instruction
    });

    const closeModal = () => setModalConfig(prev => ({ ...prev, isOpen: false }));

    const showAlert = (title: string, description: string, type: 'danger' | 'info' | 'warning' | 'success' = 'info') => {
        setModalConfig({
            isOpen: true,
            title,
            description,
            type,
            oneButton: true,
            confirmLabel: 'Okay',
            onConfirm: closeModal
        });
    };

    // Route Navigation Blocking


    useEffect(() => {
        if (activeAccountID && !inboxMenuData) {
            fetchInboxMenu();
        }
    }, [activeAccountID, fetchInboxMenu, inboxMenuData]);

    useEffect(() => {
        if (activeAccountID && inboxMenuData && !initialFetchDone) {
            const storedMenuKey = `inbox_menu_${activeAccountID}`;
            const currentMenu = inboxMenuData.db_menu || inboxMenuData.ig_menu || [];

            // Task 1: On fresh refresh, always sync localStorage with server to avoid showing stale/unpublished data
            localStorage.setItem(storedMenuKey, JSON.stringify(currentMenu));

            setInitialFetchDone(true);

            if (!isEditing && !isCreatingItem && inboxMenuData?.status === 'match') {
                handleStartEditing(false, currentMenu);
            }
        }
    }, [activeAccountID, inboxMenuData, initialFetchDone, isEditing, isCreatingItem]);

    const handleStartEditing = (autoAdd = false, forcedData?: MenuItem[]) => {
        const storedMenuKey = `inbox_menu_${activeAccountID}`;
        let menuToEdit: MenuItem[] = [];

        if (forcedData) {
            menuToEdit = [...forcedData];
        } else {
            const storedMenu = localStorage.getItem(storedMenuKey);
            if (storedMenu) {
                try {
                    menuToEdit = JSON.parse(storedMenu);
                } catch (e) {
                    console.error('Failed to parse stored menu:', e);
                    menuToEdit = inboxMenuData?.db_menu || inboxMenuData?.ig_menu || [];
                }
            } else {
                menuToEdit = inboxMenuData?.db_menu || inboxMenuData?.ig_menu || [];
            }
        }

        // Fix: Remove any ghost "URL test" items
        menuToEdit = (menuToEdit || []).filter(item => item && item.title !== 'URL test');

        setEditingMenu(menuToEdit);
        setInitialMenu([...menuToEdit]);
        setIsEditing(true);
        if (autoAdd) {
            setIsCreatingItem(true);
        }
    };

    const handleCancelEditing = () => {
        setIsEditing(false);
        setIsCreatingItem(false);
        setEditingItemIndex(null);
        setEditingMenu([]);
    };

    const handleSaveMenuItem = async () => {
        // Task 13: Validate with red borders and error messages
        const errors = validateItem(newItem);
        if (Object.keys(errors).length > 0) {
            setValidationErrors(errors);
            const firstError = Object.keys(errors)[0];
            // Task 13: Scroll to the top most field with error
            const el = document.getElementById(`err_${firstError}`) || document.getElementById(`field_${firstError}`);
            if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            } else {
                showAlert('Validation Error', 'Please fix the highlighted errors.', 'warning');
            }
            return;
        }

        // Duplicate title validation (case-insensitive)
        const currentTitle = normalizeTitle(newItem.title || '');
        if (currentTitle) {
            const duplicate = editingMenu.some((item, idx) => {
                if (editingItemIndex !== null && idx === editingItemIndex) return false;
                return normalizeTitle(item.title || '') === currentTitle;
            });
            if (duplicate) {
                const existingTitles = editingMenu
                    .filter((_, idx) => editingItemIndex === null || idx !== editingItemIndex)
                    .map((item) => item.title || '');
                const suggested = suggestUniqueTitle(newItem.title || '', existingTitles);
                if (suggested && suggested !== newItem.title) {
                    setNewItem({ ...newItem, title: suggested });
                }
                setValidationErrors({ title: `Title already exists. Suggested: ${suggested}` });
                showAlert('Validation Error', `This menu title already exists. Suggested: ${suggested}`, 'warning');
                return;
            }
        }

        setIsActionLoading(true);
        // Task 4: Skip synchronous template creation. We save data locally and create on Publish.

        // Debug: Log newItem state
        console.log('handleSaveMenuItem - newItem:', newItem);

        // Task 3: Format menu items according to Instagram API spec (https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/messaging-api/persistent-menu#set_menu)
        const formattedItem: any = {
            type: newItem.type,
            title: newItem.title
        };

        if (newItem.type === 'web_url') {
            // Web URL format: {"type": "web_url", "title": "...", "url": "...", "webview_height_ratio": "full" }
            const urlValue = newItem.url || '';
            if (!urlValue || urlValue.trim() === '') {
                console.error('Web URL validation failed:', { newItem, urlValue });
                showAlert('Error', 'Web URL menu item requires a valid URL.', 'danger');
                setIsActionLoading(false);
                return false;
            }
            formattedItem.url = urlValue.trim();
            formattedItem.webview_height_ratio = 'full';
            console.log('Web URL formatted:', formattedItem);
        } else if (newItem.type === 'postback') {
            // Postback format: {"type": "postback", "title": "...", "payload": "<template_id>" }
            if (!selectedTemplate) {
                showAlert('Error', 'Auto-reply menu item requires a reply template. Please select one.', 'danger');
                setIsActionLoading(false);
                return false;
            }
            formattedItem.payload = selectedTemplate.id;
            formattedItem.template_id = selectedTemplate.id;
            formattedItem.template_type = selectedTemplate.template_type;
        }

        // Validate formattedItem has required fields
        if (!formattedItem.title || formattedItem.title.trim() === '') {
            showAlert('Error', 'Menu item title is required.', 'danger');
            setIsActionLoading(false);
            return false;
        }

        if (!formattedItem.type) {
            showAlert('Error', 'Menu item type is required.', 'danger');
            setIsActionLoading(false);
            return false;
        }

        if (formattedItem.type === 'web_url' && !formattedItem.url) {
            showAlert('Error', 'Web URL menu item requires a valid URL.', 'danger');
            setIsActionLoading(false);
            return false;
        }

        if (formattedItem.type === 'postback' && !formattedItem.template_id) {
            showAlert('Error', 'Auto-reply menu item requires a reply template. Please select one.', 'danger');
            setIsActionLoading(false);
            return false;
        }

        console.log('handleSaveMenuItem - formattedItem:', formattedItem);

        // Combine formatted fields (for API) with full details (for local editing)
        const localItem = {
            ...newItem,
            ...formattedItem // This overrides title, type, and adds payload/url
        };

        let updatedMenu: MenuItem[];
        if (editingItemIndex !== null) {
            // Update existing item
            updatedMenu = [...editingMenu];
            updatedMenu[editingItemIndex] = localItem;
        } else {
            // Add new item (safeguard: max 20 items)
            if (editingMenu.length >= MAX_INBOX_MENU_ITEMS) {
                showAlert('Limit Reached', `Maximum ${MAX_INBOX_MENU_ITEMS} menu items allowed.`, 'warning');
                setIsActionLoading(false);
                return false;
            }
            updatedMenu = [...editingMenu, localItem];
        }

        setEditingMenu(updatedMenu);
        setNewItem({
            title: '',
            type: 'postback',
            followers_only: false,
            webview_height_ratio: 'full',
            template_type: 'template_text',
            template_data: {}
        });
        setIsCreatingItem(false);
        setEditingItemIndex(null);
        setItemBeforeEdit(null);
        setValidationErrors({});
        setIsActionLoading(false);

        // Sync local storage immediately
        localStorage.setItem(`inbox_menu_${activeAccountID}`, JSON.stringify(updatedMenu));
        showAlert('Updated', 'Menu item updated locally. Click Publish to save changes to Instagram.', 'success');
        return true;
    };

    const handleSaveMenuInternal = async (menuToSave: MenuItem[] | any[]): Promise<boolean> => {
        console.log('handleSaveMenuInternal called with:', menuToSave);

        if (!activeAccountID) {
            console.error('handleSaveMenuInternal: activeAccountID is missing');
            showAlert('Error', 'Account ID is missing. Please select an account.', 'danger');
            setIsActionLoading(false);
            return false;
        }

        // Allow empty menu for deletion flow
        const menuItems = menuToSave || [];

        // Validate all menu items before publishing
        const seenTitles = new Set<string>();
        for (let i = 0; i < menuItems.length; i++) {
            const item = menuItems[i];
            if (!item.title || item.title.trim() === '') {
                showAlert('Validation Error', `Menu item #${i + 1} is missing a title.`, 'warning');
                // Scroll to the menu item card
                setTimeout(() => {
                    const menuCard = document.querySelector(`[data-menu-item-index="${i}"]`);
                    if (menuCard) {
                        menuCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                }, 100);
                return false;
            }
            const normalized = normalizeTitle(item.title || '');
            if (normalized && seenTitles.has(normalized)) {
                showAlert('Validation Error', `Menu item #${i + 1} has a duplicate title. Please use unique titles.`, 'warning');
                setTimeout(() => {
                    const menuCard = document.querySelector(`[data-menu-item-index="${i}"]`);
                    if (menuCard) {
                        menuCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                }, 100);
                return false;
            }
            if (normalized) seenTitles.add(normalized);
        }

        setIsActionLoading(true);
        setIsPublishing(true);
        try {
            // Task 3: Format menu items correctly for Instagram API (https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/messaging-api/persistent-menu#set_menu)
            const cleanMenu = menuItems
                .filter(m => {
                    // Filter out invalid items first
                    if (!m || !m.type || !m.title) {
                        console.warn('Filtering out invalid menu item:', m);
                        return false;
                    }
                    // Additional validation based on type
                    if (m.type === 'web_url' && !m.url) {
                        console.warn('Filtering out web_url item without url:', m);
                        return false;
                    }
                    if (m.type === 'postback' && !m.payload && !m.template_data) {
                        console.warn('Filtering out postback item without payload or template_data:', m);
                        return false;
                    }
                    if (m.title === 'URL test') {
                        return false;
                    }
                    return true;
                })
                .map(m => {
                    const item: any = {
                        type: m.type,
                        title: m.title,
                        followers_only: m.followers_only || false
                    };

                    if (m.type === 'web_url') {
                        // Web URL format: { "type": "web_url", "title": "...", "url": "...", "webview_height_ratio": "full" }
                        item.url = m.url;
                        item.webview_height_ratio = 'full'; // Always set to "full" as per Instagram API
                    } else if (m.type === 'postback') {
                        // Postback format: { "type": "postback", "title": "...", "payload": "<template_id>" }
                        item.payload = m.payload; // payload is the template_id from Appwrite database
                        // Task 4: Include template data for backend to create/update
                        item.template_type = m.template_type;
                        item.template_data = m.template_data;
                    }

                    return item;
                });

            // If cleanMenu is empty, it means user wants to delete the menu from Instagram
            if (cleanMenu.length === 0) {
                // Task 2: If there are menu items on IG ... and user deletes all and publish ... send delete request
                if (inboxMenuData?.ig_menu && inboxMenuData.ig_menu.length > 0) {
                    setIsActionLoading(false);
                    setIsPublishing(false);
                    const confirmed = await new Promise<boolean>((resolve) => {
                        setModalConfig({
                            isOpen: true,
                            title: 'Delete Menu?',
                            description: 'Saving an empty menu will remove it from Instagram. Continue?',
                            type: 'danger',
                            confirmLabel: 'Delete Menu',
                            onConfirm: () => { closeModal(); resolve(true); },
                            onClose: () => { closeModal(); resolve(false); }
                        });
                    });

                    if (confirmed) {
                        return await executeDelete();
                    }
                    return false;
                } else {
                    showAlert('Error', 'Add at least one menu item before publishing.', 'danger');
                    setIsActionLoading(false);
                    setIsPublishing(false);
                    return false;
                }
            }

            console.log('Sending menu to backend:', { itemCount: cleanMenu.length, items: cleanMenu });

            // Task 2: Send menu to backend where it sets the menu using Instagram Graph API
            const response = await authenticatedFetch(`${import.meta.env.VITE_API_BASE_URL}/api/instagram/inbox-menu`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ account_id: activeAccountID, action: 'save', menu_items: cleanMenu })
            });

            if (response.ok) {
                const responseData = await response.json();
                // Task 2: Backend sends success response and new menu to frontend
                if (responseData.menu_items) {
                    // Update stored menu with the new menu from backend
                    const storedMenuKey = `inbox_menu_${activeAccountID}`;
                    localStorage.setItem(storedMenuKey, JSON.stringify(responseData.menu_items));
                }

                // Refresh the menu data
                await fetchInboxMenu(true);
                // Task 2: Reset initialMenu to match the saved state so Publish button disappears
                setInitialMenu(JSON.parse(JSON.stringify(menuItems)));
                return true;
            } else {
                const err = await response.json();
                showAlert('Save Failed', err.error || 'Failed to save menu.', 'danger');
                return false;
            }
        } catch (error) {
            showAlert('Error', 'Network error during save.', 'danger');
            return false;
        } finally {
            setIsActionLoading(false);
            setIsPublishing(false);
        }
    };

    // Manual Trigger Wrapper
    const handleSaveMenu = async () => {
        if (isCreatingItem) {
            // If we are currently creating an item, try to save it first
            await handleSaveMenuItem();
        } else {
            handleSaveMenuInternal(editingMenu);
        }
    };

    // Define Save/Discard actions for Sidebar Modal (Navigation Protection)
    useEffect(() => {
        setSaveUnsavedChanges(() => async () => {
            if (isCreatingItem) {
                // Task 3: If user hits Save in popup, we attempt to save item + menu
                const success = await handleSaveMenuItem();
                if (!success) return false;
            }
            return await handleSaveMenuInternal(editingMenu);
        });

        setDiscardUnsavedChanges(() => () => {
            handleCancelEditing();
            setHasUnsavedChanges(false);
        });
        // Do not clear hasUnsavedChanges in cleanup: that ran on every effect re-run (handlers change each render)
        // and overwrote the sync effect, so the "unsaved" popup never showed when leaving with a new item.
    }, [isCreatingItem, editingMenu, handleSaveMenuItem, handleSaveMenuInternal, setSaveUnsavedChanges, setDiscardUnsavedChanges, setHasUnsavedChanges]);


    const handleRemoveItem = (idx: number) => {
        const wouldBeEmpty = editingMenu.length <= 1;
        if (wouldBeEmpty) {
            setModalConfig({
                isOpen: true,
                title: 'Delete Last Menu Item?',
                description: 'This is the last menu item. Removing it will delete the entire Inbox Menu from Instagram and the database.',
                type: 'danger',
                confirmLabel: 'Delete Menu',
                onConfirm: async () => {
                    closeModal();
                    await executeDelete();
                }
            });
            return;
        }
        const updated = editingMenu.filter((_, i) => i !== idx);
        setEditingMenu(updated);
    };

    const handleEditItem = (idx: number) => {
        const item = editingMenu[idx];
        setEditingItemIndex(idx);
        setIsCreatingItem(true);

        // Use stored template_data from db_menu/localStorage (no API fetch needed)
        const normalizedItem = {
            ...item,
            template_type: item.template_type || 'template_text',
            template_data: item.template_data || {}
        };
        setNewItem(normalizedItem);
        setItemBeforeEdit({ ...normalizedItem });
    };

    // Task 15: Drag and drop handlers for reordering
    const handleDragStart = (idx: number) => {
        setDraggedIndex(idx);
    };

    const handleDragOver = (e: React.DragEvent, idx: number) => {
        e.preventDefault();
        setDragOverIndex(idx);
    };

    const handleDragLeave = () => {
        setDragOverIndex(null);
    };

    const handleDrop = (e: React.DragEvent, dropIndex: number) => {
        e.preventDefault();
        if (draggedIndex === null || draggedIndex === dropIndex) {
            setDraggedIndex(null);
            setDragOverIndex(null);
            return;
        }

        const newMenu = [...editingMenu];
        const draggedItem = newMenu[draggedIndex];
        newMenu.splice(draggedIndex, 1);
        newMenu.splice(dropIndex, 0, draggedItem);

        setEditingMenu(newMenu);
        setDraggedIndex(null);
        setDragOverIndex(null);
    };

    const handleSync = async () => {
        if (!activeAccountID) return;
        setIsActionLoading(true);
        try {
            const response = await authenticatedFetch(`${import.meta.env.VITE_API_BASE_URL}/api/instagram/inbox-menu`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ account_id: activeAccountID, action: 'sync' })
            });
            if (response.ok) {
                showAlert('Sync Successful', 'Your Instagram menu has been updated with the database configuration.', 'success');
                await fetchInboxMenu(true);
            } else {
                const err = await response.json();
                showAlert('Sync Failed', err.error || 'Failed to update Instagram menu.', 'danger');
            }
        } catch (error) {
            showAlert('Error', 'A network error occurred while syncing.', 'danger');
        } finally {
            setIsActionLoading(false);
        }
    };

    const executeDelete = async () => {
        if (!activeAccountID) return false;
        setIsActionLoading(true);
        setIsDeleting(true);
        try {
            const response = await authenticatedFetch(`${import.meta.env.VITE_API_BASE_URL}/api/instagram/inbox-menu?account_id=${activeAccountID}`, {
                method: 'DELETE'
            });
            if (response.ok) {
                showAlert('Menu Deleted', 'The persistent menu has been removed from Instagram.', 'success');
                // Clear all local states
                localStorage.removeItem(`inbox_menu_${activeAccountID}`);
                setEditingMenu([]);
                setInitialMenu([]);
                setInboxMenuData((prev: any) => prev ? { ...prev, ig_menu: null, db_menu: null, status: 'none' } : null);
                handleCancelEditing(); // Added as per instruction
                await fetchInboxMenu(true);
                return true;
            } else {
                const err = await response.json();
                showAlert('Delete Failed', err.error || 'Failed to delete Instagram menu.', 'danger');
                return false;
            }
        } catch (error) {
            showAlert('Error', 'A network error occurred while deleting.', 'danger');
            return false;
        } finally {
            setIsActionLoading(false);
            setIsDeleting(false);
        }
    };

    const handleDelete = async () => {
        if (!activeAccountID) return;

        setModalConfig({
            isOpen: true,
            title: 'Delete Menu?',
            description: 'This will permanently remove the persistent menu from your Instagram account. You can always create it again later.',
            type: 'danger',
            confirmLabel: 'Delete Menu',
            onConfirm: async () => {
                closeModal();
                await executeDelete();
            }
        });
    };

    const handleDeleteAndCreate = async () => {
        if (!activeAccountID) return;

        setModalConfig({
            isOpen: true,
            title: 'Delete & Create New Menu?',
            description: 'This will remove the existing menu from Instagram and the database, then start a new one.',
            type: 'danger',
            confirmLabel: 'Delete & Create',
            onConfirm: async () => {
                closeModal();
                const deleted = await executeDelete();
                if (deleted) {
                    handleStartEditing(true, []);
                }
            }
        });
    };

    // Delete from Status Action Center (db_only, ig_only, mismatch): no auto-start create
    const handleDeleteFromStatusCenter = () => {
        if (!activeAccountID) return;
        setModalConfig({
            isOpen: true,
            title: 'Delete Menu?',
            description: 'This will remove the menu from Instagram and our database. You can create a new one after.',
            type: 'danger',
            confirmLabel: 'Delete',
            onConfirm: async () => {
                closeModal();
                await executeDelete();
            }
        });
    };

    // In-app Refresh: show unsaved-changes modal when needed, then discard and refetch
    const handleRefreshClick = () => {
        if (hasAnyLocalChanges || isCreatingItem) {
            setModalConfig({
                isOpen: true,
                title: 'Unsaved Changes',
                description: 'You have unsaved changes. Refreshing will discard them. Do you want to continue?',
                type: 'warning',
                confirmLabel: 'Refresh',
                secondaryLabel: 'Cancel',
                oneButton: false,
                onConfirm: () => {
                    closeModal();
                    handleCancelEditing();
                    setInitialMenu([]);
                    setHasUnsavedChanges(false);
                    fetchInboxMenu(true);
                },
                onSecondary: closeModal
            });
        } else {
            fetchInboxMenu(true);
        }
    };

    if (!activeAccountID) {
        return (
            <div className="flex flex-col items-center justify-center py-20 bg-secondary rounded-3xl border-2 border-dashed border-border">
                <Mail className="w-12 h-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground font-semibold">Please select an Instagram account to manage its Inbox Menu.</p>
            </div>
        );
    }

    const currentDisplayMenu = (() => {
        if (isEditing) return editingMenu;
        // Always prefer db_menu when available (has template_data for preview)
        // Only fall back to ig_menu when db_menu is empty/missing
        if (inboxMenuData?.db_menu && inboxMenuData.db_menu.length > 0) return inboxMenuData.db_menu;
        if (inboxMenuData?.ig_menu && inboxMenuData.ig_menu.length > 0) return inboxMenuData.ig_menu;
        return [];
    })() || [];

    const status = inboxMenuData?.status || 'none';
    const canShowMainWorkspace = status === 'match' || isEditing || isCreatingItem;

    return (
        <div className="max-w-7xl mx-auto space-y-6 sm:space-y-8 animate-in fade-in duration-500 px-3 sm:px-4 md:px-6">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 md:gap-6 pb-6 md:pb-8 border-b border-border">
                <div className="space-y-2">
                    <div className="flex items-center gap-2 text-primary mb-2">
                        <Mail className="w-4 h-4" />
                        <span className="text-[10px] font-black uppercase tracking-[0.3em]">Smart Inbox Control</span>
                    </div>
                    <div className="flex items-center gap-4">
                        <h1 className="text-3xl sm:text-4xl font-black text-foreground tracking-tight">Inbox Menu</h1>
                        {inboxMenuData?.status === 'match' && (
                            <span className="flex items-center gap-1.5 px-3 py-1 bg-success-muted text-success text-[10px] font-black uppercase tracking-widest rounded-full">
                                <CheckCircle2 className="w-3 h-3" /> Synced
                            </span>
                        )}
                    </div>
                    <p className="text-muted-foreground font-medium max-w-xl text-sm">
                        Manage your Instagram Persistent Menu. Ensure your customers have quick access to support and key features.
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    {/* View Controls & Refresh */}
                    <button
                        onClick={handleRefreshClick}
                        className="p-3 bg-secondary text-muted-foreground rounded-xl hover:bg-secondary/80 transition-all"
                        disabled={inboxMenuLoading || isActionLoading}
                    >
                        <RefreshCw className={`w-4 h-4 ${inboxMenuLoading ? 'animate-spin' : ''}`} />
                    </button>
                    <div className="flex bg-secondary p-1 rounded-xl border border-border">
                        <button
                            onClick={() => setViewMode('grid')}
                            className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-card shadow-sm text-primary' : 'text-muted-foreground hover:text-foreground'}`}
                        >
                            <LayoutGrid className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => setViewMode('list')}
                            className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-card shadow-sm text-primary' : 'text-muted-foreground hover:text-foreground'}`}
                        >
                            <List className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Action Buttons - only when synced (match) */}
                    {!isCreatingItem && status === 'match' && !inboxMenuLoading && (
                        <button
                            onClick={() => {
                                if (!isEditing) handleStartEditing(true);
                                else setIsCreatingItem(true);
                            }}
                            disabled={isActionLoading || ((isEditing ? editingMenu : currentDisplayMenu).length >= MAX_INBOX_MENU_ITEMS)}
                            title={((isEditing ? editingMenu : currentDisplayMenu).length >= MAX_INBOX_MENU_ITEMS) ? `Maximum ${MAX_INBOX_MENU_ITEMS} menu items allowed.` : undefined}
                            className="px-8 py-3 bg-black dark:bg-white text-white dark:text-black rounded-2xl text-[10px] font-black uppercase tracking-widest hover:scale-[1.02] active:scale-95 transition-all shadow-xl shadow-black/10 flex items-center gap-2 disabled:opacity-50 disabled:pointer-events-none"
                        >
                            <Plus className="w-4 h-4" />
                            {(editingMenu.length > 0 || currentDisplayMenu.length > 0) ? 'Add Menu Item' : 'Create New Menu'}
                        </button>
                    )}

                    {!inboxMenuLoading && (isEditing || isCreatingItem) && !hasIssue && hasAnyLocalChanges && !isCreatingItem && editingItemIndex === null && (
                        <button
                            onClick={handleSaveMenu}
                            disabled={isActionLoading}
                            className="px-6 md:px-8 py-3 bg-blue-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:scale-[1.02] active:scale-95 transition-all shadow-xl shadow-blue-500/20 flex items-center gap-2 disabled:opacity-70 disabled:pointer-events-none"
                        >
                            {isPublishing ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <CheckCircle2 className="w-4 h-4" />
                            )}
                            {isPublishing ? 'Publishing...' : 'Publish'}
                        </button>
                    )}

                    {!inboxMenuLoading && !isCreatingItem && status === 'match' && (isEditing ? editingMenu : currentDisplayMenu).length > 0 && (
                        <button
                            onClick={handleDelete}
                            disabled={inboxMenuLoading || isActionLoading}
                            className="px-6 py-3 bg-red-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-red-700 transition-all shadow-xl shadow-red-500/20 flex items-center gap-2 disabled:opacity-70 disabled:pointer-events-none"
                        >
                            {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                            Delete Menu
                        </button>
                    )}
                </div>
            </div>

            {/* Content Section */}
            {inboxMenuLoading ? (
                <LoadingOverlay
                    variant="fullscreen"
                    message="Loading Inbox Menu"
                    subMessage="Checking your Instagram menu..."
                />
            ) : (
                <div className="space-y-12">
                    {/* Status Action Center - Based on menu status */}
                    {!isEditing && inboxMenuData && ['mismatch', 'ig_only', 'db_only', 'none'].includes(inboxMenuData.status) && (
                        <div className={`flex flex-col items-center justify-center py-12 px-6 bg-white dark:bg-gray-950 border-2 rounded-[2.5rem] shadow-lg ${inboxMenuData.status === 'db_only' || inboxMenuData.status === 'none' || inboxMenuData.status === 'mismatch'
                            ? 'border-blue-200 dark:border-blue-900/30'
                            : 'border-red-200 dark:border-red-900/30'
                            }`}>
                            <div className={`p-6 rounded-3xl mb-6 ${inboxMenuData.status === 'db_only' || inboxMenuData.status === 'none' || inboxMenuData.status === 'mismatch'
                                ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-500'
                                : 'bg-red-50 dark:bg-red-900/20 text-red-500'
                                }`}>
                                {inboxMenuData.status === 'db_only' || inboxMenuData.status === 'mismatch' ? (
                                    <RefreshCw className="w-10 h-10" />
                                ) : inboxMenuData.status === 'none' ? (
                                    <PlusSquare className="w-10 h-10" />
                                ) : (
                                    <AlertCircle className="w-10 h-10" />
                                )}
                            </div>
                            <h2 className={`text-2xl font-black mb-2 text-center ${inboxMenuData.status === 'db_only' || inboxMenuData.status === 'none' || inboxMenuData.status === 'mismatch'
                                ? 'text-blue-900 dark:text-blue-300'
                                : 'text-red-900 dark:text-red-300'
                                }`}>
                                {inboxMenuData.status === 'db_only' ? 'Menu Ready to Sync' :
                                    inboxMenuData.status === 'ig_only' ? 'Manual Menu Detected' :
                                        inboxMenuData.status === 'mismatch' ? 'Menu Out of Sync' : 'No Menu Yet'}
                            </h2>
                            <p className={`font-bold text-center max-w-lg mb-8 ${inboxMenuData.status === 'db_only' || inboxMenuData.status === 'none' || inboxMenuData.status === 'mismatch'
                                ? 'text-blue-700 dark:text-blue-300'
                                : 'text-red-700 dark:text-red-300'
                                }`}>
                                {inboxMenuData.status === 'db_only'
                                    ? 'You have a saved menu in our database that is not yet live on Instagram. Use Sync to push it to Instagram, or Delete to remove it and start over.'
                                    : inboxMenuData.status === 'ig_only'
                                        ? 'We found a menu on Instagram but no saved configuration in our database. Delete the existing menu, then you can create a new one.'
                                        : inboxMenuData.status === 'mismatch'
                                            ? 'The menu on Instagram differs from your saved settings. Use Sync to update Instagram with your database menu, or Delete to remove both and start over.'
                                            : 'No menu exists in your database or on Instagram. Create a new menu to get started.'}
                            </p>

                            <div className="flex flex-wrap items-center justify-center gap-4">
                                {/* Case 1: db_only - Sync (DB→IG) + Delete (DB only) */}
                                {inboxMenuData.status === 'db_only' && (
                                    <>
                                        <button
                                            onClick={handleSync}
                                            disabled={isActionLoading}
                                            className="px-10 py-4 bg-blue-600 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-blue-700 hover:scale-[1.02] active:scale-95 transition-all shadow-xl shadow-blue-500/20 flex items-center gap-2 disabled:opacity-70 disabled:pointer-events-none"
                                        >
                                            {isActionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                                            Sync
                                        </button>
                                        <button
                                            onClick={handleDeleteFromStatusCenter}
                                            disabled={isActionLoading}
                                            className="px-10 py-4 bg-red-600 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-red-700 hover:scale-[1.02] active:scale-95 transition-all shadow-xl shadow-red-500/20 flex items-center gap-2 disabled:opacity-70 disabled:pointer-events-none"
                                        >
                                            {isActionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                                            Delete
                                        </button>
                                    </>
                                )}

                                {/* Case 2: ig_only - Delete (IG only), then user can create */}
                                {inboxMenuData.status === 'ig_only' && (
                                    <button
                                        onClick={handleDeleteFromStatusCenter}
                                        disabled={isActionLoading}
                                        className="px-10 py-4 bg-red-600 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-red-700 hover:scale-[1.02] active:scale-95 transition-all shadow-xl shadow-red-500/20 flex items-center gap-2 disabled:opacity-70 disabled:pointer-events-none"
                                    >
                                        {isActionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                                        Delete
                                    </button>
                                )}

                                {/* Case 3: mismatch - Sync (DB→IG) + Delete (both) */}
                                {inboxMenuData.status === 'mismatch' && (
                                    <>
                                        <button
                                            onClick={handleSync}
                                            disabled={isActionLoading}
                                            className="px-10 py-4 bg-blue-600 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-blue-700 hover:scale-[1.02] active:scale-95 transition-all shadow-xl shadow-blue-500/20 flex items-center gap-2 disabled:opacity-70 disabled:pointer-events-none"
                                        >
                                            {isActionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                                            Sync
                                        </button>
                                        <button
                                            onClick={handleDeleteFromStatusCenter}
                                            disabled={isActionLoading}
                                            className="px-10 py-4 bg-red-600 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-red-700 hover:scale-[1.02] active:scale-95 transition-all shadow-xl shadow-red-500/20 flex items-center gap-2 disabled:opacity-70 disabled:pointer-events-none"
                                        >
                                            {isActionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                                            Delete
                                        </button>
                                    </>
                                )}

                                {/* Case 4: none - Show Create button */}
                                {inboxMenuData.status === 'none' && (
                                    <button
                                        onClick={() => handleStartEditing(true, [])}
                                        disabled={isActionLoading}
                                        className="px-10 py-4 bg-blue-600 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-blue-700 hover:scale-[1.02] active:scale-95 transition-all shadow-xl shadow-blue-500/20 flex items-center gap-2 disabled:opacity-70 disabled:pointer-events-none"
                                    >
                                        <Plus className="w-4 h-4" />
                                        Create New Menu
                                    </button>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Main Workspace Layout - only when synced (match) or in create/edit flow */}
                    {canShowMainWorkspace && (
                        <div className="flex flex-col xl:flex-row gap-8 xl:gap-12 xl:h-[calc(100vh-11rem)] xl:min-h-0">
                            {/* Editor/List Section - scrollable on xl */}
                            <div className="flex-1 w-full min-w-0 space-y-8 xl:space-y-12 xl:overflow-y-auto xl:overscroll-behavior-contain xl:min-h-0 xl:pr-2">
                                {isCreatingItem ? (
                                    <div className="bg-white dark:bg-gray-950 border border-content rounded-[2.5rem] md:rounded-[3rem] p-6 md:p-10 space-y-8 md:space-y-10 animate-in slide-in-from-left duration-500">
                                        <div className="space-y-3">
                                            <div className="flex items-center gap-2 text-blue-600">
                                                <Plus className="w-5 h-5" />
                                                <span className="text-[10px] font-black uppercase tracking-[0.3em]">New Menu Element</span>
                                            </div>
                                            <h2 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">Configure Menu</h2>
                                            <p className="text-gray-500 text-sm font-medium">Define what happens when users interact with this menu point.</p>
                                        </div>

                                        <div className="space-y-8">
                                            {/* 1. Title Field First */}
                                            <div className="space-y-4">
                                                <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                                                    <div className="flex items-center gap-2">
                                                        <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">Menu Item Title</label>
                                                        <div className="group relative">
                                                            <HelpCircle className="w-3 h-3 text-gray-300 cursor-help" />
                                                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-gray-900 text-white text-[9px] rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                                                                This is the text that users will see in the menu. Max 25 UTF-8 bytes.
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <span className={`text-[8px] font-bold ${getByteLength(newItem.title || '') > 25 ? 'text-red-500' : 'text-gray-400'}`}>
                                                        {getByteLength(newItem.title || '')}/25
                                                    </span>
                                                </div>
                                                <input
                                                    value={newItem.title}
                                                    onChange={e => {
                                                        setNewItem({ ...newItem, title: e.target.value });
                                                        if (validationErrors.title) {
                                                            const n = { ...validationErrors };
                                                            delete n.title;
                                                            setValidationErrors(n);
                                                        }
                                                    }}
                                                    className={`w-full bg-gray-50 dark:bg-gray-900 border-2 ${validationErrors.title ? 'border-red-500' : 'border-transparent'} focus:border-blue-500 outline-none rounded-2xl py-4 px-6 text-sm font-black text-gray-900 dark:text-gray-100 transition-all`}
                                                    placeholder="e.g. Chat with us"
                                                />
                                                <p className="text-[9px] text-gray-400 font-medium px-2">Required. Max 25 UTF-8 bytes. This title is visible to your customers in the Instagram menu.</p>
                                                {validationErrors.title && <p className="text-[10px] text-red-500 font-bold px-2">{validationErrors.title}</p>}
                                            </div>

                                            {/* Task 4: Followers Only Toggle - Moved here below title */}
                                            <div className="flex items-center justify-between bg-blue-50/50 dark:bg-blue-500/5 p-5 rounded-[28px] border border-blue-100 dark:border-blue-500/10 transition-all hover:bg-blue-50 dark:hover:bg-blue-500/10">
                                                <div className="flex items-center gap-4">
                                                    <div className="p-3 bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-blue-50 dark:border-blue-500/10">
                                                        <Power className={`w-5 h-5 transition-colors ${newItem.followers_only ? 'text-blue-500' : 'text-gray-400'}`} />
                                                    </div>
                                                    <div>
                                                        <p className="text-[11px] font-black text-gray-900 dark:text-white uppercase tracking-[0.15em] mb-0.5">Followers Only Mode</p>
                                                        <p className="text-[10px] font-medium text-gray-400">Only followers can see and use this menu item.</p>
                                                    </div>
                                                </div>
                                                <ToggleSwitch
                                                    isChecked={newItem.followers_only || false}
                                                    onChange={() => setNewItem({ ...newItem, followers_only: !newItem.followers_only })}
                                                    variant="plain"
                                                />
                                            </div>

                                            {/* 2. Action Type Toggle */}
                                            <div className="space-y-3">
                                                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">Select Action Type</label>
                                                <div className="grid grid-cols-2 gap-4 p-1.5 bg-gray-50 dark:bg-gray-800/50 rounded-[2.5rem] border border-content">
                                                    <button
                                                        onClick={() => setNewItem({ ...newItem, type: 'web_url', payload: undefined })}
                                                        className={`py-4 px-6 rounded-[2rem] transition-all flex items-center justify-center gap-3 font-black text-[11px] uppercase tracking-widest ${newItem.type === 'web_url' ? 'bg-white dark:bg-gray-700 shadow-xl text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
                                                    >
                                                        <Globe className="w-4 h-4" /> Web URL
                                                    </button>
                                                    <button
                                                        onClick={() => setNewItem({ ...newItem, type: 'postback', url: undefined })}
                                                        className={`py-4 px-6 rounded-[2rem] transition-all flex items-center justify-center gap-3 font-black text-[11px] uppercase tracking-widest ${newItem.type === 'postback' ? 'bg-white dark:bg-gray-700 shadow-xl text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
                                                    >
                                                        <MessageCircle className="w-4 h-4" /> Auto Reply
                                                    </button>
                                                </div>
                                            </div>

                                            {/* 3. Conditional Content */}
                                            {newItem.type === 'web_url' ? (
                                                <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
                                                    <div className="space-y-4">
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">Website URL</label>
                                                            <div className="group relative">
                                                                <HelpCircle className="w-3 h-3 text-gray-300 cursor-help" />
                                                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-gray-900 text-white text-[9px] rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                                                                    The web address you want to send users to when they click this menu item.
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="relative">
                                                            <input
                                                                type="url"
                                                                id="field_url"
                                                                value={newItem.url || ''}
                                                                onChange={(e) => {
                                                                    setNewItem({ ...newItem, url: e.target.value });
                                                                    if (validationErrors.url) {
                                                                        const newErrors = { ...validationErrors };
                                                                        delete newErrors.url;
                                                                        setValidationErrors(newErrors);
                                                                    }
                                                                }}
                                                                className={`w-full pl-8 pr-12 py-5 bg-gray-50 dark:bg-gray-800/50 border-2 ${validationErrors.url ? 'border-red-500' : 'border-transparent'} focus:border-blue-500/30 rounded-[2rem] outline-none transition-all font-bold text-gray-900 dark:text-white shadow-inner`}
                                                                placeholder="https://example.com"
                                                            />
                                                            <div className="absolute right-6 top-1/2 -translate-y-1/2">
                                                                <ExternalLink className="w-5 h-5 text-gray-400" />
                                                            </div>
                                                        </div>
                                                        <p className="text-[9px] text-gray-400 font-medium px-2">Required: Provide a valid URL starting with http:// or https://</p>
                                                        {validationErrors.url && <p id="err_url" className="text-[10px] text-red-500 font-bold px-2">{validationErrors.url}</p>}
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="space-y-8 animate-in fade-in slide-in-from-top-2">
                                                    {/* Template Selector */}
                                                    <div className="space-y-3">
                                                        <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1 mb-3">
                                                            Select Reply Template
                                                        </label>
                                                        <TemplateSelector
                                                            selectedTemplateId={selectedTemplate?.id}
                                                            onSelect={(template) => {
                                                                setSelectedTemplate(template);
                                                                if (template) {
                                                                    setNewItem({
                                                                        ...newItem,
                                                                        template_type: template.template_type as any,
                                                                        template_id: template.id,
                                                                        payload: template.id,
                                                                        template_data: template.template_data
                                                                    });
                                                                    // Clear template-related validation errors
                                                                    const newErrors = { ...validationErrors };
                                                                    Object.keys(newErrors).forEach(key => {
                                                                        if (key.startsWith('template_') || key.startsWith('element_') || key.startsWith('btn_') || key.startsWith('reply_') || key.startsWith('media_') || key.startsWith('share_')) delete newErrors[key];
                                                                    });
                                                                    setValidationErrors(newErrors);
                                                                } else {
                                                                    setNewItem({
                                                                        ...newItem,
                                                                        template_id: undefined,
                                                                        payload: undefined
                                                                    });
                                                                }
                                                            }}
                                                            onCreateNew={() => {
                                                                setCurrentView('Reply Templates');
                                                            }}
                                                        />
                                                        {validationErrors['template'] && (
                                                            <p id="err_template" className="text-[10px] text-red-500 font-bold px-2 flex items-center gap-1 mt-2">
                                                                <AlertCircle className="w-3 h-3" />
                                                                {validationErrors['template']}
                                                            </p>
                                                        )}
                                                        {!selectedTemplate && (
                                                            <p className="text-xs text-gray-400 font-medium mt-2">
                                                                Choose an existing template or create a new one to use for this menu item.
                                                            </p>
                                                        )}
                                                    </div>

                                                    {/* Template Info Display (when selected) */}
                                                    {selectedTemplate && (
                                                        <div className="p-4 bg-blue-50 dark:bg-blue-500/10 rounded-xl border-2 border-blue-200 dark:border-blue-500/20">
                                                            <p className="text-xs font-bold text-blue-600 dark:text-blue-400">
                                                                ✓ Using template: <span className="font-black">{selectedTemplate.name}</span>
                                                            </p>
                                                            <p className="text-[10px] text-blue-500 dark:text-blue-400 mt-1">
                                                                Edit this template in Reply Templates to update it across all menu items.
                                                            </p>
                                                        </div>
                                                    )}

                                                    {/* Template preview is shown in the live preview panel on the right */}
                                                </div>
                                            )}

                                            {/* Reply templates are selected only; no inline editing in Inbox Menu */}

                                            {/* Task 11: Share Post Template - Design match with DMAutomationView */}
                                            {newItem.template_type === 'template_share_post' && (
                                                <div className="space-y-6 animate-in zoom-in-95">
                                                    <div id="field_media_id" className="bg-gray-50 dark:bg-black/40 p-8 rounded-[32px] border border-content space-y-8">
                                                        <div className="flex items-center justify-between">
                                                            <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-400">Select Media to Share</h3>
                                                            <div className="flex items-center gap-2">
                                                                <div className="flex bg-white dark:bg-gray-900 p-1.5 rounded-2xl shadow-sm border border-content">
                                                                    <button
                                                                        onClick={(e) => { e.preventDefault(); setSharePostContentType('posts'); }}
                                                                        className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-2 ${sharePostContentType === 'posts' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-gray-400 hover:text-gray-600'}`}
                                                                    >
                                                                        <ImageIcon className="w-3.5 h-3.5" />
                                                                        Posts
                                                                    </button>
                                                                    <button
                                                                        onClick={(e) => { e.preventDefault(); setSharePostContentType('reels'); }}
                                                                        className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-2 ${sharePostContentType === 'reels' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-gray-400 hover:text-gray-600'}`}
                                                                    >
                                                                        <Film className="w-3.5 h-3.5" />
                                                                        Reels
                                                                    </button>
                                                                    <button
                                                                        onClick={(e) => { e.preventDefault(); setSharePostContentType('all'); }}
                                                                        className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-2 ${sharePostContentType === 'all' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-gray-400 hover:text-gray-600'}`}
                                                                    >
                                                                        <Globe className="w-3.5 h-3.5" />
                                                                        All
                                                                    </button>
                                                                    <div className="w-[1px] h-6 bg-slate-200 dark:bg-slate-700 mx-2" />
                                                                    <button
                                                                        onClick={(e) => { e.preventDefault(); fetchSharePostMedia(true); }}
                                                                        disabled={isFetchingMedia}
                                                                        className="px-4 py-2 text-gray-400 hover:text-blue-500 rounded-xl transition-all disabled:opacity-50 group"
                                                                        title="Refresh media"
                                                                    >
                                                                        <RefreshCcw className={`w-4 h-4 ${isFetchingMedia ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-500'}`} />
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        <div className="space-y-6">
                                                            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 bg-white dark:bg-slate-900/50 rounded-3xl border border-content shadow-sm relative z-50">
                                                                {/* Date Filter Dropdown */}
                                                                <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                                                                    <div className="relative w-full sm:w-64">
                                                                        <button
                                                                            onClick={(e) => { e.preventDefault(); setMediaDateDropdownOpen(!mediaDateDropdownOpen); setMediaSortDropdownOpen(false); }}
                                                                            className="w-full flex items-center justify-between px-5 py-3 bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-2xl transition-all border border-content group shadow-sm"
                                                                        >
                                                                            <div className="flex items-center gap-3 overflow-hidden">
                                                                                <Calendar className={`w-4 h-4 shrink-0 ${sharePostDateRange !== 'all' ? 'text-blue-500' : 'text-slate-400'}`} />
                                                                                <div className="flex flex-col items-start overflow-hidden">
                                                                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300 truncate">
                                                                                        {sharePostDateRange === 'all' ? 'All Time' :
                                                                                            sharePostDateRange === '7days' ? 'Last 7 Days' :
                                                                                                sharePostDateRange === '30days' ? 'Last 30 Days' :
                                                                                                    sharePostDateRange === '90days' ? 'Last 90 Days' : 'Custom Range'}
                                                                                    </span>
                                                                                    {sharePostDateRange === 'custom' && sharePostCustomRange.from && (
                                                                                        <span className="text-[8px] font-bold text-blue-500 uppercase tracking-tighter truncate">
                                                                                            {sharePostCustomRange.from.toLocaleDateString()} {sharePostCustomRange.to ? `to ${sharePostCustomRange.to.toLocaleDateString()}` : ''}
                                                                                        </span>
                                                                                    )}
                                                                                </div>
                                                                            </div>
                                                                            <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-300 ${mediaDateDropdownOpen ? 'rotate-180' : ''}`} />
                                                                        </button>

                                                                        {mediaDateDropdownOpen && (
                                                                            <>
                                                                                <div className="fixed inset-0 z-10" onClick={() => setMediaDateDropdownOpen(false)} />
                                                                                <div className="absolute top-full left-0 right-0 mt-2 p-2 bg-white dark:bg-slate-900 border border-content rounded-[28px] shadow-2xl z-20 animate-in zoom-in-95 duration-200">
                                                                                    {[
                                                                                        { id: 'all', label: 'All Time', icon: <Calendar className="w-3.5 h-3.5" /> },
                                                                                        { id: '7days', label: 'Last 7 Days', icon: <RefreshCcw className="w-3.5 h-3.5" /> },
                                                                                        { id: '30days', label: 'Last 30 Days', icon: <RefreshCcw className="w-3.5 h-3.5" /> },
                                                                                        { id: '90days', label: 'Last 90 Days', icon: <RefreshCcw className="w-3.5 h-3.5" /> },
                                                                                        { id: 'custom', label: 'Custom Range', icon: <Plus className="w-3.5 h-3.5" /> }
                                                                                    ].map((filter) => (
                                                                                        <button
                                                                                            key={filter.id}
                                                                                            onClick={(e) => {
                                                                                                e.preventDefault();
                                                                                                setSharePostDateRange(filter.id as any);
                                                                                                if (filter.id !== 'custom') setMediaDateDropdownOpen(false);
                                                                                            }}
                                                                                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-wider transition-all ${sharePostDateRange === filter.id
                                                                                                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                                                                                                : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}
                                                                                        >
                                                                                            {filter.icon}
                                                                                            {filter.label}
                                                                                        </button>
                                                                                    ))}

                                                                                    {sharePostDateRange === 'custom' && (
                                                                                        <div className="mt-2 p-4 bg-white dark:bg-slate-900 rounded-2xl border border-content animate-in slide-in-from-top-2">
                                                                                            <div className="grid grid-cols-2 gap-3">
                                                                                                <div className="space-y-2">
                                                                                                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest">From</label>
                                                                                                    <input
                                                                                                        type="date"
                                                                                                        value={sharePostCustomRange.from ? sharePostCustomRange.from.toISOString().split('T')[0] : ''}
                                                                                                        onChange={(e) => setSharePostCustomRange({ ...sharePostCustomRange, from: e.target.value ? new Date(e.target.value) : null })}
                                                                                                        className="w-full bg-gray-50 dark:bg-gray-800 border-2 border-transparent focus:border-blue-500 rounded-xl p-2.5 text-xs font-bold text-gray-900 dark:text-gray-100"
                                                                                                    />
                                                                                                </div>
                                                                                                <div className="space-y-2">
                                                                                                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest">To</label>
                                                                                                    <input
                                                                                                        type="date"
                                                                                                        value={sharePostCustomRange.to ? sharePostCustomRange.to.toISOString().split('T')[0] : ''}
                                                                                                        onChange={(e) => setSharePostCustomRange({ ...sharePostCustomRange, to: e.target.value ? new Date(e.target.value) : null })}
                                                                                                        className="w-full bg-gray-50 dark:bg-gray-800 border-2 border-transparent focus:border-blue-500 rounded-xl p-2.5 text-xs font-bold text-gray-900 dark:text-gray-100"
                                                                                                    />
                                                                                                </div>
                                                                                            </div>
                                                                                            <button
                                                                                                onClick={() => setMediaDateDropdownOpen(false)}
                                                                                                className="w-full mt-3 py-2 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase"
                                                                                            >
                                                                                                Apply
                                                                                            </button>
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                            </>
                                                                        )}
                                                                    </div>

                                                                    {/* Sort Dropdown */}
                                                                    <div className="relative w-full sm:w-48">
                                                                        <button
                                                                            onClick={(e) => { e.preventDefault(); setMediaSortDropdownOpen(!mediaSortDropdownOpen); setMediaDateDropdownOpen(false); }}
                                                                            className="w-full flex items-center justify-between px-5 py-3 bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-2xl transition-all border border-content group shadow-sm"
                                                                        >
                                                                            <div className="flex items-center gap-3">
                                                                                <RefreshCcw className="w-4 h-4 text-slate-400 group-hover:rotate-180 transition-transform duration-500" />
                                                                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300">
                                                                                    {sharePostSortBy === 'recent' ? 'Most Recent' : 'Oldest First'}
                                                                                </span>
                                                                            </div>
                                                                            <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-300 ${mediaSortDropdownOpen ? 'rotate-180' : ''}`} />
                                                                        </button>

                                                                        {mediaSortDropdownOpen && (
                                                                            <>
                                                                                <div className="fixed inset-0 z-10" onClick={() => setMediaSortDropdownOpen(false)} />
                                                                                <div className="absolute top-full left-0 right-0 mt-2 p-2 bg-white dark:bg-slate-900 border border-content rounded-[28px] shadow-2xl z-20 animate-in zoom-in-95 duration-200">
                                                                                    {[
                                                                                        { id: 'recent', label: 'Most Recent' },
                                                                                        { id: 'oldest', label: 'Oldest First' }
                                                                                    ].map((option) => (
                                                                                        <button
                                                                                            key={option.id}
                                                                                            onClick={(e) => {
                                                                                                e.preventDefault();
                                                                                                setSharePostSortBy(option.id as any);
                                                                                                setMediaSortDropdownOpen(false);
                                                                                            }}
                                                                                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-wider transition-all ${sharePostSortBy === option.id
                                                                                                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                                                                                                : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}
                                                                                        >
                                                                                            {option.id === 'recent' ? <RefreshCcw className="w-3.5 h-3.5 rotate-180" /> : <RefreshCcw className="w-3.5 h-3.5" />}
                                                                                            {option.label}
                                                                                        </button>
                                                                                    ))}
                                                                                </div>
                                                                            </>
                                                                        )}
                                                                    </div>
                                                                </div>

                                                                <div className="flex items-center gap-3">
                                                                    {isFetchingMedia && <Loader2 className="w-3.5 h-3.5 text-blue-500 animate-spin" />}
                                                                    <div className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] px-3 py-1 bg-slate-50 dark:bg-slate-800 rounded-full border border-content">
                                                                        {sharePostContentType === 'posts' ? 'Feed Posts' : sharePostContentType === 'reels' ? 'Reels Library' : 'All Media'}
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            {/* Main Content Area */}
                                                            <div className="flex-1 min-h-[400px] relative">
                                                                {isFetchingMedia && !filteredSharePostMedia.length ? (
                                                                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
                                                                        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                                                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Fetching your content...</p>
                                                                    </div>
                                                                ) : !filteredSharePostMedia.length ? (
                                                                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 animate-in fade-in duration-500">
                                                                        <div className="w-16 h-16 bg-slate-50 dark:bg-gray-800 rounded-3xl flex items-center justify-center text-slate-300">
                                                                            {sharePostContentType === 'reels' ? <Film className="w-8 h-8" /> : sharePostContentType === 'posts' ? <ImageIcon className="w-8 h-8" /> : <Globe className="w-8 h-8" />}
                                                                        </div>
                                                                        <div className="space-y-4 flex flex-col items-center">
                                                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">No {sharePostContentType === 'all' ? 'media' : sharePostContentType} found</p>
                                                                            <button
                                                                                onClick={(e) => { e.preventDefault(); fetchSharePostMedia(true); }}
                                                                                className="px-5 py-2.5 bg-slate-100 dark:bg-gray-800 text-gray-900 dark:text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all hover:bg-slate-200 dark:hover:bg-gray-700 shadow-sm flex items-center gap-2"
                                                                            >
                                                                                <RefreshCcw className="w-3.5 h-3.5" />
                                                                                Sync Content
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                ) : (
                                                                    <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 animate-in fade-in slide-in-from-bottom-2 duration-500 scrollbar-thin overflow-y-auto max-h-[600px] pr-2">
                                                                        {[...filteredSharePostMedia]
                                                                            .sort((a, b) => {
                                                                                const timeA = new Date(a.timestamp).getTime();
                                                                                const timeB = new Date(b.timestamp).getTime();
                                                                                return sharePostSortBy === 'recent' ? timeB - timeA : timeA - timeB;
                                                                            })
                                                                            .map((media: any) => (
                                                                                <button
                                                                                    key={media.id}
                                                                                    onClick={(e) => {
                                                                                        e.preventDefault();
                                                                                        setSharePostSelectedMediaId(media.id);
                                                                                        setNewItem({
                                                                                            ...newItem,
                                                                                            template_data: {
                                                                                                ...newItem.template_data,
                                                                                                media_id: media.id,
                                                                                                media_url: media.thumbnail_url || media.media_url,
                                                                                                caption: media.caption || ''
                                                                                            }
                                                                                        });
                                                                                    }}
                                                                                    className={`group relative aspect-[4/5] rounded-3xl overflow-hidden border-4 transition-all duration-300 ${sharePostSelectedMediaId === media.id
                                                                                        ? 'border-blue-500 ring-4 ring-blue-500/20 shadow-xl'
                                                                                        : 'border-transparent hover:border-slate-200 dark:hover:border-slate-800 shadow-md hover:shadow-lg'
                                                                                        }`}
                                                                                >
                                                                                    <img
                                                                                        src={media.thumbnail_url || media.media_url}
                                                                                        className={`w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 ${sharePostSelectedMediaId === media.id ? 'brightness-75' : ''}`}
                                                                                        alt={media.caption || ''}
                                                                                        loading="lazy"
                                                                                    />
                                                                                    {sharePostSelectedMediaId === media.id && (
                                                                                        <div className="absolute inset-0 flex items-center justify-center">
                                                                                            <div className="bg-blue-600 text-white rounded-full p-2.5 shadow-2xl scale-125 animate-in zoom-in duration-300">
                                                                                                <CheckCircle2 className="w-5 h-5 stroke-[4]" />
                                                                                            </div>
                                                                                        </div>
                                                                                    )}
                                                                                    <div className="absolute bottom-0 inset-x-0 p-3 bg-gradient-to-t from-black/90 via-black/40 to-transparent translate-y-2 group-hover:translate-y-0 transition-transform duration-300">
                                                                                        <div className="flex items-center gap-1.5 mb-1 text-[8px] font-black text-blue-400 uppercase tracking-widest">
                                                                                            <Calendar className="w-2.5 h-2.5" />
                                                                                            {new Date(media.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                                                                        </div>
                                                                                        <p className="text-[9px] text-white font-bold line-clamp-2 leading-relaxed">{media.caption || 'Untitled Media'}</p>
                                                                                    </div>
                                                                                    <div className="absolute top-2 right-2 px-2 py-1 bg-black/50 backdrop-blur-md rounded-lg text-white text-[7px] font-black uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">
                                                                                        {media.media_type === 'VIDEO' ? 'Reel' : 'Post'}
                                                                                    </div>
                                                                                </button>
                                                                            ))}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {sharePostSelectedMediaId && (
                                                            <div className="pt-6 border-t border-content space-y-4 animate-in slide-in-from-bottom-4">
                                                                <div className="flex items-center justify-between">
                                                                    <div className="flex items-center gap-3">
                                                                        <div className="p-2 bg-green-500/10 text-green-500 rounded-lg">
                                                                            <CheckCircle2 className="w-4 h-4" />
                                                                        </div>
                                                                        <div>
                                                                            <p className="text-[10px] font-black text-gray-900 dark:text-white uppercase tracking-widest mb-0.5">Media Selected</p>
                                                                            <p className="text-[9px] text-gray-400 font-bold">Selected ID: {sharePostSelectedMediaId}</p>
                                                                        </div>
                                                                    </div>
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.preventDefault();
                                                                            setSharePostSelectedMediaId(null);
                                                                            setNewItem({ ...newItem, template_data: { ...newItem.template_data, media_id: '', media_url: '' } });
                                                                        }}
                                                                        className="text-[9px] font-black uppercase tracking-widest text-red-500 hover:text-red-600 transition-colors"
                                                                    >
                                                                        Change Selection
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        )}

                                                        <div className="p-8 bg-blue-50 dark:bg-blue-500/5 rounded-[32px] border border-blue-100 dark:border-blue-500/10">
                                                            <div className="flex items-start gap-4">
                                                                <div className="p-3 bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-blue-50 dark:border-blue-500/10">
                                                                    <Info className="w-5 h-5 text-blue-500" />
                                                                </div>
                                                                <div>
                                                                    <p className="text-[11px] font-black text-gray-900 dark:text-white uppercase tracking-widest mb-1">Live Instagram Sync</p>
                                                                    <p className="text-[10px] font-medium text-gray-400 leading-relaxed mb-3">
                                                                        {sharePostDateRange === 'all'
                                                                            ? `Showing your most recent ${sharePostContentType === 'all' ? 'media' : sharePostContentType} directly from Instagram. Select the one you'd like to share.`
                                                                            : `Showing ${sharePostContentType === 'all' ? 'media' : sharePostContentType} from ${sharePostDateRange} directly from Instagram.`
                                                                        }
                                                                    </p>
                                                                    <div className="flex items-start gap-3 p-4 bg-blue-500/5 rounded-2xl border border-blue-500/10">
                                                                        <AlertCircle className="w-3.5 h-3.5 text-blue-500 mt-0.5" />
                                                                        <p className="text-[9px] font-bold text-blue-500/80 uppercase tracking-widest leading-relaxed">
                                                                            Note: Instagram allows fetching up to 10,000 recently created posts and reels via DM Panda.
                                                                        </p>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                            {validationErrors['share_post'] && (
                                                <div id="err_share_post" className="p-3 bg-red-50 dark:bg-red-900/20 text-red-500 text-[10px] font-bold rounded-xl flex items-center gap-2 animate-in slide-in-from-top-2 mt-3">
                                                    <AlertCircle className="w-3 h-3" />
                                                    {validationErrors['share_post']}
                                                </div>
                                            )}
                                        </div>


                                        <div className="flex gap-4 pt-4">
                                            <button
                                                onClick={() => {
                                                    // Check for unsaved changes in the form
                                                    // Since newItem is modified, we should check if it's different from the initial state or the item being edited
                                                    const defaultNewItem = {
                                                        title: '',
                                                        type: 'postback',
                                                        followers_only: false,
                                                        webview_height_ratio: 'full',
                                                        template_type: 'template_text',
                                                        template_data: {}
                                                    };

                                                    // Task 1: Check for actual changes
                                                    const hasChanges = editingItemIndex !== null
                                                        ? JSON.stringify(newItem) !== JSON.stringify(itemBeforeEdit)
                                                        : JSON.stringify(newItem) !== JSON.stringify(defaultNewItem);

                                                    if (hasChanges) {
                                                        setModalConfig({
                                                            isOpen: true,
                                                            title: 'Unsaved Changes',
                                                            description: 'You have unsaved changes. Do you want to save them before leaving?',
                                                            type: 'warning',
                                                            confirmLabel: 'Save',
                                                            secondaryLabel: 'Leave without saving',
                                                            onConfirm: async () => {
                                                                await handleSaveMenuItem();
                                                                closeModal();
                                                            },
                                                            onSecondary: () => {
                                                                setIsCreatingItem(false);
                                                                setEditingItemIndex(null);
                                                                setNewItem({
                                                                    title: '',
                                                                    type: 'postback',
                                                                    followers_only: false,
                                                                    webview_height_ratio: 'full',
                                                                    template_type: 'template_text',
                                                                    template_data: {}
                                                                });
                                                                setValidationErrors({});
                                                                closeModal();
                                                            },
                                                            oneButton: false
                                                        });
                                                    } else {
                                                        setIsCreatingItem(false);
                                                        setEditingItemIndex(null);
                                                        setValidationErrors({});
                                                    }
                                                }}
                                                className="flex-1 py-5 bg-gray-100 dark:bg-gray-800 text-gray-500 rounded-[2rem] text-[11px] font-black uppercase tracking-widest hover:bg-gray-200 dark:hover:bg-gray-700 transition-all font-bold"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                onClick={handleSaveMenuItem}
                                                disabled={isActionLoading}
                                                className="flex-1 py-5 bg-blue-600 text-white rounded-[2rem] text-[11px] font-black uppercase tracking-widest hover:bg-blue-700 hover:scale-[1.02] active:scale-95 transition-all shadow-2xl shadow-blue-500/30 font-bold flex items-center justify-center gap-2 disabled:opacity-70 disabled:pointer-events-none"
                                            >
                                                {isActionLoading ? (
                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                ) : (
                                                    <CheckCircle2 className="w-4 h-4" />
                                                )}
                                                {isActionLoading ? 'Saving...' : (editingItemIndex !== null ? 'Update Menu Item' : 'Save Menu Item')}
                                            </button>
                                        </div>
                                    </div>

                                ) : Boolean(editingMenu.length || currentDisplayMenu.length) ? (
                                    <div className="space-y-6">

                                        <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                                            Items ({(isEditing ? editingMenu : currentDisplayMenu).length}/{MAX_INBOX_MENU_ITEMS})
                                        </p>
                                        <div className={viewMode === 'grid' ? "grid grid-cols-1 md:grid-cols-2 gap-6" : "space-y-4"}>
                                            {(isEditing ? editingMenu : currentDisplayMenu).map((item: MenuItem, idx: number) => (
                                                <Card
                                                    key={idx}
                                                    data-menu-item-index={idx}
                                                    draggable={isEditing && !isActionLoading}
                                                    onDragStart={() => isEditing && !isActionLoading && handleDragStart(idx)}
                                                    onDragOver={(e) => isEditing && !isActionLoading && handleDragOver(e, idx)}
                                                    onDragLeave={isEditing && !isActionLoading ? handleDragLeave : undefined}
                                                    onDrop={(e) => isEditing && !isActionLoading && handleDrop(e, idx)}
                                                    className={`group p-6 transition-all duration-500 relative bg-white dark:bg-gray-950 border ${isEditing && !isActionLoading ? 'border-blue-500/20 ring-1 ring-blue-500/10 cursor-move' : 'border-content'} ${dragOverIndex === idx ? 'ring-2 ring-blue-500 scale-105' : ''} ${draggedIndex === idx ? 'opacity-50' : ''} rounded-[2rem] hover:shadow-2xl`}
                                                >
                                                    <div className="flex justify-between items-start mb-6">
                                                        <div className="flex items-center gap-3">
                                                            <div className="text-xl font-black text-gray-300 dark:text-gray-700 w-8">
                                                                {String(idx + 1).padStart(2, '0')}
                                                            </div>
                                                            {isEditing && !isActionLoading && (
                                                                <div className="p-2 bg-gray-100 dark:bg-gray-800 text-gray-400 rounded-lg cursor-grab active:cursor-grabbing">
                                                                    <GripVertical className="w-4 h-4" />
                                                                </div>
                                                            )}
                                                            <div className="p-4 bg-gray-50 dark:bg-gray-900 group-hover:bg-blue-50 dark:group-hover:bg-blue-900/20 text-gray-400 group-hover:text-blue-500 rounded-2xl transition-all duration-500">
                                                                {item.type === 'web_url' ? <Globe className="w-6 h-6" /> : <MessageCircle className="w-6 h-6" />}
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <span className={`px-3 py-1 text-[8px] font-black uppercase tracking-widest rounded-lg transition-all ${item.type === 'web_url' ? 'bg-orange-500/10 text-orange-500' : 'bg-blue-500/10 text-blue-500'}`}>
                                                                {item.type === 'web_url' ? 'Web URL' : 'Auto Reply'}
                                                            </span>
                                                            {item.type === 'postback' && !item.template_data && (
                                                                <span className="px-3 py-1 bg-red-500 text-white text-[8px] font-black uppercase tracking-widest rounded-lg animate-pulse">
                                                                    Broken
                                                                </span>
                                                            )}
                                                            <div className="flex items-center gap-2">
                                                                <button
                                                                    onClick={() => handleEditItem(idx)}
                                                                    disabled={isActionLoading}
                                                                    className="p-1.5 bg-blue-50 text-blue-500 rounded-lg hover:bg-blue-500 hover:text-white transition-all shadow-sm disabled:opacity-50 disabled:pointer-events-none"
                                                                    title="Edit Menu Item"
                                                                >
                                                                    <Pencil className="w-4 h-4" />
                                                                </button>
                                                                <button
                                                                    onClick={() => handleRemoveItem(idx)}
                                                                    disabled={isActionLoading}
                                                                    className="p-1.5 bg-red-50 text-red-500 rounded-lg hover:bg-red-500 hover:text-white transition-all shadow-sm disabled:opacity-50 disabled:pointer-events-none"
                                                                    title="Remove Menu Item"
                                                                >
                                                                    <Trash2 className="w-4 h-4" />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="space-y-4">
                                                        <h3 className="text-xl font-black text-gray-900 dark:text-white line-clamp-1">{item.title}</h3>
                                                        <div className="p-4 bg-gray-50/50 dark:bg-gray-900/50 rounded-2xl border border-content/50">
                                                            <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-2">
                                                                {item.type === 'web_url' ? 'External Redirect' : 'Connected Automation'}
                                                            </p>
                                                            <div className="flex items-center gap-2">
                                                                {item.type === 'web_url' ? (
                                                                    <ExternalLink className="w-3 h-3 text-blue-400" />
                                                                ) : (
                                                                    <MessageSquare className="w-3 h-3 text-blue-400" />
                                                                )}
                                                                <p className="text-xs font-bold text-gray-600 dark:text-gray-400 truncate">
                                                                    {item.type === 'web_url' ? (item.url || 'No URL set') : (dmAutomations.find(a => a.$id === item.payload)?.title || 'No automation selected')}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </Card>
                                            ))}
                                        </div>


                                    </div>
                                ) : !inboxMenuLoading && (inboxMenuData?.status === 'none' || !inboxMenuData) && (
                                    <div className="flex flex-col items-center justify-center py-24 bg-gray-50/50 dark:bg-gray-900/30 rounded-[3rem] border-2 border-dashed border-gray-100 dark:border-gray-800">
                                        <div className="p-6 bg-white dark:bg-gray-950 rounded-3xl shadow-sm mb-6">
                                            <MessageSquare className="w-8 h-8 text-gray-200" />
                                        </div>
                                        <h3 className="text-lg font-black text-gray-900 dark:text-white mb-2">No Menu Found</h3>
                                        <p className="text-gray-500 font-medium text-sm text-center px-6">
                                            Create your first persistent menu to guide your users and provide quick access to key features.
                                        </p>
                                        <button
                                            onClick={() => handleStartEditing(true)}
                                            className="mt-8 px-10 py-4 bg-blue-600 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-blue-700 hover:scale-[1.02] active:scale-95 transition-all shadow-xl shadow-blue-500/20 flex items-center gap-2"
                                        >
                                            <Plus className="w-4 h-4" /> Create New Menu
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Real-time Preview Section - Desktop only, sticky on xl */}
                            <div className="hidden lg:block xl:shrink-0 xl:self-start xl:sticky xl:top-24 xl:max-h-[calc(100vh-8rem)] xl:overflow-y-auto">
                                <SharedMobilePreview
                                    mode="menu"
                                    items={(isEditing ? editingMenu : currentDisplayMenu) as any}
                                    automations={dmAutomations}
                                    fetchedAutomations={fetchedAutomations}
                                    isEditing={isEditing}
                                    newItem={(isCreatingItem ? newItem : null) as any}
                                    displayName={activeAccount?.username || 'Username'}
                                    profilePic={activeAccount?.profile_picture_url || undefined}
                                />
                            </div>
                        </div>
                    )
                    }
                </div>
            )
            }

            {/* Mobile Preview Button - only when main workspace is shown */}
            {
                canShowMainWorkspace && (
                    <div className="lg:hidden fixed bottom-24 left-1/2 -translate-x-1/2 z-40">
                        <button
                            onClick={() => setShowMobilePreview(true)}
                            className="flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-instagram-violet via-instagram-pink to-instagram-orange text-white rounded-2xl shadow-xl hover:shadow-2xl transition-all hover:scale-105 active:scale-95"
                        >
                            <Eye className="w-5 h-5" />
                            <span className="font-bold text-sm">Live Preview</span>
                        </button>
                    </div>
                )
            }

            {/* Mobile Preview Modal */}
            {
                showMobilePreview && (
                    <div
                        className="lg:hidden fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-300"
                        onClick={(e) => {
                            if (e.target === e.currentTarget) {
                                setShowMobilePreview(false);
                            }
                        }}
                    >
                        <div className="relative w-full max-w-[340px] animate-in zoom-in-95 duration-300">
                            {/* Close Button */}
                            <button
                                onClick={() => setShowMobilePreview(false)}
                                className="absolute -top-12 right-0 z-10 p-2 bg-white/10 backdrop-blur-md rounded-full text-white hover:bg-white/20 transition-all"
                                aria-label="Close preview"
                            >
                                <X className="w-5 h-5" />
                            </button>

                            {/* Preview Content */}
                            <div onClick={(e) => e.stopPropagation()}>
                                <SharedMobilePreview
                                    mode="menu"
                                    items={(isEditing ? editingMenu : currentDisplayMenu) as any}
                                    automations={dmAutomations}
                                    fetchedAutomations={fetchedAutomations}
                                    isEditing={isEditing}
                                    newItem={(isCreatingItem ? newItem : null) as any}
                                    displayName={activeAccount?.username || 'Username'}
                                    profilePic={activeAccount?.profile_picture_url || undefined}
                                />
                            </div>
                        </div>
                    </div>
                )
            }

            {
                createPortal(
                    <ModernConfirmModal
                        isOpen={modalConfig.isOpen}
                        onClose={() => {
                            if (modalConfig.onClose) modalConfig.onClose();
                            closeModal();
                        }}
                        onConfirm={modalConfig.onConfirm}
                        onSecondary={modalConfig.onSecondary}
                        title={modalConfig.title}
                        description={modalConfig.description}
                        type={modalConfig.type}
                        confirmLabel={modalConfig.confirmLabel}
                        secondaryLabel={modalConfig.secondaryLabel}
                        oneButton={modalConfig.oneButton}
                        isLoading={isActionLoading && !modalConfig.oneButton}
                    />,
                    document.body
                )
            }
        </div>
    );
};

export default InboxMenu;
