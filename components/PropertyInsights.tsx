import React, { useState, useEffect, useMemo } from 'react';
import { BlogPost, UserProfile } from '../types';
import Icon from './common/Icon';
import { db, auth } from '../services/firebaseService';
import { collection, onSnapshot, doc, setDoc, deleteDoc } from 'firebase/firestore';

interface PropertyInsightsProps {
  currentUser: UserProfile | null;
  isAdmin?: boolean;
  onShowToast?: (msg: string) => void;
}

const INITIAL_MOCK_BLOGS: BlogPost[] = [
  {
    id: 'blog-1',
    title: 'Real Estate Investment Trends in Rau & AB Road Corridor 2026',
    coverImage: 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=800&q=80',
    description: 'An in-depth analysis of plot value growth along the Indore-Pithampur economic corridor and why Rau is emerging as Indore’s prime residential hub.',
    content: `### Why Invest in Rau, Indore?

Rau has transformed from a quiet suburban town into one of Indore’s most lucrative real estate hotspots. Situated strategically at the junction of AB Road and the Rau-Pithampur Industrial Link, this region offers unprecedented growth potential.

#### Key Growth Drivers:
1. **Connectivity**: Direct connection to Super Corridor, Indore Airport, and Pithampur Industrial Smart City.
2. **Education Hub**: Proximity to IIT Indore, IIM Indore, IPS Academy, and Emerald Heights School.
3. **Appreciation Rates**: Plotted townships in Rau have seen a steady **18% - 24% annual appreciation** over the last 3 years.

#### Infrastructure Highlights
Modern developments like *Divine Park*, *Maa Ginni Extension*, and *Vrindavan Colony* now offer 30-40 ft wide tar roads, underground electrification, boundary security, and lush green gardens.`,
    category: 'Market Trends',
    tags: ['Indore Real Estate', 'Rau Plots', 'Investment', 'Property Growth'],
    author: 'Dhanshri Research Team',
    authorEmail: 'sonuchouhan1528@gmail.com',
    status: 'Published',
    createdAt: new Date('2026-06-15').toISOString(),
  },
  {
    id: 'blog-2',
    title: 'RERA Checklist: 7 Essential Documents Before Buying a Plot',
    coverImage: 'https://images.unsplash.com/photo-1450133064473-71024230f91b?auto=format&fit=crop&w=800&q=80',
    description: 'Essential legal advice and RERA compliance standards every plot buyer must verify to ensure a 100% dispute-free property transaction.',
    content: `### Essential Plot Buyer Checklist

Purchasing a residential plot is a lifetime milestone. To safeguard your hard-earned savings, ensure your builder or seller provides clear documentation.

#### 1. TNCP Approval (Town & Country Planning)
Verify that the layout layout plan is approved by the Madhya Pradesh Town & Country Planning department.

#### 2. RERA Registration Certificate
Always ask for the RERA registration number and cross-verify layout approvals on the official MP RERA portal.

#### 3. Diversion & Nazul Clearance
Ensure the land usage is legally converted from agricultural to residential/commercial (Diversion Order).

#### 4. Khasra & Khatoni Records
Cross-check the seller's name in revenue records to confirm unencumbered ownership title.`,
    category: 'Legal & RERA',
    tags: ['RERA', 'Legal Advice', 'TNCP Approval', 'Plot Registry'],
    author: 'Legal Advisory Dept',
    authorEmail: 'sonuchouhan1528@gmail.com',
    status: 'Published',
    createdAt: new Date('2026-07-02').toISOString(),
  },
  {
    id: 'blog-3',
    title: 'Township Infrastructure Upgrades: Smart Roads & Underground Utilities',
    coverImage: 'https://images.unsplash.com/photo-1541888946425-d0fbb186a5b3?auto=format&fit=crop&w=800&q=80',
    description: 'Discover how Dhanshri Properties is setting new benchmarks in township development with modern rainwater harvesting and solar perimeter lighting.',
    content: `### Modern Infrastructure at Dhanshri Townships

Quality infrastructure defines long-term living comfort and property value. Our ongoing township projects in Rau are engineered with sustainable urban planning standards.

#### Development Highlights:
- **Underground Drainage & Water Lines**: High-density polyethylene piping designed for zero leakage.
- **Solar LED Street Lights**: Eco-friendly perimeter illumination ensuring 24/7 security.
- **Grand Entrance Gates**: Secured gated communities with 24-hour CCTV surveillance.
- **Landscaped Parks & Jogging Tracks**: Dedicated green lungs with children play zones.`,
    category: 'Project Updates',
    tags: ['Township Infrastructure', 'Smart Living', 'Divine Park', 'Dhanshri Projects'],
    author: 'Engineering Team',
    authorEmail: 'sonuchouhan1528@gmail.com',
    status: 'Published',
    createdAt: new Date('2026-07-20').toISOString(),
  }
];

const CATEGORIES = [
  'All',
  'Market Trends',
  'Legal & RERA',
  'Investment Guide',
  'Project Updates',
  'Area Guide',
  'Real Estate Tips'
];

export const PropertyInsights: React.FC<PropertyInsightsProps> = ({
  currentUser,
  isAdmin,
  onShowToast
}) => {
  const [blogs, setBlogs] = useState<BlogPost[]>(() => {
    try {
      const cached = localStorage.getItem('dhanshri_blogs_cache');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.warn('Failed to parse blog cache', e);
    }
    return [];
  });

  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState<'All' | 'Published' | 'Draft'>('All');
  const [searchQuery, setSearchQuery] = useState('');

  // Editor / Modal states
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingBlog, setEditingBlog] = useState<BlogPost | null>(null);
  const [viewingBlog, setViewingBlog] = useState<BlogPost | null>(null);

  // Form Fields for Create / Edit Blog
  const [formTitle, setFormTitle] = useState('');
  const [formCoverImage, setFormCoverImage] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formContent, setFormContent] = useState('');
  const [formCategory, setFormCategory] = useState('Market Trends');
  const [formTagsStr, setFormTagsStr] = useState('');
  const [formStatus, setFormStatus] = useState<'Draft' | 'Published'>('Published');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // User permission check
  const isAuthorizedToEdit = useMemo(() => {
    if (isAdmin) return true;
    if (!currentUser) return false;
    const role = currentUser.role?.toLowerCase();
    return role === 'admin' || role === 'manager' || role === 'executive';
  }, [isAdmin, currentUser]);

  // Firestore Realtime Subscription
  useEffect(() => {
    let unsub: (() => void) | null = null;
    try {
      const blogsRef = collection(db, 'blogs');
      unsub = onSnapshot(blogsRef, (snapshot) => {
        if (!snapshot.empty) {
          const list: BlogPost[] = snapshot.docs.map(docSnap => ({
            id: docSnap.id,
            ...(docSnap.data() as Omit<BlogPost, 'id'>)
          }));
          // Sort by creation date descending
          list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          setBlogs(list);
          try {
            localStorage.setItem('dhanshri_blogs_cache', JSON.stringify(list));
          } catch (err) {
            console.warn('Could not cache blogs to localStorage', err);
          }
        } else {
          // If Firestore is empty, do not seed mock blogs
          setBlogs([]);
        }
        setLoading(false);
      }, (err) => {
        console.warn('Firestore blog listener error (fallback to local cache):', err);
        setLoading(false);
      });
    } catch (e) {
      console.warn('Error setting up blogs listener:', e);
      setLoading(false);
    }

    return () => {
      if (unsub) unsub();
    };
  }, []);

  // Filtered Blogs
  const filteredBlogs = useMemo(() => {
    return blogs.filter(blog => {
      // Category Filter
      if (selectedCategory !== 'All' && blog.category !== selectedCategory) return false;

      // Status Filter
      if (selectedStatus !== 'All' && blog.status !== selectedStatus) return false;

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const titleMatch = blog.title?.toLowerCase().includes(q);
        const descMatch = blog.description?.toLowerCase().includes(q);
        const tagMatch = blog.tags?.some(t => t.toLowerCase().includes(q));
        const authorMatch = blog.author?.toLowerCase().includes(q);
        if (!titleMatch && !descMatch && !tagMatch && !authorMatch) return false;
      }

      // Hide drafts from non-staff/non-authors if needed, but staff or public can see drafts if explicitly requested
      if (!isAuthorizedToEdit && blog.status === 'Draft') return false;

      return true;
    });
  }, [blogs, selectedCategory, selectedStatus, searchQuery, isAuthorizedToEdit]);

  // Open Create Modal
  const handleOpenCreate = () => {
    setEditingBlog(null);
    setFormTitle('');
    setFormCoverImage('');
    setFormDescription('');
    setFormContent('');
    setFormCategory('Market Trends');
    setFormTagsStr('');
    setFormStatus('Published');
    setIsEditorOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (blog: BlogPost, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingBlog(blog);
    setFormTitle(blog.title || '');
    setFormCoverImage(blog.coverImage || '');
    setFormDescription(blog.description || '');
    setFormContent(blog.content || '');
    setFormCategory(blog.category || 'Market Trends');
    setFormTagsStr(blog.tags ? blog.tags.join(', ') : '');
    setFormStatus(blog.status || 'Published');
    setIsEditorOpen(true);
  };

  // Handle Image File Upload (Convert to Compressed Base64)
  const handleImageFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      if (onShowToast) onShowToast('Image size should be under 5MB');
      else alert('Image size should be under 5MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const maxDimension = 1200;

        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.8);
          setFormCoverImage(compressedDataUrl);
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Rich Text Quick Actions (Inserts markdown or formatting tags into content)
  const insertFormatting = (syntaxStart: string, syntaxEnd: string = '') => {
    setFormContent(prev => prev + `${syntaxStart}${syntaxEnd}`);
  };

  // Handle Save (Create or Edit)
  const handleSaveBlog = async (targetStatus?: 'Draft' | 'Published') => {
    if (!formTitle.trim()) {
      alert('Please enter a blog title');
      return;
    }
    if (!formDescription.trim()) {
      alert('Please enter a short description');
      return;
    }
    if (!formContent.trim()) {
      alert('Please enter the blog content');
      return;
    }

    setIsSubmitting(true);
    const saveStatus = targetStatus || formStatus;
    const parsedTags = formTagsStr
      .split(',')
      .map(t => t.trim())
      .filter(t => t.length > 0);

    const blogId = editingBlog ? editingBlog.id : `blog-${Date.now()}`;
    const authorName = currentUser?.fullName || currentUser?.name || currentUser?.email?.split('@')[0] || 'Dhanshri Admin';
    const authorEmail = currentUser?.email || auth.currentUser?.email || 'admin@dhanshriproperties.com';

    const blogPayload: BlogPost = {
      id: blogId,
      title: formTitle.trim(),
      coverImage: formCoverImage.trim() || 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=800&q=80',
      description: formDescription.trim(),
      content: formContent.trim(),
      category: formCategory,
      tags: parsedTags,
      author: authorName,
      authorEmail: authorEmail,
      status: saveStatus,
      createdAt: editingBlog ? editingBlog.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    try {
      // Save to Firestore
      await setDoc(doc(db, 'blogs', blogId), blogPayload);

      // Local state fallback update
      setBlogs(prev => {
        const index = prev.findIndex(b => b.id === blogId);
        let updatedList: BlogPost[];
        if (index >= 0) {
          updatedList = [...prev];
          updatedList[index] = blogPayload;
        } else {
          updatedList = [blogPayload, ...prev];
        }
        localStorage.setItem('dhanshri_blogs_cache', JSON.stringify(updatedList));
        return updatedList;
      });

      const msg = editingBlog
        ? `Blog "${formTitle.substring(0, 20)}..." updated successfully!`
        : `New blog "${formTitle.substring(0, 20)}..." ${saveStatus === 'Published' ? 'published' : 'saved as draft'}!`;
      
      if (onShowToast) onShowToast(msg);

      setIsEditorOpen(false);
    } catch (err: any) {
      console.error('Failed to save blog to Firestore:', err);
      if (onShowToast) onShowToast('Saved locally (Firestore error: ' + (err.message || 'Permission denied') + ')');
      
      // Fallback local update
      setBlogs(prev => {
        const index = prev.findIndex(b => b.id === blogId);
        let updatedList: BlogPost[];
        if (index >= 0) {
          updatedList = [...prev];
          updatedList[index] = blogPayload;
        } else {
          updatedList = [blogPayload, ...prev];
        }
        localStorage.setItem('dhanshri_blogs_cache', JSON.stringify(updatedList));
        return updatedList;
      });
      setIsEditorOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Delete Blog
  const handleDeleteBlog = async (blogId: string, title: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();

    if (!confirm(`Are you sure you want to delete the blog:\n"${title}"?`)) return;

    try {
      await deleteDoc(doc(db, 'blogs', blogId));
      setBlogs(prev => {
        const updated = prev.filter(b => b.id !== blogId);
        localStorage.setItem('dhanshri_blogs_cache', JSON.stringify(updated));
        return updated;
      });
      if (onShowToast) onShowToast('Blog deleted successfully');
      if (viewingBlog?.id === blogId) setViewingBlog(null);
    } catch (err: any) {
      console.error('Failed to delete blog from Firestore:', err);
      setBlogs(prev => {
        const updated = prev.filter(b => b.id !== blogId);
        localStorage.setItem('dhanshri_blogs_cache', JSON.stringify(updated));
        return updated;
      });
      if (onShowToast) onShowToast('Blog deleted locally');
    }
  };

  return (
    <div className="space-y-6 pb-12 animate-fadeIn">
      {/* Top Banner & Header */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white rounded-2xl p-6 md:p-8 shadow-xl relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="max-w-2xl space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-500/20 border border-blue-400/30 rounded-full text-xs font-bold text-blue-300 uppercase tracking-wider">
              <Icon name="insights" className="w-4 h-4 text-blue-400" />
              <span>Property Insights & Market News</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
              Real Estate News & Articles
            </h1>
            <p className="text-sm md:text-base text-blue-100/90 leading-relaxed">
              Stay updated with expert property market trends, legal checklists, township infrastructure updates, and investment guides for Rau & Indore.
            </p>
          </div>

          {isAuthorizedToEdit && (
            <button
              onClick={handleOpenCreate}
              className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-bold px-5 py-3 rounded-xl shadow-lg hover:shadow-indigo-500/25 transition-all transform hover:-translate-y-0.5 active:translate-y-0 shrink-0 text-sm"
            >
              <Icon name="plus" className="w-5 h-5" />
              <span>Create New Blog</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 space-y-4">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          {/* Search Bar */}
          <div className="relative flex-1">
            <Icon name="search" className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search blogs by title, tags, or author..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 bg-slate-200 hover:bg-slate-300 rounded-full w-5 h-5 flex items-center justify-center"
              >
                ✕
              </button>
            )}
          </div>

          {/* Status Filter (Draft / Published) for staff */}
          {isAuthorizedToEdit && (
            <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl shrink-0 self-start md:self-auto text-xs font-semibold">
              <button
                onClick={() => setSelectedStatus('All')}
                className={`px-3 py-1.5 rounded-lg transition-all ${selectedStatus === 'All' ? 'bg-white text-slate-800 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'}`}
              >
                All Status ({blogs.length})
              </button>
              <button
                onClick={() => setSelectedStatus('Published')}
                className={`px-3 py-1.5 rounded-lg transition-all ${selectedStatus === 'Published' ? 'bg-white text-emerald-700 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'}`}
              >
                Published ({blogs.filter(b => b.status === 'Published').length})
              </button>
              <button
                onClick={() => setSelectedStatus('Draft')}
                className={`px-3 py-1.5 rounded-lg transition-all ${selectedStatus === 'Draft' ? 'bg-white text-amber-700 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'}`}
              >
                Drafts ({blogs.filter(b => b.status === 'Draft').length})
              </button>
            </div>
          )}
        </div>

        {/* Categories Chips */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-1 no-scrollbar">
          {CATEGORIES.map(cat => {
            const isActive = selectedCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all border ${
                  isActive
                    ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>
      </div>

      {/* Blogs List / Grid */}
      {filteredBlogs.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-4 shadow-2xs">
          <div className="w-16 h-16 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center mx-auto">
            <Icon name="insights" className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-slate-800">No blog posts found</h3>
            <p className="text-sm text-slate-500 max-w-md mx-auto">
              {searchQuery || selectedCategory !== 'All'
                ? 'Try adjusting your search query or selected category filter.'
                : 'There are no published property insights currently available.'}
            </p>
          </div>
          {isAuthorizedToEdit && (
            <button
              onClick={handleOpenCreate}
              className="mt-2 inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2 rounded-xl text-xs shadow-sm transition-all"
            >
              <Icon name="plus" className="w-4 h-4" />
              <span>Create First Blog</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredBlogs.map(blog => (
            <div
              key={blog.id}
              onClick={() => setViewingBlog(blog)}
              className="bg-white rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-all duration-200 overflow-hidden flex flex-col group cursor-pointer transform hover:-translate-y-1"
            >
              {/* Cover Image */}
              <div className="relative h-48 bg-slate-100 overflow-hidden">
                <img
                  src={blog.coverImage || 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=800&q=80'}
                  alt={blog.title}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                
                {/* Status & Category Badges */}
                <div className="absolute top-3 left-3 flex items-center gap-2">
                  <span className="px-2.5 py-1 bg-slate-900/80 backdrop-blur-md text-white text-[11px] font-bold rounded-lg border border-white/20">
                    {blog.category}
                  </span>
                </div>

                <div className="absolute top-3 right-3 flex items-center gap-2">
                  {blog.status === 'Draft' ? (
                    <span className="px-2.5 py-1 bg-amber-500/90 backdrop-blur-md text-white text-[10px] font-black uppercase rounded-lg shadow-sm">
                      Draft
                    </span>
                  ) : (
                    <span className="px-2.5 py-1 bg-emerald-600/90 backdrop-blur-md text-white text-[10px] font-black uppercase rounded-lg shadow-sm">
                      Published
                    </span>
                  )}
                </div>
              </div>

              {/* Body */}
              <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                <div className="space-y-2">
                  <h3 className="font-bold text-slate-900 text-lg group-hover:text-blue-600 transition-colors line-clamp-2 leading-snug">
                    {blog.title}
                  </h3>
                  <p className="text-sm text-slate-600 line-clamp-3 leading-relaxed">
                    {blog.description}
                  </p>
                </div>

                {/* Tags if available */}
                {blog.tags && blog.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {blog.tags.slice(0, 3).map((tag, idx) => (
                      <span key={idx} className="text-[10px] font-semibold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md">
                        #{tag}
                      </span>
                    ))}
                    {blog.tags.length > 3 && (
                      <span className="text-[10px] font-semibold text-slate-400">
                        +{blog.tags.length - 3} more
                      </span>
                    )}
                  </div>
                )}

                {/* Footer Meta */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 font-medium">
                  <div className="flex items-center gap-1.5 truncate max-w-[60%]">
                    <div className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-[10px]">
                      {blog.author?.charAt(0).toUpperCase() || 'A'}
                    </div>
                    <span className="truncate">{blog.author}</span>
                  </div>

                  <span>
                    {new Date(blog.createdAt).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric'
                    })}
                  </span>
                </div>

                {/* Staff Actions */}
                {isAuthorizedToEdit && (
                  <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100" onClick={e => e.stopPropagation()}>
                    <button
                      onClick={(e) => handleOpenEdit(blog, e)}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-600 text-xs font-bold rounded-lg transition-colors flex items-center gap-1"
                    >
                      <Icon name="edit" className="w-3.5 h-3.5" />
                      <span>Edit</span>
                    </button>
                    <button
                      onClick={(e) => handleDeleteBlog(blog.id, blog.title, e)}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-red-50 text-slate-700 hover:text-red-600 text-xs font-bold rounded-lg transition-colors flex items-center gap-1"
                    >
                      <Icon name="trash" className="w-3.5 h-3.5" />
                      <span>Delete</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* CREATE / EDIT BLOG MODAL */}
      {isEditorOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl my-8 overflow-hidden border border-slate-100 animate-scaleUp">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-slate-900 to-blue-900 text-white p-5 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-500/20 rounded-lg text-blue-300">
                  <Icon name="insights" className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold">
                    {editingBlog ? 'Edit Property Blog' : 'Create New Property Blog'}
                  </h2>
                  <p className="text-xs text-blue-200">
                    Publish updates, market guides, or legal advice for buyers
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsEditorOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Modal Form Content */}
            <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
              {/* Blog Title */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Blog Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. 5 Reasons to Invest in Rau AB Road Township Projects"
                  value={formTitle}
                  onChange={e => setFormTitle(e.target.value)}
                  className="w-full px-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all font-semibold"
                />
              </div>

              {/* Category & Status */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Category <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formCategory}
                    onChange={e => setFormCategory(e.target.value)}
                    className="w-full px-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all font-medium"
                  >
                    {CATEGORIES.filter(c => c !== 'All').map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Publish Status
                  </label>
                  <div className="flex items-center gap-2 pt-0.5">
                    <button
                      type="button"
                      onClick={() => setFormStatus('Published')}
                      className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all border ${
                        formStatus === 'Published'
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      Published
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormStatus('Draft')}
                      className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all border ${
                        formStatus === 'Draft'
                          ? 'bg-amber-500 text-white border-amber-500 shadow-2xs'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      Draft
                    </button>
                  </div>
                </div>
              </div>

              {/* Cover Image Upload & URL */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Cover Image (File Upload or URL)
                </label>

                <div className="flex flex-col sm:flex-row items-stretch gap-3">
                  <input
                    type="text"
                    placeholder="https://images.unsplash.com/... or paste image URL"
                    value={formCoverImage}
                    onChange={e => setFormCoverImage(e.target.value)}
                    className="flex-1 px-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all"
                  />
                  
                  <label className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl cursor-pointer transition-colors shrink-0">
                    <Icon name="image" className="w-4 h-4 text-slate-500" />
                    <span>Upload Image</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageFileUpload}
                      className="hidden"
                    />
                  </label>
                </div>

                {formCoverImage && (
                  <div className="relative mt-2 h-36 w-full rounded-xl overflow-hidden border border-slate-200 bg-slate-100">
                    <img
                      src={formCoverImage}
                      alt="Cover Preview"
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                    <button
                      onClick={() => setFormCoverImage('')}
                      className="absolute top-2 right-2 p-1 bg-slate-900/70 hover:bg-slate-900 text-white rounded-full text-xs"
                      title="Remove Cover Image"
                    >
                      ✕
                    </button>
                  </div>
                )}
              </div>

              {/* Short Description */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Short Description / Summary <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={2}
                  placeholder="A short 2-3 sentence overview of the blog post for preview cards..."
                  value={formDescription}
                  onChange={e => setFormDescription(e.target.value)}
                  className="w-full px-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all"
                />
              </div>

              {/* Full Content Editor */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Full Content <span className="text-red-500">*</span>
                  </label>

                  {/* Formatting Toolbar Shortcuts */}
                  <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg text-xs">
                    <button
                      type="button"
                      onClick={() => insertFormatting('### ', '\n')}
                      className="px-2 py-0.5 hover:bg-white rounded font-bold text-slate-700"
                      title="Heading 3"
                    >
                      H3
                    </button>
                    <button
                      type="button"
                      onClick={() => insertFormatting('#### ', '\n')}
                      className="px-2 py-0.5 hover:bg-white rounded font-bold text-slate-700"
                      title="Heading 4"
                    >
                      H4
                    </button>
                    <button
                      type="button"
                      onClick={() => insertFormatting('**', '**')}
                      className="px-2 py-0.5 hover:bg-white rounded font-bold text-slate-700"
                      title="Bold text"
                    >
                      B
                    </button>
                    <button
                      type="button"
                      onClick={() => insertFormatting('- ', '\n')}
                      className="px-2 py-0.5 hover:bg-white rounded text-slate-700"
                      title="Bullet point"
                    >
                      • List
                    </button>
                  </div>
                </div>

                <textarea
                  rows={8}
                  placeholder="Write full article content here. Paragraphs, headings, bullet points are supported..."
                  value={formContent}
                  onChange={e => setFormContent(e.target.value)}
                  className="w-full px-4 py-3 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all font-mono leading-relaxed"
                />
              </div>

              {/* Tags */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Tags (Comma separated)
                </label>
                <input
                  type="text"
                  placeholder="Indore, Real Estate, Rau, RERA, Investment"
                  value={formTagsStr}
                  onChange={e => setFormTagsStr(e.target.value)}
                  className="w-full px-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all"
                />
              </div>
            </div>

            {/* Modal Actions */}
            <div className="p-5 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsEditorOpen(false)}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-200/60 transition-colors"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={() => handleSaveBlog('Draft')}
                disabled={isSubmitting}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl text-xs font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 transition-all"
              >
                Save as Draft
              </button>

              <button
                type="button"
                onClick={() => handleSaveBlog('Published')}
                disabled={isSubmitting}
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-500/20 transition-all flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Icon name="check" className="w-4 h-4" />
                    <span>Publish Blog</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FULL BLOG READER MODAL */}
      {viewingBlog && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl my-8 overflow-hidden border border-slate-100 animate-scaleUp">
            {/* Header Image */}
            <div className="relative h-64 md:h-80 bg-slate-900">
              <img
                src={viewingBlog.coverImage || 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=800&q=80'}
                alt={viewingBlog.title}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover opacity-90"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />

              <button
                onClick={() => setViewingBlog(null)}
                className="absolute top-4 right-4 p-2 bg-slate-900/80 hover:bg-slate-900 text-white rounded-full shadow-lg transition-transform hover:scale-105"
              >
                ✕
              </button>

              <div className="absolute bottom-6 left-6 right-6 space-y-2 text-white">
                <span className="px-3 py-1 bg-blue-600 text-white text-xs font-bold rounded-lg shadow-sm">
                  {viewingBlog.category}
                </span>

                <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight leading-snug">
                  {viewingBlog.title}
                </h1>

                <div className="flex items-center gap-4 text-xs text-slate-300 font-medium">
                  <span>By {viewingBlog.author}</span>
                  <span>•</span>
                  <span>
                    {new Date(viewingBlog.createdAt).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric'
                    })}
                  </span>
                </div>
              </div>
            </div>

            {/* Reader Content */}
            <div className="p-6 md:p-8 space-y-6 max-h-[60vh] overflow-y-auto">
              {/* Short Summary Callout */}
              <div className="bg-blue-50 border-l-4 border-blue-600 p-4 rounded-r-xl text-sm font-medium text-slate-800 leading-relaxed">
                {viewingBlog.description}
              </div>

              {/* Formatted Full Content Body */}
              <div className="prose prose-slate max-w-none text-slate-700 space-y-4 text-sm md:text-base leading-relaxed whitespace-pre-wrap">
                {viewingBlog.content}
              </div>

              {/* Tags */}
              {viewingBlog.tags && viewingBlog.tags.length > 0 && (
                <div className="pt-4 border-t border-slate-100 flex flex-wrap gap-2 items-center">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Tags:</span>
                  {viewingBlog.tags.map((t, idx) => (
                    <span key={idx} className="bg-slate-100 text-slate-700 px-3 py-1 rounded-lg text-xs font-semibold">
                      #{t}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-5 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
              {isAuthorizedToEdit ? (
                <button
                  onClick={() => {
                    const blogToEdit = viewingBlog;
                    setViewingBlog(null);
                    handleOpenEdit(blogToEdit);
                  }}
                  className="px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-colors"
                >
                  <Icon name="edit" className="w-4 h-4" />
                  <span>Edit This Blog</span>
                </button>
              ) : <div />}

              <button
                onClick={() => setViewingBlog(null)}
                className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs transition-colors"
              >
                Close Article
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PropertyInsights;
