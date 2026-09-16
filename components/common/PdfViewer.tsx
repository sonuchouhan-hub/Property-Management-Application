import React, { useState, useEffect, useRef } from 'react';

interface PdfViewerProps {
  url: string;
  name: string;
}

const PDF_JS_SRC = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.min.js';
const PDF_JS_WORKER_SRC = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';

const PdfViewer: React.FC<PdfViewerProps> = ({ url, name }) => {
  const [pdfLibLoaded, setPdfLibLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [numPages, setNumPages] = useState(0);
  const [scale, setScale] = useState(1.0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fitMode, setFitMode] = useState<'width' | 'page'>('width');

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderTaskRef = useRef<any>(null);

  // Map mock URLs to a real, reliable public PDF for demonstration
  const resolvedUrl = url.startsWith('https://dhanshri-properties.com') 
    ? 'https://raw.githubusercontent.com/mozilla/pdf.js/master/test/pdfs/5pages.pdf'
    : url;

  // Load PDF.js script dynamically
  useEffect(() => {
    if ((window as any).pdfjsLib) {
      setPdfLibLoaded(true);
      return;
    }

    const script = document.createElement('script');
    script.src = PDF_JS_SRC;
    script.async = true;
    script.onload = () => {
      const pdfjsLib = (window as any).pdfjsLib;
      if (pdfjsLib) {
        pdfjsLib.GlobalWorkerOptions.workerSrc = PDF_JS_WORKER_SRC;
        setPdfLibLoaded(true);
      } else {
        setError('Failed to initialize PDF library.');
      }
    };
    script.onerror = () => {
      setError('Failed to load PDF library from CDN.');
    };
    document.body.appendChild(script);

    return () => {
      // Clean up script if desired, though keeping it is usually fine
    };
  }, []);

  // Load PDF Document
  useEffect(() => {
    if (!pdfLibLoaded) return;

    let active = true;
    setLoading(true);
    setError(null);

    const pdfjsLib = (window as any).pdfjsLib;
    const loadingTask = pdfjsLib.getDocument({
      url: resolvedUrl,
      withCredentials: false
    });

    loadingTask.promise.then(
      (loadedPdf: any) => {
        if (!active) return;
        setPdfDoc(loadedPdf);
        setNumPages(loadedPdf.numPages);
        setCurrentPage(1);
        setLoading(false);
      },
      (err: any) => {
        if (!active) return;
        console.error('Error loading PDF document:', err);
        setError('Could not load layout map PDF. Please verify the file is a valid PDF.');
        setLoading(false);
      }
    );

    return () => {
      active = false;
    };
  }, [resolvedUrl, pdfLibLoaded]);

  // Render Current Page
  const renderPage = async () => {
    if (!pdfDoc || !canvasRef.current) return;

    try {
      const page = await pdfDoc.getPage(currentPage);
      
      // Cancel previous render task if active
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
      }

      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      if (!context) return;

      // Handle fit-to-width vs fit-to-page scale calculations dynamically
      let currentScale = scale;
      const unscaledViewport = page.getViewport({ scale: 1.0 });

      if (fitMode === 'width' && containerRef.current) {
        // Adjust width for padding/margins
        const containerWidth = containerRef.current.clientWidth - 32; 
        if (containerWidth > 0) {
          currentScale = containerWidth / unscaledViewport.width;
          // Impose reasonable bounds
          currentScale = Math.min(Math.max(currentScale, 0.4), 3.0);
        }
      } else if (fitMode === 'page') {
        currentScale = 0.85; // Fixed convenient visual fit
      }

      const viewport = page.getViewport({ scale: currentScale });
      
      // Support high-DPI displays
      const outputScale = window.devicePixelRatio || 1;
      canvas.width = Math.floor(viewport.width * outputScale);
      canvas.height = Math.floor(viewport.height * outputScale);
      canvas.style.width = Math.floor(viewport.width) + "px";
      canvas.style.height = Math.floor(viewport.height) + "px";

      const transform = outputScale !== 1 
        ? [outputScale, 0, 0, outputScale, 0, 0] 
        : null;

      const renderContext = {
        canvasContext: context,
        viewport: viewport,
        transform: transform
      };

      const renderTask = page.render(renderContext);
      renderTaskRef.current = renderTask;

      await renderTask.promise;
      renderTaskRef.current = null;
    } catch (err: any) {
      if (err.name === 'RenderingCancelledException') {
        // Safe to ignore, we cancelled to render a newer state/zoom
      } else {
        console.error('Error rendering PDF page:', err);
      }
    }
  };

  // Re-render when page, scale, doc, or fitMode changes
  useEffect(() => {
    if (pdfDoc) {
      renderPage();
    }
  }, [currentPage, scale, pdfDoc, fitMode]);

  // Handle window resizing for fit-to-width responsiveness
  useEffect(() => {
    if (!pdfDoc || fitMode !== 'width') return;

    let resizeTimeout: NodeJS.Timeout;
    const handleResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        renderPage();
      }, 150);
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(resizeTimeout);
    };
  }, [pdfDoc, fitMode, scale, currentPage]);

  const handleZoomIn = () => {
    setFitMode('page'); // Zoom overrides automatic fit-to-width
    setScale((prev) => Math.min(prev + 0.2, 3.0));
  };

  const handleZoomOut = () => {
    setFitMode('page');
    setScale((prev) => Math.max(prev - 0.2, 0.4));
  };

  const handlePrevPage = () => {
    setCurrentPage((prev) => Math.max(prev - 1, 1));
  };

  const handleNextPage = () => {
    setCurrentPage((prev) => Math.min(prev + 1, numPages));
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  // Safe wrapper to trigger direct browser download
  const handleDownload = (e: React.MouseEvent) => {
    e.preventDefault();
    const downloadLink = document.createElement('a');
    downloadLink.href = url; // Original URL (could be Base64 data URL)
    downloadLink.download = name || 'Layout_Map.pdf';
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
  };

  // CSS wrapper for full-window modal or standard inline card
  const viewerClasses = isFullscreen 
    ? 'fixed inset-0 z-50 bg-slate-900/95 flex flex-col p-4 md:p-6 backdrop-blur-sm'
    : 'relative border border-slate-200 rounded-xl overflow-hidden bg-slate-50 shadow-inner flex flex-col min-h-[480px]';

  return (
    <div className={viewerClasses} ref={containerRef}>
      {/* Control bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-white border-b border-slate-200 rounded-t-xl shadow-sm z-10">
        {/* Navigation & Pages */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handlePrevPage}
            disabled={currentPage <= 1 || loading}
            className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-transparent cursor-pointer transition-colors"
            title="Previous Page"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          
          <span className="text-xs font-bold text-slate-700 min-w-[70px] text-center font-mono">
            {loading ? 'Page --' : `Page ${currentPage} of ${numPages}`}
          </span>

          <button
            type="button"
            onClick={handleNextPage}
            disabled={currentPage >= numPages || loading}
            className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-transparent cursor-pointer transition-colors"
            title="Next Page"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* Zoom and Fit Modes */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleZoomOut}
            disabled={loading}
            className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 cursor-pointer transition-colors"
            title="Zoom Out"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4" />
            </svg>
          </button>

          <span className="text-xs font-bold text-slate-700 min-w-[45px] text-center font-mono">
            {loading ? '100%' : `${Math.round((fitMode === 'width' && canvasRef.current ? (parseFloat(canvasRef.current.style.width) / (pdfDoc?.key && 1 || 800)) * 100 : scale * 100))}%`}
          </span>

          <button
            type="button"
            onClick={handleZoomIn}
            disabled={loading}
            className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 cursor-pointer transition-colors"
            title="Zoom In"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
          </button>

          <div className="h-4 w-[1px] bg-slate-200 mx-1"></div>

          <button
            type="button"
            onClick={() => { setFitMode('width'); setScale(1.0); }}
            disabled={loading}
            className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
              fitMode === 'width'
                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                : 'text-slate-500 hover:bg-slate-100 border border-transparent'
            }`}
            title="Fit to Container Width"
          >
            Fit Width
          </button>

          <button
            type="button"
            onClick={() => { setFitMode('page'); setScale(1.0); }}
            disabled={loading}
            className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
              fitMode === 'page'
                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                : 'text-slate-500 hover:bg-slate-100 border border-transparent'
            }`}
            title="Standard Fit"
          >
            Fit Page
          </button>
        </div>

        {/* Global Toolbar Actions (Fullscreen & Download) */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleDownload}
            disabled={loading}
            className="p-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg cursor-pointer transition-all border border-blue-100"
            title="Download PDF"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
          </button>

          <button
            type="button"
            onClick={toggleFullscreen}
            className={`p-1.5 rounded-lg cursor-pointer transition-all border ${
              isFullscreen 
                ? 'bg-amber-50 text-amber-600 border-amber-200 hover:bg-amber-100' 
                : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
            }`}
            title={isFullscreen ? "Exit Full Screen" : "Full Screen View"}
          >
            {isFullscreen ? (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 9L4 4m0 0l4-4M4 4v4m11-3l5 5m0 0l-5-5m5 5h-4M9 15l-5 5m0 0l4 4m-4-4v-4m11 3l5-5m0 0l-5 5m5-5h-4" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4m0 0h4M4 4l5 5m11-5h-4m4 0v4m0-4l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* PDF viewport content */}
      <div className="flex-grow overflow-auto p-4 flex items-center justify-center bg-slate-800 relative shadow-inner">
        {loading && (
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm flex flex-col items-center justify-center z-20 text-white gap-3">
            <svg className="animate-spin h-8 w-8 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <p className="text-sm font-semibold tracking-wide">Loading Layout Map PDF...</p>
          </div>
        )}

        {error ? (
          <div className="text-center p-8 max-w-md bg-white rounded-2xl shadow-lg border border-red-100 z-10">
            <span className="text-4xl">🗺️</span>
            <p className="text-red-600 font-bold text-sm mt-3">{error}</p>
            <p className="text-xs text-slate-500 mt-1">If the file was just uploaded, it might be propagating, or you can try re-uploading.</p>
          </div>
        ) : (
          <div className="inline-block bg-white shadow-2xl border border-slate-700/50 p-2 rounded-md transition-all">
            <canvas ref={canvasRef} className="max-w-full block" />
          </div>
        )}
      </div>

      {/* Mini footer indicator in Fullscreen mode */}
      {isFullscreen && (
        <div className="flex items-center justify-between p-3 bg-slate-900 border-t border-slate-800 text-slate-400 text-xs">
          <span className="font-semibold text-slate-300">Layout Map Viewer — {name}</span>
          <button
            type="button"
            onClick={toggleFullscreen}
            className="px-3 py-1.5 bg-slate-800 text-slate-200 hover:bg-slate-700 rounded-lg font-bold uppercase tracking-wider cursor-pointer transition-colors"
          >
            Exit Full Screen
          </button>
        </div>
      )}
    </div>
  );
};

export default PdfViewer;
