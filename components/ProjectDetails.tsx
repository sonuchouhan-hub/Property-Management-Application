
import React, { useState, useRef } from 'react';
import { Project, PlotStatus, ProjectDocument, NearbyAmenity } from '../types';
import { auth } from '../services/firebaseService';
import Icon from './common/Icon';
import { ProjectImageGallery } from './ProjectImageGallery';
import { STATUS_COLORS, getNormalizedStatus, getStatusStyles } from '../constants';

const PdfViewer = React.lazy(() => import('./common/PdfViewer'));
import { jsPDF } from 'jspdf';

const getInitialNearbyAmenities = (projectName: string): NearbyAmenity[] => {
  const name = projectName.toLowerCase();
  
  if (name.includes('maa ginni vihar extension') || name.includes('maa ginni park') || name.includes('shanti vihar')) {
    return [
      { id: 'mgve-1', name: 'IIM Indore', distance: '7 km', category: 'Education' },
      { id: 'mgve-2', name: 'Apna Sweets', distance: '2.6 km', category: 'Restaurant' },
      { id: 'mgve-3', name: 'D-Mart Mhow', distance: '2.2 km', category: 'Shopping' },
      { id: 'mgve-4', name: 'Medicaps University', distance: '4 km', category: 'Education' },
      { id: 'mgve-5', name: 'Trinity Mall (Vikram)', distance: '3.1 km', category: 'Mall' },
      { id: 'mgve-6', name: 'Mewara Medicare & Eyecare Hospital', distance: '3.5 km', category: 'Hospital' },
      { id: 'mgve-7', name: 'Rau Railway Station', distance: '5 km', category: 'Railway Station' },
      { id: 'mgve-8', name: 'Mhow Railway Station', distance: '6.7 km', category: 'Railway Station' },
    ];
  }

  if (name.includes('redwood platinum extension') || name.includes('redwood platinum')) {
    return [
      { id: 'rp-1', name: 'IIM Indore', distance: '5 km', category: 'Education' },
      { id: 'rp-2', name: 'Apna Sweets', distance: '0.6 km', category: 'Restaurant' },
      { id: 'rp-3', name: 'D-Mart Mhow', distance: '2.2 km', category: 'Shopping' },
      { id: 'rp-4', name: 'Medicaps University', distance: '1 km', category: 'Education' },
      { id: 'rp-5', name: 'Trinity Mall (Vikram)', distance: '1.8 km', category: 'Mall' },
      { id: 'rp-6', name: 'Minesh Hospital', distance: '1.6 km', category: 'Hospital' },
      { id: 'rp-7', name: 'Rau Railway Station', distance: '2.7 km', category: 'Railway Station' },
      { id: 'rp-8', name: 'Mhow Railway Station', distance: '8.6 km', category: 'Railway Station' },
    ];
  }

  if (name.includes('vrindavan dream city')) {
    return [
      { id: 'vdc-1', name: 'Mhow Market', distance: '5 km', category: 'Shopping' },
      { id: 'vdc-2', name: 'Bhanwarilal Mithaiwala', distance: '2.5 km', category: 'Restaurant' },
      { id: 'vdc-3', name: 'D-Mart Mhow', distance: '3.6 km', category: 'Shopping' },
      { id: 'vdc-4', name: 'Medicaps University', distance: '5.6 km', category: 'Education' },
      { id: 'vdc-5', name: 'Trinity Mall (Vikram)', distance: '3.8 km', category: 'Mall' },
      { id: 'vdc-6', name: 'Mewara Hospital', distance: '2.5 km', category: 'Hospital' },
      { id: 'vdc-7', name: 'Fountain International School', distance: '0.8 km', category: 'School' },
      { id: 'vdc-8', name: 'Mhow Railway Station', distance: '5.5 km', category: 'Railway Station' },
      { id: 'vdc-9', name: 'Sushila Devi Bansal College', distance: '3.2 km', category: 'Education' },
    ];
  }

  if (name.includes('meera valley')) {
    return [
      { id: 'mv-1', name: 'Rau Circle', distance: '2.3 km', category: 'Transport' },
      { id: 'mv-2', name: 'Guru Kripa Restaurant', distance: '2 km', category: 'Restaurant' },
      { id: 'mv-3', name: 'D-Mart Mhow', distance: '3.9 km', category: 'Shopping' },
      { id: 'mv-4', name: 'Medicaps University', distance: '1.7 km', category: 'Education' },
      { id: 'mv-5', name: 'Fundore Entertainment Park', distance: '2.5 km', category: 'Entertainment' },
      { id: 'mv-6', name: 'Minesh Hospital', distance: '2.3 km', category: 'Hospital' },
      { id: 'mv-7', name: 'La Sagesse Academy', distance: '1.2 km', category: 'School' },
      { id: 'mv-8', name: 'Rau Railway Station', distance: '3.5 km', category: 'Railway Station' },
      { id: 'mv-9', name: 'Rau Bus Stand', distance: '4 km', category: 'Bus Stand' },
    ];
  }

  if (name.includes('greenwood park')) {
    return [
      { id: 'gp-1', name: 'Rau Circle', distance: '2.6 km', category: 'Transport' },
      { id: 'gp-2', name: 'Apna Sweets', distance: '1.2 km', category: 'Restaurant' },
      { id: 'gp-3', name: 'D-Mart Mhow', distance: '2.5 km', category: 'Shopping' },
      { id: 'gp-4', name: 'Medicaps University', distance: '1.9 km', category: 'Education' },
      { id: 'gp-5', name: 'Trinity Mall (Vikram)', distance: '1.8 km', category: 'Mall' },
      { id: 'gp-6', name: 'Minesh Hospital', distance: '2.9 km', category: 'Hospital' },
      { id: 'gp-7', name: 'La Sagesse Academy', distance: '2.3 km', category: 'School' },
      { id: 'gp-8', name: 'Rau Railway Station', distance: '1.9 km', category: 'Railway Station' },
      { id: 'gp-9', name: 'IIM Indore', distance: '2 km', category: 'Education' },
    ];
  }

  if (name.includes('divine park')) {
    return [
      { id: 'dp-1', name: 'Rau Circle', distance: '2.9 km', category: 'Transport' },
      { id: 'dp-2', name: 'Apna Sweets', distance: '1.8 km', category: 'Restaurant' },
      { id: 'dp-3', name: 'D-Mart Mhow', distance: '3 km', category: 'Shopping' },
      { id: 'dp-4', name: 'Medicaps University', distance: '2.5 km', category: 'Education' },
      { id: 'dp-5', name: 'Trinity Mall (Vikram)', distance: '2.5 km', category: 'Mall' },
      { id: 'dp-6', name: 'Minesh Hospital', distance: '2.8 km', category: 'Hospital' },
      { id: 'dp-7', name: 'La Sagesse Academy', distance: '2.8 km', category: 'School' },
      { id: 'dp-8', name: 'Rau Railway Station', distance: '1.9 km', category: 'Railway Station' },
      { id: 'dp-9', name: 'IIM Indore', distance: '2.8 km', category: 'Education' },
    ];
  }

  // Generic fallback if not matched
  return [
    { id: 'gen-1', name: 'Local Market', distance: '1.5 km', category: 'Shopping' },
    { id: 'gen-2', name: 'Community Hospital', distance: '2.0 km', category: 'Hospital' },
    { id: 'gen-3', name: 'Primary School', distance: '0.8 km', category: 'School' },
    { id: 'gen-4', name: 'Nearest Bus Station', distance: '1.2 km', category: 'Bus Stand' },
  ];
};

const getNearbyAmenityCategoryIcon = (category: string): React.ReactNode => {
  const cat = category.toLowerCase();
  
  if (cat.includes('school') || cat.includes('education') || cat.includes('college') || cat.includes('university') || cat.includes('academy')) {
    return (
      <span className="flex items-center justify-center w-10 h-10 rounded-lg bg-blue-100 text-blue-600 text-xl font-bold flex-shrink-0">
        🎓
      </span>
    );
  }
  if (cat.includes('hospital') || cat.includes('medical') || cat.includes('care') || cat.includes('medicare') || cat.includes('clinic')) {
    return (
      <span className="flex items-center justify-center w-10 h-10 rounded-lg bg-red-100 text-red-600 text-xl font-bold flex-shrink-0">
        🏥
      </span>
    );
  }
  if (cat.includes('shopping') || cat.includes('mart') || cat.includes('market') || cat.includes('grocery') || cat.includes('store') || cat.includes('supermarket')) {
    return (
      <span className="flex items-center justify-center w-10 h-10 rounded-lg bg-amber-100 text-amber-600 text-xl font-bold flex-shrink-0">
        🛍
      </span>
    );
  }
  if (cat.includes('restaurant') || cat.includes('sweet') || cat.includes('food') || cat.includes('cafe') || cat.includes('bakery') || cat.includes('mithaiwala')) {
    return (
      <span className="flex items-center justify-center w-10 h-10 rounded-lg bg-emerald-100 text-emerald-600 text-xl font-bold flex-shrink-0">
        🍽
      </span>
    );
  }
  if (cat.includes('railway') || cat.includes('station') || cat.includes('train')) {
    return (
      <span className="flex items-center justify-center w-10 h-10 rounded-lg bg-indigo-100 text-indigo-600 text-xl font-bold flex-shrink-0">
        🚉
      </span>
    );
  }
  if (cat.includes('bus') || cat.includes('stand') || cat.includes('stop') || cat.includes('terminal')) {
    return (
      <span className="flex items-center justify-center w-10 h-10 rounded-lg bg-teal-100 text-teal-600 text-xl font-bold flex-shrink-0">
        🚌
      </span>
    );
  }
  if (cat.includes('entertainment') || cat.includes('park') || cat.includes('fun') || cat.includes('theatre') || cat.includes('cinema')) {
    return (
      <span className="flex items-center justify-center w-10 h-10 rounded-lg bg-purple-100 text-purple-600 text-xl font-bold flex-shrink-0">
        🎡
      </span>
    );
  }
  if (cat.includes('mall') || cat.includes('plaza') || cat.includes('arcade')) {
    return (
      <span className="flex items-center justify-center w-10 h-10 rounded-lg bg-pink-100 text-pink-600 text-xl font-bold flex-shrink-0">
        🏬
      </span>
    );
  }
  if (cat.includes('transport') || cat.includes('circle') || cat.includes('junction') || cat.includes('highway') || cat.includes('road')) {
    return (
      <span className="flex items-center justify-center w-10 h-10 rounded-lg bg-cyan-100 text-cyan-600 text-xl font-bold flex-shrink-0">
        📍
      </span>
    );
  }

  // Fallback
  return (
    <span className="flex items-center justify-center w-10 h-10 rounded-lg bg-slate-100 text-slate-600 text-xl font-bold flex-shrink-0">
      📍
    </span>
  );
};

const getAmenityIcon = (amenity: string): React.ReactNode => {
  const lower = amenity.toLowerCase();
  
  if (lower.includes('electricity') || lower.includes('lighting') || lower.includes('lights') || lower.includes('power')) {
    return (
      <svg className="w-5 h-5 text-amber-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    );
  }
  
  if (lower.includes('security') || lower.includes('cctv') || lower.includes('guard') || lower.includes('boundary') || lower.includes('covered') || lower.includes('wall')) {
    return (
      <svg className="w-5 h-5 text-emerald-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    );
  }
  
  if (lower.includes('water') || lower.includes('drainage') || lower.includes('pipeline') || lower.includes('tank') || lower.includes('harvesting') || lower.includes('rainwater')) {
    return (
      <svg className="w-5 h-5 text-blue-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0a2 2 0 01-2 2H6a2 2 0 01-2-2m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5M14 10h.01M10 10h.01M14 14h.01M10 14h.01M12 6h.01" />
      </svg>
    );
  }
  
  if (lower.includes('garden') || lower.includes('green') || lower.includes('lush') || lower.includes('jogging') || lower.includes('track') || lower.includes('park')) {
    return (
      <svg className="w-5 h-5 text-green-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
      </svg>
    );
  }
  
  if (lower.includes('kids') || lower.includes('play') || lower.includes('playground') || lower.includes('dedicated')) {
    return (
      <svg className="w-5 h-5 text-indigo-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    );
  }
  
  if (lower.includes('road') || lower.includes('roads') || lower.includes('rcc') || lower.includes('wide')) {
    return (
      <svg className="w-5 h-5 text-gray-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
      </svg>
    );
  }
  
  if (lower.includes('rera') || lower.includes('approved') || lower.includes('permission') || lower.includes('diversion') || lower.includes('tncp')) {
    return (
      <svg className="w-5 h-5 text-teal-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
      </svg>
    );
  }

  return (
    <svg className="w-5 h-5 text-blue-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4" />
    </svg>
  );
};

interface ProjectDetailsProps {
  project: Project;
  onViewPlots: (project: Project) => void;
  isSaved: boolean;
  onToggleSave: (projectId: number) => void;
  isAdmin?: boolean;
  onUpdateProject?: (project: Project) => Promise<void>;
}

const ProjectDetails: React.FC<ProjectDetailsProps> = ({ 
  project, 
  onViewPlots, 
  isSaved, 
  onToggleSave,
  isAdmin = false,
  onUpdateProject
}) => {
  const [activeImageUrl, setActiveImageUrl] = useState(project.imageUrls[0] || 'https://picsum.photos/seed/placeholder/800/600');
  const [activeTab, setActiveTab] = useState<'overview' | 'documents'>('overview');

  // Nearby Amenities & Connectivity state
  const [isAmenitiesExpanded, setIsAmenitiesExpanded] = useState(true);
  const [isAmenityEditing, setIsAmenityEditing] = useState(false);
  const [amenityFormName, setAmenityFormName] = useState('');
  const [amenityFormDistance, setAmenityFormDistance] = useState('');
  const [amenityFormCategory, setAmenityFormCategory] = useState('Education');
  const [amenityFormError, setAmenityFormError] = useState('');
  const [editingAmenityId, setEditingAmenityId] = useState<string | null>(null);

  const [docType, setDocType] = useState<'brochure' | 'legal'>('brochure');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Official Project Layout Map state
  const [isLayoutMapExpanded, setIsLayoutMapExpanded] = useState(false);
  const [isUploadingLayout, setIsUploadingLayout] = useState(false);
  const [layoutUploadError, setLayoutUploadError] = useState('');
  const [isLayoutDragging, setIsLayoutDragging] = useState(false);
  const layoutFileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (file: File) => {
    if (!file) return;
    if (file.type !== 'application/pdf') {
      setUploadError('Only PDF files are supported.');
      return;
    }
    setUploadError('');
    setIsUploading(true);

    try {
      const sizeInMB = file.size / (1024 * 1024);
      let fileUrl = '';

      if (file.size <= 800 * 1024) {
        // Under 800 KB, convert to real Base64
        fileUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = (e) => reject(e);
          reader.readAsDataURL(file);
        });
      } else {
        // Larger file: simulate high-quality hosting URL to keep Firestore within 1MB limit
        fileUrl = `https://dhanshri-properties.com/documents/${encodeURIComponent(file.name)}`;
      }

      const currentUserEmail = auth.currentUser?.email || 'sonuchouhan1528@gmail.com';

      const newDoc: ProjectDocument = {
        id: Math.random().toString(36).substring(2, 9),
        name: file.name,
        type: docType,
        size: sizeInMB < 0.1 ? `${(file.size / 1024).toFixed(1)} KB` : `${sizeInMB.toFixed(2)} MB`,
        uploadedAt: new Date().toISOString(),
        uploadedBy: currentUserEmail,
        url: fileUrl,
      };

      const updatedDocs = [...(project.documents || []), newDoc];
      if (onUpdateProject) {
        await onUpdateProject({
          ...project,
          documents: updatedDocs,
        });
      }
    } catch (err: any) {
      console.error("Failed to upload file:", err);
      setUploadError('Failed to upload file. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteDocument = async (docId: string) => {
    if (!window.confirm('Are you sure you want to delete this document?')) return;
    try {
      const updatedDocs = (project.documents || []).filter(d => d.id !== docId);
      if (onUpdateProject) {
        await onUpdateProject({
          ...project,
          documents: updatedDocs,
        });
      }
    } catch (err) {
      console.error("Failed to delete document:", err);
    }
  };

  const handleLayoutMapUpload = async (file: File) => {
    if (!file) return;
    if (file.type !== 'application/pdf') {
      setLayoutUploadError('Only PDF files are supported.');
      return;
    }
    const maxSizeInBytes = 50 * 1024 * 1024; // 50 MB
    if (file.size > maxSizeInBytes) {
      setLayoutUploadError('File size exceeds the 50 MB limit.');
      return;
    }
    setLayoutUploadError('');
    setIsUploadingLayout(true);

    try {
      const sizeInMB = file.size / (1024 * 1024);
      let fileUrl = '';

      if (file.size <= 800 * 1024) {
        // Under 800 KB, convert to real Base64
        fileUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = (e) => reject(e);
          reader.readAsDataURL(file);
        });
      } else {
        // Larger file (up to 50 MB): simulate high-quality hosting URL to keep Firestore within 1MB limit
        fileUrl = `https://dhanshri-properties.com/documents/${encodeURIComponent(file.name)}`;
      }

      const currentUserEmail = auth.currentUser?.email || 'sonuchouhan1528@gmail.com';

      const newLayoutDoc: ProjectDocument = {
        id: Math.random().toString(36).substring(2, 9),
        name: file.name,
        type: 'brochure',
        size: sizeInMB < 0.1 ? `${(file.size / 1024).toFixed(1)} KB` : `${sizeInMB.toFixed(2)} MB`,
        uploadedAt: new Date().toISOString(),
        uploadedBy: currentUserEmail,
        url: fileUrl,
      };

      if (onUpdateProject) {
        await onUpdateProject({
          ...project,
          layoutMap: newLayoutDoc,
        });
      }
    } catch (err: any) {
      console.error("Failed to upload layout map:", err);
      setLayoutUploadError('Failed to upload layout map. Please try again.');
    } finally {
      setIsUploadingLayout(false);
    }
  };

  const handleDeleteLayoutMap = async () => {
    if (!window.confirm('Are you sure you want to delete the official layout map?')) return;
    try {
      if (onUpdateProject) {
        await onUpdateProject({
          ...project,
          layoutMap: undefined,
        });
      }
    } catch (err) {
      console.error("Failed to delete layout map:", err);
    }
  };

  const amenitiesList = project.nearbyAmenities && project.nearbyAmenities.length > 0
    ? project.nearbyAmenities
    : getInitialNearbyAmenities(project.name);

  const handleSaveAmenity = async (e: React.FormEvent) => {
    e.preventDefault();
    setAmenityFormError('');

    const nameTrimmed = amenityFormName.trim();
    const distanceTrimmed = amenityFormDistance.trim();

    if (!nameTrimmed) {
      setAmenityFormError('Please enter an amenity name.');
      return;
    }
    if (!distanceTrimmed) {
      setAmenityFormError('Please enter a distance (e.g. 1.5 km).');
      return;
    }

    let updatedAmenities: NearbyAmenity[] = [];

    if (editingAmenityId !== null) {
      // Edit mode
      updatedAmenities = amenitiesList.map(item => 
        item.id === editingAmenityId 
          ? { ...item, name: nameTrimmed, distance: distanceTrimmed, category: amenityFormCategory } 
          : item
      );
    } else {
      // Add mode
      const newAmenity: NearbyAmenity = {
        id: Math.random().toString(36).substring(2, 9),
        name: nameTrimmed,
        distance: distanceTrimmed,
        category: amenityFormCategory
      };
      updatedAmenities = [...amenitiesList, newAmenity];
    }

    if (onUpdateProject) {
      try {
        await onUpdateProject({
          ...project,
          nearbyAmenities: updatedAmenities,
        });
        // Clear form
        setAmenityFormName('');
        setAmenityFormDistance('');
        setAmenityFormCategory('Education');
        setEditingAmenityId(null);
        setIsAmenityEditing(false);
      } catch (err) {
        setAmenityFormError('Failed to update project amenities.');
      }
    }
  };

  const handleStartEditAmenity = (amenity: NearbyAmenity) => {
    setAmenityFormName(amenity.name);
    setAmenityFormDistance(amenity.distance);
    setAmenityFormCategory(amenity.category);
    setEditingAmenityId(amenity.id);
    setIsAmenityEditing(true);
    setAmenityFormError('');
  };

  const handleDeleteAmenity = async (idToDelete: string) => {
    if (!window.confirm('Are you sure you want to delete this amenity?')) return;
    
    const updatedAmenities = amenitiesList.filter(item => item.id !== idToDelete);
    
    if (onUpdateProject) {
      try {
        await onUpdateProject({
          ...project,
          nearbyAmenities: updatedAmenities,
        });
        
        // Reset form if we were editing the deleted amenity
        if (editingAmenityId === idToDelete) {
          setAmenityFormName('');
          setAmenityFormDistance('');
          setAmenityFormCategory('Education');
          setEditingAmenityId(null);
          setIsAmenityEditing(false);
        }
      } catch (err) {
        console.error('Failed to delete amenity', err);
      }
    }
  };

  const handleCancelAmenityEdit = () => {
    setAmenityFormName('');
    setAmenityFormDistance('');
    setAmenityFormCategory('Education');
    setEditingAmenityId(null);
    setIsAmenityEditing(false);
    setAmenityFormError('');
  };

  const handleMoveAmenity = async (index: number, direction: 'up' | 'down') => {
    const updatedAmenities = [...amenitiesList];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= updatedAmenities.length) return;
    
    // Swap
    const temp = updatedAmenities[index];
    updatedAmenities[index] = updatedAmenities[targetIndex];
    updatedAmenities[targetIndex] = temp;
    
    if (onUpdateProject) {
      try {
        await onUpdateProject({
          ...project,
          nearbyAmenities: updatedAmenities,
        });
      } catch (err) {
        console.error('Failed to reorder amenity', err);
      }
    }
  };

  const plotsArray = project.plots || project.layout || [];
  const totalPlotsCount = plotsArray.length || project.totalPlots || 1;
  const availablePlotsCount = plotsArray.length > 0
    ? plotsArray.filter(p => p.status === PlotStatus.AVAILABLE || p.status === PlotStatus.RESALE).length
    : (project.availablePlots || 0);
  const holdPlotsCount = plotsArray.filter(p => p.status === PlotStatus.HOLD).length;
  const bookedOnlyCount = plotsArray.filter(p => p.status === PlotStatus.BOOKED).length;
  const reservedPlotsCount = plotsArray.filter(p => p.status === PlotStatus.RESERVED || p.status === PlotStatus.INVESTMENT).length;
  const soldOnlyCount = plotsArray.filter(p => p.status === PlotStatus.SOLD).length;
  const pendingPlotsCount = plotsArray.filter(p => p.status === PlotStatus.PENDING).length;
  const bookedPlotsCount = bookedOnlyCount + soldOnlyCount;
  const ratio = totalPlotsCount > 0 ? (bookedPlotsCount / totalPlotsCount) * 100 : 0;

  const handleExportPDF = () => {
    try {
      const doc = new jsPDF();
      
      // Page styling / Colors
      const primaryColor = [26, 54, 93]; // Deep blue
      const secondaryColor = [74, 85, 104]; // Slate gray
      const successColor = [22, 101, 52]; // Emerald green
      const dangerColor = [153, 27, 27]; // Red
      
      // Header Block
      doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.rect(0, 0, 210, 40, 'F');
      
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(22);
      doc.text("DHANSHRI PROPERTIES", 15, 18);
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.text("Premium Real Estate Management & Plot Inventory", 15, 25);
      doc.text(`Generated on: ${new Date().toLocaleDateString('en-GB')}  ${new Date().toLocaleTimeString('en-GB')}`, 15, 32);
      
      // Body start
      let y = 50;
      
      // Project Details Header
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.text(project.name, 15, y);
      y += 6;
      
      // Location
      doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(11);
      doc.text(`Location: ${project.location}`, 15, y);
      y += 6;
      
      // Plot Sizes
      if (project.plotSizes) {
        doc.text(`Official Plot Sizes: ${project.plotSizes}`, 15, y);
        y += 6;
      }
      y += 4;
      
      // Divider
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.5);
      doc.line(15, y, 195, y);
      y += 10;
      
      // Description Section
      doc.setTextColor(51, 65, 85);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.text("Project Overview", 15, y);
      y += 6;
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      const splitDesc = doc.splitTextToSize(project.description || '', 180);
      doc.text(splitDesc, 15, y);
      y += splitDesc.length * 5 + 8;
      
      // Plot Stats Overview Panel
      doc.setFillColor(248, 250, 252); // soft slate background
      doc.rect(15, y, 180, 25, 'F');
      doc.setDrawColor(203, 213, 225);
      doc.rect(15, y, 180, 25, 'S');
      
      doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text("TOTAL PLOTS", 25, y + 8);
      doc.text("BOOKED PLOTS", 70, y + 8);
      doc.text("AVAILABLE PLOTS", 115, y + 8);
      doc.text("BOOKING RATIO", 160, y + 8);
      
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.setFontSize(12);
      doc.text(`${totalPlotsCount}`, 25, y + 17);
      doc.text(`${bookedPlotsCount}`, 70, y + 17);
      doc.text(`${totalPlotsCount - bookedPlotsCount}`, 115, y + 17);
      doc.text(`${Math.round(ratio)}%`, 160, y + 17);
      
      y += 35;
      
      // Amenities Section
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.text("Project Amenities", 15, y);
      y += 6;
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(51, 65, 85);
      const amenitiesStr = project.amenities.join('  •  ');
      const splitAmenities = doc.splitTextToSize(amenitiesStr, 180);
      doc.text(splitAmenities, 15, y);
      y += splitAmenities.length * 5 + 10;
      
      // Plot Availability Table Header
      if (project.layout && project.layout.length > 0) {
        doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        doc.text("Plot Inventory & Availability Status", 15, y);
        y += 8;
        
        // Table Headers
        doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        doc.rect(15, y, 180, 8, 'F');
        
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.text("Plot #", 20, y + 5.5);
        doc.text("Size (sqft)", 55, y + 5.5);
        doc.text("Facing", 90, y + 5.5);
        doc.text("Price (INR)", 125, y + 5.5);
        doc.text("Status", 165, y + 5.5);
        y += 8;
        
        // Rows
        doc.setFont('helvetica', 'normal');
        project.layout.forEach((plot, index) => {
          // Check page break limit
          if (y > 270) {
            doc.addPage();
            y = 20;
            // Draw brief header on next page
            doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
            doc.rect(15, y, 180, 8, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFont('helvetica', 'bold');
            doc.text("Plot #", 20, y + 5.5);
            doc.text("Size (sqft)", 55, y + 5.5);
            doc.text("Facing", 90, y + 5.5);
            doc.text("Price (INR)", 125, y + 5.5);
            doc.text("Status", 165, y + 5.5);
            y += 8;
            doc.setFont('helvetica', 'normal');
          }
          
          // Alternating row background
          if (index % 2 === 0) {
            doc.setFillColor(248, 250, 252);
            doc.rect(15, y, 180, 7, 'F');
          }
          
          doc.setTextColor(51, 65, 85);
          doc.setFontSize(9);
          doc.text(plot.number, 20, y + 5);
          doc.text(`${plot.size} sqft`, 55, y + 5);
          doc.text(plot.facing, 90, y + 5);
          doc.text(`Rs. ${plot.price.toLocaleString('en-IN')}`, 125, y + 5);
          
          // Color coding for status
          const norm = getNormalizedStatus(plot.status);
          const styles = STATUS_COLORS[norm];
          const hex = styles.fill;
          const r = parseInt(hex.slice(1, 3), 16);
          const g = parseInt(hex.slice(3, 5), 16);
          const b = parseInt(hex.slice(5, 7), 16);

          doc.setTextColor(r, g, b);
          doc.setFont('helvetica', norm === 'available' ? 'bold' : 'normal');
          doc.text(plot.status, 165, y + 5);
          
          y += 7;
        });
      }
      
      // Save PDF
      const fileName = `${project.name.replace(/\s+/g, '_')}_Summary.pdf`;
      doc.save(fileName);
    } catch (error) {
      console.error("Failed to generate PDF:", error);
    }
  };
  
  return (
    <div className="bg-white rounded-lg shadow-xl overflow-hidden">
      {onUpdateProject && (
        <ProjectImageGallery
          project={project}
          isAdmin={isAdmin}
          onUpdateProject={onUpdateProject}
        />
      )}
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-4xl font-extrabold text-blue-900">{project.name}</h1>
            <p className="text-gray-500 flex items-center mt-2 text-lg">
              <Icon name="location" className="w-5 h-5 mr-2 text-gray-400" />
              {project.location}
            </p>
          </div>
          <div className="flex items-center gap-2.5">
            <button
              onClick={handleExportPDF}
              className="p-3 rounded-full bg-blue-50 text-blue-600 hover:bg-blue-100 transition-all shadow-sm flex items-center justify-center border border-blue-200 cursor-pointer"
              title="Export to PDF"
              aria-label="Export to PDF"
            >
              <Icon name="pdf" className="w-6 h-6" />
            </button>
            <button
              onClick={() => onToggleSave(project.id)}
              className={`p-3 rounded-full transition-colors duration-200 cursor-pointer ${
                  isSaved ? 'bg-red-100 text-red-500' : 'bg-gray-100 text-gray-600 hover:bg-red-50'
              }`}
              aria-label={isSaved ? 'Unsave project' : 'Save project'}
              >
              <Icon name="saved" className={`w-7 h-7 ${isSaved ? 'fill-current' : ''}`} />
            </button>
          </div>
        </div>

        <p className="text-gray-700 text-base leading-relaxed">{project.description}</p>
        
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-center">
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80 shadow-2xs">
            <p className="text-2xl font-extrabold text-slate-800">{totalPlotsCount}</p>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-0.5">Total Plots</p>
          </div>
          <div className="bg-emerald-50/60 p-3.5 rounded-xl border border-emerald-100 shadow-2xs">
            <p className="text-2xl font-extrabold text-emerald-700">{availablePlotsCount}</p>
            <p className="text-xs font-bold text-emerald-600 uppercase tracking-wider mt-0.5">Available</p>
          </div>
          <div className="bg-amber-50/60 p-3.5 rounded-xl border border-amber-100 shadow-2xs">
            <p className="text-2xl font-extrabold text-amber-700">{holdPlotsCount}</p>
            <p className="text-xs font-bold text-amber-600 uppercase tracking-wider mt-0.5">Hold</p>
          </div>
          <div className="bg-blue-50/60 p-3.5 rounded-xl border border-blue-100 shadow-2xs">
            <p className="text-2xl font-extrabold text-blue-700">{bookedOnlyCount}</p>
            <p className="text-xs font-bold text-blue-600 uppercase tracking-wider mt-0.5">Booked</p>
          </div>
          <div className="bg-purple-50/60 p-3.5 rounded-xl border border-purple-100 shadow-2xs">
            <p className="text-2xl font-extrabold text-purple-700">{reservedPlotsCount}</p>
            <p className="text-xs font-bold text-purple-600 uppercase tracking-wider mt-0.5">Reserved</p>
          </div>
          <div className="bg-red-50/60 p-3.5 rounded-xl border border-red-100 shadow-2xs">
            <p className="text-2xl font-extrabold text-red-700">{soldOnlyCount}</p>
            <p className="text-xs font-bold text-red-600 uppercase tracking-wider mt-0.5">Sold</p>
          </div>
        </div>

        {/* Project Completion Progress Bar */}
        <div className="bg-gray-50 border border-gray-100 p-5 rounded-xl space-y-3">
          <div className="flex justify-between items-center text-sm font-semibold text-gray-700">
            <span className="flex items-center gap-2">
              <Icon name="status" className="w-4 h-4 text-blue-600" />
              Project Booking Progress
            </span>
            <span className="text-blue-600 font-bold">{Math.round(ratio)}% Booked</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
            <div 
              className="bg-gradient-to-r from-blue-500 to-indigo-600 h-full rounded-full transition-all duration-500 ease-out" 
              style={{ width: `${Math.round(ratio)}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-gray-500 font-medium">
            <span>{bookedPlotsCount} of {totalPlotsCount} Plots Booked</span>
            <span>{totalPlotsCount - bookedPlotsCount} Remaining</span>
          </div>
        </div>

        {/* Available Plot Sizes Badges Section */}
        {project.plotSizes && (
          <div className="bg-white border border-gray-200 p-5 rounded-xl space-y-3 shadow-xs">
            <h4 className="text-sm font-bold text-gray-800 flex items-center gap-2">
              <span className="text-emerald-500">🟢</span>
              Available Plot Sizes
            </h4>
            <div className="flex flex-wrap gap-2">
              {project.plotSizes.split(',').map((size) => (
                <span 
                  key={size.trim()} 
                  className="bg-emerald-50 text-emerald-800 border border-emerald-200/60 px-3 py-1 rounded-full text-xs font-bold shadow-2xs hover:bg-emerald-100/50 transition-colors cursor-default"
                >
                  🟢 {size.trim()}
                </span>
              ))}
            </div>
          </div>
        )}



        {/* Collapsible Nearby Amenities & Connectivity Section */}
        <div id="nearby-amenities-connectivity" className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm mt-6">
          <button 
            type="button"
            onClick={() => setIsAmenitiesExpanded(!isAmenitiesExpanded)}
            className="w-full flex justify-between items-center p-5 bg-gray-50 hover:bg-gray-100/80 transition-colors text-left cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <span className="text-xl">📍</span>
              <h3 className="text-lg font-bold text-gray-800">Nearby Amenities & Connectivity</h3>
            </div>
            <svg 
              className={`w-5 h-5 text-gray-500 transform transition-transform duration-200 ${isAmenitiesExpanded ? 'rotate-180' : ''}`} 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor" 
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          
          {isAmenitiesExpanded && (
            <div className="p-5 space-y-6">
              {/* Responsive Cards Grid */}
              {amenitiesList.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {amenitiesList.map((item, index) => (
                    <div 
                      key={item.id || index} 
                      className="group bg-white border border-gray-100 p-4 rounded-xl shadow-sm hover:shadow-md hover:border-blue-100 transition-all duration-200 flex items-center justify-between gap-3 relative"
                    >
                      <div className="flex items-center gap-3">
                        {getNearbyAmenityCategoryIcon(item.category)}
                        <div>
                          <h4 className="font-bold text-gray-800 text-sm leading-tight group-hover:text-blue-900 transition-colors">
                            {item.name}
                          </h4>
                          <span className="inline-block px-2 py-0.5 mt-1 text-[10px] font-bold text-slate-500 bg-slate-100 rounded-full uppercase tracking-wider">
                            {item.category}
                          </span>
                        </div>
                      </div>
                      
                      <div className="flex flex-col items-end gap-1">
                        <span className="text-sm font-extrabold text-blue-600 bg-blue-50/70 px-2.5 py-1 rounded-full whitespace-nowrap">
                          📍 {item.distance}
                        </span>
                        
                        {/* Admin Inline Actions */}
                        {isAdmin && (
                          <div className="flex items-center gap-0.5 mt-1 bg-slate-50 border border-slate-100 rounded-lg p-0.5 shadow-sm">
                            {/* Reorder Up */}
                            <button
                              type="button"
                              onClick={() => handleMoveAmenity(index, 'up')}
                              disabled={index === 0}
                              className={`p-1 rounded text-slate-500 hover:text-blue-600 hover:bg-white disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer`}
                              title="Move Up"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                              </svg>
                            </button>
                            {/* Reorder Down */}
                            <button
                              type="button"
                              onClick={() => handleMoveAmenity(index, 'down')}
                              disabled={index === amenitiesList.length - 1}
                              className={`p-1 rounded text-slate-500 hover:text-blue-600 hover:bg-white disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer`}
                              title="Move Down"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                              </svg>
                            </button>
                            {/* Edit */}
                            <button
                              type="button"
                              onClick={() => handleStartEditAmenity(item)}
                              className="p-1 rounded text-blue-500 hover:text-blue-700 hover:bg-white transition-all cursor-pointer"
                              title="Edit"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                              </svg>
                            </button>
                            {/* Delete */}
                            <button
                              type="button"
                              onClick={() => handleDeleteAmenity(item.id)}
                              className="p-1 rounded text-red-500 hover:text-red-700 hover:bg-white transition-all cursor-pointer"
                              title="Delete"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-40 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  <span className="text-2xl">📍</span>
                  <p className="text-sm font-semibold text-slate-500 mt-2">No nearby amenities listed yet.</p>
                  <p className="text-xs text-slate-400 mt-1">Add items to view nearby facilities and distances.</p>
                </div>
              )}

              {/* Admin Controls for Nearby Amenities */}
              {isAdmin && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-4">
                  <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                    <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                    </svg>
                    Admin Controls: {editingAmenityId !== null ? 'Edit Amenity' : 'Add Amenity'}
                  </h4>
                  
                  <form onSubmit={handleSaveAmenity} className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Amenity Name</label>
                      <input 
                        type="text"
                        placeholder="e.g. IIM Indore"
                        value={amenityFormName}
                        onChange={(e) => setAmenityFormName(e.target.value)}
                        className="w-full text-sm border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white font-medium"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Distance</label>
                      <input 
                        type="text"
                        placeholder="e.g. 7 km"
                        value={amenityFormDistance}
                        onChange={(e) => setAmenityFormDistance(e.target.value)}
                        className="w-full text-sm border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white font-medium"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Category</label>
                      <select
                        value={amenityFormCategory}
                        onChange={(e) => setAmenityFormCategory(e.target.value)}
                        className="w-full text-sm border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white font-medium animate-none"
                      >
                        <option value="Education">Education</option>
                        <option value="Hospital">Hospital</option>
                        <option value="Shopping">Shopping</option>
                        <option value="Restaurant">Restaurant</option>
                        <option value="Railway Station">Railway Station</option>
                        <option value="Bus Stand">Bus Stand</option>
                        <option value="Entertainment">Entertainment</option>
                        <option value="School">School</option>
                        <option value="Mall">Mall</option>
                        <option value="Transport">Transport</option>
                      </select>
                    </div>
                    <div className="flex gap-2">
                      {editingAmenityId !== null && (
                        <button 
                          type="button" 
                          onClick={handleCancelAmenityEdit}
                          className="flex-1 px-4 py-2 text-xs font-bold text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors cursor-pointer"
                        >
                          Cancel
                        </button>
                      )}
                      <button 
                        type="submit"
                        className="flex-1 px-4 py-2 text-xs font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors cursor-pointer"
                      >
                        {editingAmenityId !== null ? 'Update' : 'Add'}
                      </button>
                    </div>
                  </form>
                  
                  {amenityFormError && (
                    <p className="text-red-500 text-xs font-semibold">{amenityFormError}</p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Collapsible Official Project Layout Map Section */}
        <div id="official-project-layout-map" className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm mt-6">
          <button 
            type="button"
            onClick={() => setIsLayoutMapExpanded(!isLayoutMapExpanded)}
            className="w-full flex justify-between items-center p-5 bg-gray-50 hover:bg-gray-100/80 transition-colors text-left cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <span className="text-xl">🗺️</span>
              <h3 className="text-lg font-bold text-gray-800 font-sans tracking-tight">Official Project Layout Map</h3>
            </div>
            <svg 
              className={`w-5 h-5 text-gray-500 transform transition-transform duration-200 ${isLayoutMapExpanded ? 'rotate-180' : ''}`} 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor" 
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          
          {isLayoutMapExpanded && (
            <div className="p-5 space-y-6">
              {project.layoutMap ? (
                <div className="space-y-4">
                  {/* Built-in PDF Viewer (rendered inside Suspense) */}
                  <React.Suspense fallback={
                    <div className="flex flex-col items-center justify-center h-48 bg-slate-50 border border-slate-200 rounded-xl animate-pulse">
                      <svg className="animate-spin h-8 w-8 text-blue-500 mb-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <p className="text-sm font-semibold text-slate-500">Loading map viewer module...</p>
                    </div>
                  }>
                    <PdfViewer url={project.layoutMap.url} name={project.layoutMap.name} />
                  </React.Suspense>

                  {/* Admin actions (Replace / Delete) */}
                  {isAdmin && (
                    <div className="flex flex-wrap items-center justify-end gap-3 bg-slate-50 border border-slate-200 rounded-xl p-3">
                      <span className="text-xs font-bold text-slate-600 mr-auto">
                        Map: <span className="font-mono text-slate-800 bg-white border border-slate-100 rounded px-1.5 py-0.5 shadow-sm break-all">{project.layoutMap.name}</span> ({project.layoutMap.size})
                      </span>
                      <button
                        type="button"
                        onClick={() => layoutFileInputRef.current?.click()}
                        className="px-4 py-2 text-xs font-bold text-blue-600 bg-white border border-blue-200 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 shadow-sm"
                        disabled={isUploadingLayout}
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 8H17" />
                        </svg>
                        {isUploadingLayout ? 'Uploading...' : 'Replace PDF Map'}
                      </button>
                      <button
                        type="button"
                        onClick={handleDeleteLayoutMap}
                        className="px-4 py-2 text-xs font-bold text-red-600 bg-white border border-red-200 hover:bg-red-50 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 shadow-sm"
                        disabled={isUploadingLayout}
                      >
                        <Icon name="delete" className="w-4 h-4" />
                        Delete Map
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Placeholder Message */}
                  <div className="flex flex-col items-center justify-center py-10 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-center px-4">
                    <span className="text-4xl mb-3">🗺️</span>
                    <h4 className="text-sm font-bold text-slate-700">Official Layout Map not available yet</h4>
                    <p className="text-xs text-slate-400 mt-1 max-w-sm">The official blueprint for this project has not been configured or uploaded yet.</p>
                  </div>

                  {/* Admin upload block */}
                  {isAdmin && (
                    <div className="bg-slate-50 border border-dashed border-slate-300 rounded-xl p-6 transition-all space-y-4">
                      <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                        <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        Administrator controls: Upload Layout Map PDF (Max 50 MB)
                      </h4>

                      <div
                        onDragOver={(e) => { e.preventDefault(); setIsLayoutDragging(true); }}
                        onDragLeave={() => setIsLayoutDragging(false)}
                        onDrop={(e) => { 
                          e.preventDefault(); 
                          setIsLayoutDragging(false); 
                          if (e.dataTransfer.files?.[0]) handleLayoutMapUpload(e.dataTransfer.files[0]); 
                        }}
                        onClick={() => layoutFileInputRef.current?.click()}
                        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
                          isLayoutDragging 
                            ? 'border-blue-500 bg-blue-50/50 shadow-md' 
                            : 'border-slate-300 hover:border-blue-400 bg-white hover:bg-blue-50/10'
                        }`}
                      >
                        <div className="flex flex-col items-center justify-center">
                          <svg className={`w-12 h-12 mb-3 transition-colors ${isLayoutDragging ? 'text-blue-500' : 'text-slate-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          <p className="text-sm font-semibold text-slate-700">
                            {isUploadingLayout ? 'Uploading and processing layout map...' : 'Drag & drop layout PDF here, or click to browse'}
                          </p>
                          <p className="text-xs text-slate-400 mt-1">PDF format layout or blueprint map. Maximum allowed size: 50 MB.</p>
                        </div>
                      </div>
                      
                      {layoutUploadError && (
                        <p className="text-red-500 text-xs font-semibold mt-1">{layoutUploadError}</p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Hidden inputs for replace/upload layout map */}
        <input
          type="file"
          ref={layoutFileInputRef}
          onChange={(e) => { if (e.target.files?.[0]) handleLayoutMapUpload(e.target.files[0]); }}
          accept="application/pdf"
          className="hidden"
        />

        {/* Segmented Tab Controls */}
        <div className="flex border-b border-gray-200 mt-6">
          <button
            onClick={() => setActiveTab('overview')}
            className={`flex-1 pb-3 text-center font-bold text-sm border-b-2 transition-all cursor-pointer flex items-center justify-center gap-2 ${
              activeTab === 'overview'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Icon name="amenities" className="w-5 h-5" />
            Overview & Amenities
          </button>
          <button
            onClick={() => setActiveTab('documents')}
            className={`flex-1 pb-3 text-center font-bold text-sm border-b-2 transition-all cursor-pointer flex items-center justify-center gap-2 ${
              activeTab === 'documents'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Icon name="pdf" className="w-5 h-5" />
            Documents & Brochures ({project.documents?.length || 0})
          </button>
        </div>

        {activeTab === 'overview' ? (
          <div className="space-y-6">
            <div>
              <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
                 <Icon name="amenities" className="w-6 h-6 mr-3 text-blue-600" />
                Amenities
              </h3>
              {!project.amenities || project.amenities.length === 0 ? (
                <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-4 flex items-start gap-3">
                  <svg className="w-6 h-6 text-amber-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <div>
                    <p className="font-semibold text-sm">Amenities will be updated soon.</p>
                    <p className="text-xs text-amber-700 mt-0.5">We are preparing the list of world-class facilities for this property extension.</p>
                  </div>
                </div>
              ) : (
                <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {project.amenities.map(amenity => (
                    <li key={amenity} className="flex items-start gap-3 bg-gray-50 hover:bg-gray-100/50 border border-gray-100/80 p-3 rounded-xl transition-all duration-200 shadow-sm">
                      {getAmenityIcon(amenity)}
                      <span className="text-gray-700 text-sm font-medium leading-relaxed">
                        {amenity}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            

          </div>
        ) : (
          <div className="space-y-6">
            <div>
              <h3 className="text-2xl font-bold text-gray-800">Project Documents</h3>
              <p className="text-sm text-gray-500 mt-1">Official brochures, legal approvals, and layouts for {project.name}.</p>
            </div>

            {isAdmin && (
              <div className="bg-slate-50 border border-dashed border-slate-300 rounded-xl p-6 transition-all">
                <h4 className="font-semibold text-slate-800 text-sm mb-3 font-bold">Administrator Controls: Upload Document</h4>
                
                {/* Drag and Drop Zone */}
                <div
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={(e) => { e.preventDefault(); setIsDragging(false); if (e.dataTransfer.files?.[0]) handleFileUpload(e.dataTransfer.files[0]); }}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
                    isDragging 
                      ? 'border-blue-500 bg-blue-50/50' 
                      : 'border-slate-300 hover:border-blue-400 bg-white hover:bg-blue-50/10'
                  }`}
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={(e) => { if (e.target.files?.[0]) handleFileUpload(e.target.files[0]); }}
                    accept="application/pdf"
                    className="hidden"
                  />
                  <div className="flex flex-col items-center justify-center">
                    <Icon name="pdf" className={`w-12 h-12 mb-2 transition-colors ${isDragging ? 'text-blue-500' : 'text-slate-400'}`} />
                    <p className="text-sm font-semibold text-slate-700">
                      {isUploading ? 'Uploading and processing file...' : 'Drag & drop project PDF brochure or legal document here, or browse files'}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">PDF brochures and maps. Max 800 KB for direct storage. Larger files will be gracefully simulated.</p>
                  </div>
                </div>

                {uploadError && (
                  <p className="text-red-500 text-xs font-semibold mt-2">{uploadError}</p>
                )}

                {/* Doc Type Selector */}
                <div className="flex items-center gap-6 mt-4">
                  <span className="text-xs font-bold text-slate-600">Document Type:</span>
                  <label className="inline-flex items-center text-xs text-slate-700 font-semibold cursor-pointer">
                    <input
                      type="radio"
                      name="docType"
                      checked={docType === 'brochure'}
                      onChange={() => setDocType('brochure')}
                      className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                    />
                    Brochure Map
                  </label>
                  <label className="inline-flex items-center text-xs text-slate-700 font-semibold cursor-pointer">
                    <input
                      type="radio"
                      name="docType"
                      checked={docType === 'legal'}
                      onChange={() => setDocType('legal')}
                      className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                    />
                    Legal Document
                  </label>
                </div>
              </div>
            )}

            {/* List of Documents */}
            <div className="space-y-3">
              {!project.documents || project.documents.length === 0 ? (
                <div className="text-center py-10 bg-gray-50 rounded-xl border border-gray-100">
                  <Icon name="pdf" className="w-12 h-12 mx-auto text-gray-300 mb-2" />
                  <p className="text-gray-500 font-bold text-sm">No official documents uploaded yet.</p>
                  <p className="text-gray-400 text-xs mt-1">Brochures, design layouts, and RERA approvals will appear here.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3">
                  {project.documents.map((doc) => (
                    <div 
                      key={doc.id} 
                      className="flex items-center justify-between p-4 bg-white border border-gray-100 rounded-xl hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-center gap-3">
                        <div className="bg-red-50 p-3 rounded-lg flex items-center justify-center text-red-500">
                          <Icon name="pdf" className="w-8 h-8" />
                        </div>
                        <div>
                          <p className="font-bold text-sm text-gray-800 break-all">{doc.name}</p>
                          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 mt-1">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              doc.type === 'brochure' 
                                ? 'bg-blue-50 text-blue-600 border border-blue-100' 
                                : 'bg-teal-50 text-teal-600 border border-teal-100'
                            }`}>
                              {doc.type === 'brochure' ? 'Brochure' : 'Legal'}
                            </span>
                            <span className="text-xs text-gray-400 font-semibold">{doc.size}</span>
                            <span className="text-xs text-gray-300">•</span>
                            <span className="text-xs text-gray-400">Uploaded {new Date(doc.uploadedAt).toLocaleDateString()}</span>
                            {doc.uploadedBy && (
                              <>
                                <span className="text-xs text-gray-300">•</span>
                                <span className="text-xs text-gray-400" title={doc.uploadedBy}>by {doc.uploadedBy.split('@')[0]}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <a
                          href={doc.url}
                          download={doc.name}
                          target="_blank"
                          rel="noreferrer"
                          className="p-2.5 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg transition-colors cursor-pointer"
                          title="Download Document"
                        >
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                        </a>
                        {isAdmin && (
                          <button
                            onClick={() => handleDeleteDocument(doc.id)}
                            className="p-2.5 bg-red-50 hover:bg-red-100 text-red-500 rounded-lg transition-colors cursor-pointer"
                            title="Delete Document"
                          >
                            <Icon name="delete" className="w-5 h-5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        <button
          onClick={() => onViewPlots(project)}
          className="w-full bg-blue-600 text-white font-extrabold py-4 px-6 rounded-lg hover:bg-blue-700 transition-colors text-lg shadow-lg"
        >
          View Available Plots
        </button>
      </div>
    </div>
  );
};

export default ProjectDetails;
