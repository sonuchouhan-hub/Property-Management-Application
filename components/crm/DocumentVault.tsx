import React, { useState } from 'react';
import { DocumentRecord } from '../../types';
import { 
  FolderLock, UploadCloud, Eye, FileText, Trash2, 
  Calendar, Check, ShieldCheck, Tag, Info, Trash
} from 'lucide-react';

interface DocumentVaultProps {
  documents: DocumentRecord[];
  onUploadDocument: (doc: Omit<DocumentRecord, 'id' | 'uploadedAt' | 'uploadedBy'>) => Promise<void>;
  onDeleteDocument: (docId: string) => Promise<void>;
  onShowToast: (msg: string) => void;
  currentUserEmail: string;
}

export const DocumentVault: React.FC<DocumentVaultProps> = ({
  documents,
  onUploadDocument,
  onDeleteDocument,
  onShowToast,
  currentUserEmail
}) => {
  const [docName, setDocName] = useState<string>('');
  const [docType, setDocType] = useState<DocumentRecord['type']>('Aadhaar');
  const [fileUrl, setFileUrl] = useState<string>('');
  const [fileName, setFileName] = useState<string>('');
  const [dragOver, setDragOver] = useState<boolean>(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const processFile = (file: File) => {
    setFileName(file.name);
    if (!docName.trim()) {
      // Auto-populate document name with type or file name
      setDocName(file.name.split('.')[0]);
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        setFileUrl(reader.result);
        onShowToast("Document parsed and structured securely in state.");
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fileUrl) {
      alert("Please upload/drag a document first.");
      return;
    }
    if (!docName.trim()) {
      alert("Please provide a document label name.");
      return;
    }

    await onUploadDocument({
      name: docName,
      type: docType,
      fileUrl
    });

    // Reset Form
    setDocName('');
    setFileUrl('');
    setFileName('');
    onShowToast(`Uploaded ${docType} document successfully.`);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Column 1: Upload Form */}
      <div>
        <div className="bg-white rounded-2xl p-5 border border-gray-150 shadow-sm space-y-4">
          <h4 className="text-sm font-black text-gray-800 uppercase tracking-wider flex items-center gap-1.5">
            <UploadCloud className="w-4.5 h-4.5 text-purple-600" />
            Upload Verified Document
          </h4>
          <p className="text-[11px] text-gray-400 font-medium">Add pan cards, registry contracts, or land diversion records to customer portfolios.</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Document Label Name */}
            <div>
              <label className="text-xs font-bold text-gray-500 block mb-1">Document Label / Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. Aadhaar Card Front"
                value={docName}
                onChange={(e) => setDocName(e.target.value)}
                className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-purple-500 outline-none"
              />
            </div>

            {/* Document Category / Type */}
            <div>
              <label className="text-xs font-bold text-gray-500 block mb-1">Document Category *</label>
              <select
                value={docType}
                onChange={(e) => setDocType(e.target.value as any)}
                className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 text-xs font-bold text-gray-700 outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="Aadhaar">Aadhaar KYC Card</option>
                <option value="PAN">PAN Registry Card</option>
                <option value="Booking Form">Signed Plot Booking Form</option>
                <option value="Agreement">Sale & Purchase Agreement</option>
                <option value="Registry">Property Registry Paperwork</option>
                <option value="Receipt">Payment Installment Receipt</option>
                <option value="Photo">Passport Size Photograph</option>
                <option value="Other">Other Regulatory Document</option>
              </select>
            </div>

            {/* Drag & Drop Canvas */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-2xl p-6 text-center transition-all relative ${
                dragOver 
                  ? 'border-purple-500 bg-purple-50' 
                  : fileUrl 
                    ? 'border-emerald-400 bg-emerald-50/20' 
                    : 'border-gray-300 hover:border-purple-400'
              }`}
            >
              <input
                type="file"
                onChange={handleFileChange}
                className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
              />
              <UploadCloud className={`w-10 h-10 mx-auto ${fileUrl ? 'text-emerald-500' : 'text-gray-400'}`} />
              
              {fileUrl ? (
                <div className="mt-2 text-xs font-bold text-emerald-800">
                  <span className="flex items-center justify-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    File Loaded: {fileName || 'Captured.pdf'}
                  </span>
                  <span className="text-[10px] text-gray-400 font-medium block mt-1">Click or drag another to replace</span>
                </div>
              ) : (
                <div className="mt-2 text-xs text-gray-500 font-bold block">
                  Drag & Drop PDF or Image here
                  <span className="text-[10px] text-gray-400 font-medium block mt-1">Supports PDF, PNG, JPG, or Scan copies up to 10MB</span>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={!fileUrl}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs py-2.5 px-4 rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
              Commit Document to Vault
            </button>
          </form>
        </div>
      </div>

      {/* Columns 2 & 3: File Vault Grid */}
      <div className="lg:col-span-2 space-y-6">
        <div className="bg-white rounded-2xl border border-gray-150 shadow-sm p-5 space-y-4">
          <h4 className="text-xs font-extrabold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
            <FolderLock className="w-4.5 h-4.5 text-purple-600" />
            Verified Customer Document Repository ({documents.length})
          </h4>

          {/* Grid Layout */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[420px] overflow-y-auto pr-1">
            {documents.map((doc) => (
              <div key={doc.id} className="bg-slate-50 border border-gray-150 rounded-xl p-4 flex flex-col justify-between hover:shadow-sm transition-all group">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="bg-purple-100 text-purple-800 text-[9px] font-black px-1.5 py-0.5 rounded uppercase font-mono flex items-center gap-1">
                      <Tag className="w-3 h-3" />
                      {doc.type}
                    </span>
                    <button
                      onClick={async () => {
                        if (window.confirm('Delete this document from the vault?')) {
                          await onDeleteDocument(doc.id);
                        }
                      }}
                      className="text-gray-300 hover:text-red-500 transition-colors cursor-pointer"
                      title="Delete document"
                    >
                      <Trash className="w-4 h-4" />
                    </button>
                  </div>

                  <h5 className="font-extrabold text-sm text-gray-900 line-clamp-1">{doc.name}</h5>
                  
                  <div className="text-[10px] text-gray-400 font-bold space-y-1">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      Uploaded: {new Date(doc.uploadedAt).toLocaleDateString()}
                    </span>
                    <span className="flex items-center gap-1 truncate">
                      <Info className="w-3.5 h-3.5" />
                      By: {doc.uploadedBy}
                    </span>
                  </div>
                </div>

                <div className="border-t pt-3 mt-3">
                  <a
                    href={doc.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full bg-white border border-gray-200 hover:bg-purple-50 hover:text-purple-700 text-gray-700 font-extrabold text-[11px] py-1.5 px-3 rounded-lg flex items-center justify-center gap-1 transition-all shadow-sm"
                  >
                    <Eye className="w-4 h-4" />
                    Preview Document
                  </a>
                </div>
              </div>
            ))}

            {documents.length === 0 && (
              <div className="col-span-2 text-center py-12 text-gray-400 italic text-xs">No documents uploaded to this portfolio yet. Use the upload card on the left to add papers.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
