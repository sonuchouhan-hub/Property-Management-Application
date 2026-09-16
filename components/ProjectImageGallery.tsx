import React, { useState, useRef, useEffect } from 'react';
import { Project } from '../types';
import Icon from './common/Icon';

interface ProjectImageGalleryProps {
  project: Project;
  isAdmin: boolean;
  onUpdateProject: (updatedProject: Project) => Promise<void>;
}

export const ProjectImageGallery: React.FC<ProjectImageGalleryProps> = ({
  project,
  isAdmin,
  onUpdateProject,
}) => {
  // Use coverImage and galleryImages, falling back to imageUrls
  const coverImage = project.coverImage || project.imageUrls[0] || 'https://picsum.photos/seed/placeholder/800/600';
  const initialGallery = project.galleryImages && project.galleryImages.length > 0
    ? project.galleryImages
    : (project.imageUrls.length > 0 ? project.imageUrls : [coverImage]);

  // Combined active list of all images for the slider
  // Ensure cover image is always the first image, followed by all unique gallery images
  const allImages = Array.from(new Set([coverImage, ...initialGallery])).filter(Boolean);

  const [activeIndex, setActiveIndex] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [zoomScale, setZoomScale] = useState(1);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [estimatedSize, setEstimatedSize] = useState(0);
  const [isOptimizing, setIsOptimizing] = useState(false);

  // Swipe gesture refs/state
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);

  // Reset active index if project changes
  useEffect(() => {
    setActiveIndex(0);
  }, [project.id]);

  // Monitor project's estimated data size
  useEffect(() => {
    setEstimatedSize(JSON.stringify(project).length);
  }, [project]);

  const handleOptimizeNow = async () => {
    setIsOptimizing(true);
    setUploadError('');
    try {
      const optimizedProject = await optimizeAllProjectImages(project);
      await onUpdateProject(optimizedProject);
      setEstimatedSize(JSON.stringify(optimizedProject).length);
      setActiveIndex(0);
    } catch (err: any) {
      setUploadError(err.message || 'Optimization failed.');
    } finally {
      setIsOptimizing(false);
    }
  };

  const handlePrev = () => {
    setActiveIndex((prev) => (prev === 0 ? allImages.length - 1 : prev - 1));
    setZoomScale(1);
  };

  const handleNext = () => {
    setActiveIndex((prev) => (prev === allImages.length - 1 ? 0 : prev + 1));
    setZoomScale(1);
  };

  // Keyboard navigation for fullscreen
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isFullscreen) return;
      if (e.key === 'ArrowLeft') handlePrev();
      if (e.key === 'ArrowRight') handleNext();
      if (e.key === 'Escape') {
        setIsFullscreen(false);
        setZoomScale(1);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen, allImages.length]);

  // Touch Swipe handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.targetTouches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.targetTouches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (touchStartX.current === null || touchEndX.current === null) return;
    const diffX = touchStartX.current - touchEndX.current;
    if (diffX > 50) {
      // Swiped left -> next
      handleNext();
    } else if (diffX < -50) {
      // Swiped right -> prev
      handlePrev();
    }
    touchStartX.current = null;
    touchEndX.current = null;
  };

  // Zoom controls
  const handleZoomIn = () => {
    setZoomScale((prev) => Math.min(prev + 0.5, 3));
  };

  const handleZoomOut = () => {
    setZoomScale((prev) => Math.max(prev - 0.5, 1));
  };

  const toggleZoom = () => {
    setZoomScale((prev) => (prev > 1 ? 1 : 2));
  };

  // Compresses any base64 image down to an extremely compact JPEG (under 90KB)
  const compressBase64Image = (base64Str: string, targetMaxWidth = 800, targetQuality = 0.65): Promise<string> => {
    if (!base64Str || !base64Str.startsWith('data:image/')) {
      return Promise.resolve(base64Str);
    }
    // If already under 80KB (approx 106,000 characters), no need to compress further unless requested
    if (base64Str.length < 100000 && targetMaxWidth === 800) {
      return Promise.resolve(base64Str);
    }

    return new Promise((resolve) => {
      const img = new Image();
      img.src = base64Str;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        const MAX_WIDTH = targetMaxWidth;
        const MAX_HEIGHT = targetMaxWidth;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(base64Str);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        
        let dataUrl = canvas.toDataURL('image/jpeg', targetQuality);
        
        // If it's still larger than 110,000 chars, drop quality further
        if (dataUrl.length > 110000) {
          dataUrl = canvas.toDataURL('image/jpeg', 0.45);
        }

        // If still too large, downscale further to 600px
        if (dataUrl.length > 110000) {
          const miniCanvas = document.createElement('canvas');
          const miniScale = Math.min(600 / width, 600 / height);
          if (miniScale < 1) {
            miniCanvas.width = width * miniScale;
            miniCanvas.height = height * miniScale;
            const mCtx = miniCanvas.getContext('2d');
            if (mCtx) {
              mCtx.drawImage(canvas, 0, 0, miniCanvas.width, miniCanvas.height);
              dataUrl = miniCanvas.toDataURL('image/jpeg', 0.4);
            }
          }
        }

        resolve(dataUrl);
      };
      img.onerror = () => {
        resolve(base64Str);
      };
    });
  };

  // HTML5 Canvas compression helper for newly uploaded files
  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        compressBase64Image(base64, 800, 0.65)
          .then(resolve)
          .catch(reject);
      };
      reader.onerror = (err) => reject(err);
    });
  };

  // Helper to optimize all images in the project if the document size gets close to 1MB
  const optimizeAllProjectImages = async (proj: Project): Promise<Project> => {
    const optimizedGallery: string[] = [];
    let optimizedCover = proj.coverImage;

    if (proj.coverImage && proj.coverImage.startsWith('data:image/')) {
      optimizedCover = await compressBase64Image(proj.coverImage, 700, 0.55);
    }

    if (proj.galleryImages) {
      for (const img of proj.galleryImages) {
        if (img && img.startsWith('data:image/')) {
          const opt = await compressBase64Image(img, 700, 0.55);
          optimizedGallery.push(opt);
        } else {
          optimizedGallery.push(img);
        }
      }
    }

    return {
      ...proj,
      coverImage: optimizedCover,
      galleryImages: optimizedGallery,
      imageUrls: Array.from(new Set([optimizedCover, ...optimizedGallery])).filter(Boolean) as string[],
    };
  };

  // File Upload Handlers
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    await processUploadedFiles(Array.from(files));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const processUploadedFiles = async (files: File[]) => {
    setIsUploading(true);
    setUploadError('');

    try {
      const newImages: string[] = [];
      for (const file of files) {
        // Validate type
        const allowedTypes = ['image/png', 'image/jpg', 'image/jpeg', 'image/webp'];
        if (!allowedTypes.includes(file.type.toLowerCase())) {
          throw new Error(`File type ${file.name} is not supported. Please upload PNG, JPG, JPEG, or WEBP.`);
        }
        // Validate size (10 MB limit)
        if (file.size > 10 * 1024 * 1024) {
          throw new Error(`File ${file.name} is too large. Maximum size is 10 MB.`);
        }

        // Compress and convert to base64
        const compressedBase64 = await compressImage(file);
        newImages.push(compressedBase64);
      }

      // Add to gallery
      const updatedGallery = [...initialGallery, ...newImages];
      // Set the first uploaded image as cover image if there is no cover image yet
      const finalCover = coverImage && !coverImage.includes('placeholder') ? coverImage : (updatedGallery[0] || '');
      
      let updatedProject: Project = {
        ...project,
        coverImage: finalCover,
        galleryImages: updatedGallery,
        imageUrls: Array.from(new Set([finalCover, ...updatedGallery])).filter(Boolean),
      };

      // Check estimated size
      let estimatedSize = JSON.stringify(updatedProject).length;
      if (estimatedSize > 850000) {
        // Attempt an aggressive compression run across all project images to stay under limit
        updatedProject = await optimizeAllProjectImages(updatedProject);
        estimatedSize = JSON.stringify(updatedProject).length;
        if (estimatedSize > 950000) {
          throw new Error("Cannot save further images. The project data size would exceed Firestore's 1MB database limit. Please remove some existing images to free up space.");
        }
      }

      await onUpdateProject(updatedProject);
      setActiveIndex(updatedProject.imageUrls.indexOf(newImages[0]) >= 0 ? updatedProject.imageUrls.indexOf(newImages[0]) : 0);
    } catch (err: any) {
      setUploadError(err.message || 'Failed to process files.');
    } finally {
      setIsUploading(false);
    }
  };

  // Delete current active image
  const handleDeleteImage = async (indexToDelete: number) => {
    if (allImages.length <= 1) {
      setUploadError('A project must contain at least one image.');
      return;
    }

    const imageToDelete = allImages[indexToDelete];
    const isDeletingCover = imageToDelete === coverImage;

    // Filter gallery
    const updatedGallery = initialGallery.filter(img => img !== imageToDelete);
    
    // Select new cover if needed
    let finalCover = coverImage;
    if (isDeletingCover) {
      finalCover = updatedGallery[0] || 'https://picsum.photos/seed/placeholder/800/600';
    }

    const updatedProject: Project = {
      ...project,
      coverImage: finalCover,
      galleryImages: updatedGallery,
      imageUrls: Array.from(new Set([finalCover, ...updatedGallery])).filter(Boolean),
    };

    await onUpdateProject(updatedProject);
    setActiveIndex(0);
  };

  // Set current active image as cover image
  const handleSetCoverImage = async (index: number) => {
    const selectedImg = allImages[index];
    if (!selectedImg) return;

    // Move cover image to top, rest to gallery
    const finalCover = selectedImg;
    const updatedGallery = Array.from(new Set([coverImage, ...initialGallery])).filter(img => img !== finalCover);

    const updatedProject: Project = {
      ...project,
      coverImage: finalCover,
      galleryImages: updatedGallery,
      imageUrls: Array.from(new Set([finalCover, ...updatedGallery])).filter(Boolean),
    };

    await onUpdateProject(updatedProject);
    setActiveIndex(0);
  };

  // Drag and Drop Thumbnail Sorting Helpers
  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
  };

  const handleDrop = async (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === targetIndex) return;

    const reorderedList = [...allImages];
    const [movedImage] = reorderedList.splice(draggedIndex, 1);
    reorderedList.splice(targetIndex, 0, movedImage);

    // Reorder cover image and gallery images based on new list
    const finalCover = reorderedList[0];
    const updatedGallery = reorderedList.slice(1);

    const updatedProject: Project = {
      ...project,
      coverImage: finalCover,
      galleryImages: updatedGallery,
      imageUrls: reorderedList,
    };

    await onUpdateProject(updatedProject);
    setActiveIndex(targetIndex);
    setDraggedIndex(null);
  };

  // Manual reorder buttons for precise control
  const handleMoveLeft = async (index: number) => {
    if (index === 0) return;
    const reorderedList = [...allImages];
    const temp = reorderedList[index];
    reorderedList[index] = reorderedList[index - 1];
    reorderedList[index - 1] = temp;

    const finalCover = reorderedList[0];
    const updatedGallery = reorderedList.slice(1);

    const updatedProject: Project = {
      ...project,
      coverImage: finalCover,
      galleryImages: updatedGallery,
      imageUrls: reorderedList,
    };

    await onUpdateProject(updatedProject);
    setActiveIndex(index - 1);
  };

  const handleMoveRight = async (index: number) => {
    if (index === allImages.length - 1) return;
    const reorderedList = [...allImages];
    const temp = reorderedList[index];
    reorderedList[index] = reorderedList[index + 1];
    reorderedList[index + 1] = temp;

    const finalCover = reorderedList[0];
    const updatedGallery = reorderedList.slice(1);

    const updatedProject: Project = {
      ...project,
      coverImage: finalCover,
      galleryImages: updatedGallery,
      imageUrls: reorderedList,
    };

    await onUpdateProject(updatedProject);
    setActiveIndex(index + 1);
  };

  return (
    <div className="w-full bg-slate-900 rounded-2xl overflow-hidden shadow-2xl border border-slate-800">
      {/* Admin Quick Action Header */}
      {isAdmin && (
        <div className="bg-slate-800/80 backdrop-blur-md px-5 py-3 border-b border-slate-700 flex flex-wrap items-center justify-between gap-3 text-slate-200">
          <div className="flex items-center gap-2 text-sm font-bold">
            <span className="text-emerald-500">🛠️</span>
            <span>Admin Image Management</span>
          </div>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition-all cursor-pointer shadow-lg active:scale-95">
              <span>Choose Image(s)</span>
              <input
                type="file"
                multiple
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
                ref={fileInputRef}
                disabled={isUploading}
              />
            </label>
            {isUploading && (
              <span className="text-xs text-slate-400 animate-pulse">Compressing & Saving...</span>
            )}
          </div>
        </div>
      )}

      {isAdmin && estimatedSize > 600000 && (
        <div className="bg-amber-500/10 border-b border-amber-500/20 px-5 py-3 flex flex-wrap items-center justify-between gap-3 text-xs text-amber-400">
          <div className="flex items-center gap-2">
            <span>⚠️</span>
            <span>
              <strong>Project Storage Alert:</strong> This project's details size is at <strong>{Math.round((estimatedSize / 1048576) * 100)}%</strong> of Firestore's 1MB limit ({Math.round(estimatedSize / 1024)}KB). Click the optimize button to automatically shrink all gallery images using high-performance compression.
            </span>
          </div>
          <button
            onClick={handleOptimizeNow}
            disabled={isOptimizing}
            className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-slate-950 font-black uppercase tracking-wider rounded-lg text-[10px] transition-all disabled:opacity-50 cursor-pointer shadow-md"
          >
            {isOptimizing ? 'Optimizing...' : '⚡ Optimize Images Now'}
          </button>
        </div>
      )}

      {uploadError && (
        <div className="bg-rose-500/10 border-b border-rose-500/20 px-5 py-2.5 text-xs font-semibold text-rose-400">
          ❌ {uploadError}
        </div>
      )}

      {/* Main Large Image Viewer */}
      <div 
        className="relative h-[320px] sm:h-[420px] md:h-[480px] w-full bg-slate-950 flex items-center justify-center overflow-hidden group select-none cursor-pointer"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <img
          src={allImages[activeIndex]}
          alt={`${project.name} photo ${activeIndex + 1}`}
          className="w-full h-full object-contain transition-all duration-300 pointer-events-none"
          onClick={() => setIsFullscreen(true)}
        />

        {/* Badges Overlay */}
        <div className="absolute top-4 left-4 flex flex-col gap-1.5 z-10">
          {activeIndex === 0 && (
            <span className="bg-emerald-600 text-white text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-md shadow-md flex items-center gap-1">
              ⭐ Cover Image
            </span>
          )}
          <span className="bg-slate-900/85 backdrop-blur-sm text-slate-300 text-[10px] font-bold tracking-wider px-2.5 py-1 rounded-md shadow-md border border-slate-700/50">
            Image {activeIndex + 1} of {allImages.length}
          </span>
        </div>

        {/* Hover Click to Expand Indicator */}
        <div 
          onClick={() => setIsFullscreen(true)}
          className="absolute inset-0 bg-slate-950/20 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center pointer-events-none"
        >
          <div className="bg-slate-900/90 border border-slate-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xl">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7" />
            </svg>
            Click to Zoom & Fullscreen
          </div>
        </div>

        {/* Left Arrow Button */}
        {allImages.length > 1 && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              handlePrev();
            }}
            className="absolute left-4 p-3 rounded-xl bg-slate-900/70 border border-slate-800/80 hover:bg-slate-800 text-white transition-all shadow-lg hover:scale-105 active:scale-95 cursor-pointer z-10"
            aria-label="Previous Image"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        )}

        {/* Right Arrow Button */}
        {allImages.length > 1 && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleNext();
            }}
            className="absolute right-4 p-3 rounded-xl bg-slate-900/70 border border-slate-800/80 hover:bg-slate-800 text-white transition-all shadow-lg hover:scale-105 active:scale-95 cursor-pointer z-10"
            aria-label="Next Image"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        )}
      </div>

      {/* Thumbnails strip below */}
      {allImages.length > 0 && (
        <div className="bg-slate-950 p-4 border-t border-slate-800">
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-slate-950">
            {allImages.map((img, index) => (
              <div
                key={`${img}-${index}`}
                draggable={isAdmin}
                onDragStart={() => handleDragStart(index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDrop={(e) => handleDrop(e, index)}
                className={`relative flex-shrink-0 group/thumb cursor-pointer transition-all duration-200 ${
                  activeIndex === index
                    ? 'ring-2 ring-blue-500 scale-105'
                    : 'opacity-60 hover:opacity-100'
                }`}
                onClick={() => {
                  setActiveIndex(index);
                  setZoomScale(1);
                }}
              >
                {/* Image */}
                <img
                  src={img}
                  alt={`thumbnail ${index + 1}`}
                  className="w-20 h-16 object-cover rounded-lg border border-slate-800 shadow-md select-none pointer-events-none"
                />

                {/* Cover badge */}
                {index === 0 && (
                  <div className="absolute -top-1.5 -right-1.5 bg-emerald-500 text-white rounded-full p-0.5 shadow-md">
                    <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  </div>
                )}

                {/* Drag Handle Indicator */}
                {isAdmin && (
                  <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover/thumb:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1.5 rounded-lg select-none">
                    <div className="flex gap-1">
                      {index > 0 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMoveLeft(index);
                          }}
                          className="bg-slate-800 text-white p-1 rounded hover:bg-blue-600 transition-colors"
                          title="Move Left"
                        >
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" />
                          </svg>
                        </button>
                      )}
                      {index < allImages.length - 1 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMoveRight(index);
                          }}
                          className="bg-slate-800 text-white p-1 rounded hover:bg-blue-600 transition-colors"
                          title="Move Right"
                        >
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" />
                          </svg>
                        </button>
                      )}
                    </div>
                    
                    <span className="text-[8px] text-slate-300 font-bold select-none cursor-move">DRAG TO SORT</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Admin Operations Console (Active Image Control Panel) */}
      {isAdmin && (
        <div className="bg-slate-950 p-4 border-t border-slate-800 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-400">
          <div>
            <span>Selected image #{activeIndex + 1} actions:</span>
          </div>
          <div className="flex items-center gap-2">
            {activeIndex !== 0 && (
              <button
                onClick={() => handleSetCoverImage(activeIndex)}
                className="px-3 py-1.5 bg-slate-800 hover:bg-emerald-700 hover:text-white rounded border border-slate-700 text-slate-300 font-bold transition-all cursor-pointer"
              >
                ⭐ Set as Cover
              </button>
            )}
            <button
              onClick={() => handleDeleteImage(activeIndex)}
              className="px-3 py-1.5 bg-slate-800 hover:bg-rose-700 hover:text-white rounded border border-slate-700 text-slate-300 font-bold transition-all cursor-pointer"
            >
              🗑️ Delete Image
            </button>
          </div>
        </div>
      )}

      {/* Fullscreen Overlay Viewer */}
      {isFullscreen && (
        <div className="fixed inset-0 bg-slate-950/95 backdrop-blur-md z-50 flex flex-col justify-between p-4 md:p-6 select-none animate-fade-in">
          {/* Header Controls */}
          <div className="flex items-center justify-between text-slate-200 z-10">
            <div>
              <h4 className="font-bold tracking-tight text-white">{project.name}</h4>
              <p className="text-xs text-slate-400">Image {activeIndex + 1} of {allImages.length}</p>
            </div>
            
            {/* Toolbar */}
            <div className="flex items-center gap-3">
              {/* Zoom In */}
              <button
                onClick={handleZoomIn}
                className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 transition-colors"
                title="Zoom In"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 11V7m0 8v-4m3 3H7" />
                </svg>
              </button>
              {/* Zoom Out */}
              <button
                onClick={handleZoomOut}
                disabled={zoomScale === 1}
                className={`p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 transition-colors ${zoomScale === 1 ? 'opacity-40 cursor-not-allowed' : ''}`}
                title="Zoom Out"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 11H7" />
                </svg>
              </button>
              {/* Reset Zoom */}
              <button
                onClick={toggleZoom}
                className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 transition-colors text-xs font-bold"
                title="Toggle Zoom"
              >
                {zoomScale > 1 ? 'Reset' : '2x Zoom'}
              </button>
              
              {/* Exit */}
              <button
                onClick={() => {
                  setIsFullscreen(false);
                  setZoomScale(1);
                }}
                className="p-2 rounded-lg bg-rose-600/90 hover:bg-rose-500 transition-colors"
                title="Close Fullscreen"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Fullscreen Slider Center */}
          <div 
            className="relative flex-grow flex items-center justify-center overflow-hidden"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            <div 
              className="transition-transform duration-200 ease-out max-w-full max-h-[80vh] flex items-center justify-center"
              style={{ transform: `scale(${zoomScale})` }}
            >
              <img
                src={allImages[activeIndex]}
                alt={project.name}
                className="max-w-[90vw] max-h-[75vh] object-contain rounded-md cursor-grab active:cursor-grabbing shadow-2xl"
              />
            </div>

            {/* Left Button */}
            {allImages.length > 1 && (
              <button
                onClick={handlePrev}
                className="absolute left-4 p-4 rounded-full bg-slate-900/85 hover:bg-slate-800 border border-slate-800 text-white transition-all shadow-xl hover:scale-105 active:scale-95 cursor-pointer z-10"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}

            {/* Right Button */}
            {allImages.length > 1 && (
              <button
                onClick={handleNext}
                className="absolute right-4 p-4 rounded-full bg-slate-900/85 hover:bg-slate-800 border border-slate-800 text-white transition-all shadow-xl hover:scale-105 active:scale-95 cursor-pointer z-10"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            )}
          </div>

          {/* Thumbnail Strip Below in Fullscreen */}
          <div className="flex justify-center gap-2 overflow-x-auto py-2 z-10">
            {allImages.map((img, index) => (
              <button
                key={`fullscreen-thumb-${img}-${index}`}
                onClick={() => {
                  setActiveIndex(index);
                  setZoomScale(1);
                }}
                className={`w-14 h-11 rounded overflow-hidden border-2 transition-all ${
                  activeIndex === index ? 'border-blue-500 scale-105' : 'border-transparent opacity-50 hover:opacity-100'
                }`}
              >
                <img src={img} alt={`thumbnail ${index}`} className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
