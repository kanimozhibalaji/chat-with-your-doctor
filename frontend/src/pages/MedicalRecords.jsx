import React, { useContext, useState, useEffect, useRef, useId } from 'react'
import { useNavigate } from 'react-router-dom'
import { AppContext } from '../context/AppContext'
import axios from 'axios'
import { toast } from 'react-toastify'
import {
  FileText,
  UploadCloud,
  CheckCircle2,
  Clock,
  Trash2,
  RefreshCw,
  AlertTriangle,
  Pill,
  BrainCircuit,
  ShieldAlert,
  Calendar,
  ArrowRight,
  FileCheck,
  Eye,
  FolderOpen,
  Plus,
  X,
  Maximize2,
  Sparkles,
  Activity
} from 'lucide-react'

const MedicalRecords = () => {
  const navigate = useNavigate()
  const { backendUrl, token } = useContext(AppContext)
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [analyzing, setAnalyzing] = useState(null)
  const [syncingBiomarkers, setSyncingBiomarkers] = useState(false)
  const [selectedRecord, setSelectedRecord] = useState(null)
  const [dragActive, setDragActive] = useState(false)
  const [showUploadArea, setShowUploadArea] = useState(false)
  const [previewModalImg, setPreviewModalImg] = useState(null)

  const previewDialogRef = useRef(null)
  const previewTitleId = useId()

  useEffect(() => {
    const dialog = previewDialogRef.current
    if (!dialog) return
    if (previewModalImg) {
      if (!dialog.open) dialog.showModal()
    } else {
      if (dialog.open) dialog.close()
    }
  }, [previewModalImg])

  useEffect(() => {
    const dialog = previewDialogRef.current
    if (!dialog) return

    const handleNativeClose = () => {
      if (previewModalImg) setPreviewModalImg(null)
    }
    dialog.addEventListener('close', handleNativeClose)

    let handleBackdropClick = null
    if (!('closedBy' in HTMLDialogElement.prototype)) {
      handleBackdropClick = (event) => {
        if (event.target !== dialog) return
        const rect = dialog.getBoundingClientRect()
        const isInside =
          rect.top <= event.clientY &&
          event.clientY <= rect.top + rect.height &&
          rect.left <= event.clientX &&
          event.clientX <= rect.left + rect.width
        if (!isInside) dialog.close()
      }
      dialog.addEventListener('click', handleBackdropClick)
    }

    return () => {
      dialog.removeEventListener('close', handleNativeClose)
      if (handleBackdropClick) dialog.removeEventListener('click', handleBackdropClick)
    }
  }, [previewModalImg])

  // Sync AI extracted metrics to Health Biomarkers
  const syncBiomarkersToHealth = async (recordId) => {
    setSyncingBiomarkers(true)
    try {
      const { data } = await axios.post(
        `${backendUrl}/api/records/sync-to-health`,
        { recordId },
        { headers: { token } }
      )
      if (data.success) {
        toast.success(data.message)
      } else {
        toast.error(data.message)
      }
    } catch (error) {
      toast.error(error.message || 'Failed to sync biomarkers')
    } finally {
      setSyncingBiomarkers(false)
    }
  }

  // Fetch all records
  const fetchRecords = async () => {
    setLoading(true)
    try {
      const { data } = await axios.post(backendUrl + '/api/records/list', {}, { headers: { token } })
      if (data.success) {
        setRecords(data.records)
        if (data.records.length > 0) {
          setSelectedRecord((prev) => {
            if (prev) {
              const found = data.records.find((r) => r._id === prev._id)
              if (found) return found
            }
            return data.records[0]
          })
        } else {
          setSelectedRecord(null)
        }
      } else {
        toast.error(data.message)
      }
    } catch (error) {
      console.error(error)
      toast.error('Failed to fetch records')
    } finally {
      setLoading(false)
    }
  }

  // Upload a record
  const uploadRecord = async (file) => {
    if (!file) return

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg']
    if (!allowedTypes.includes(file.type)) {
      toast.error('Please upload an image file (JPG, PNG, or WEBP)')
      return
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size must be under 10MB')
      return
    }

    setUploading(true)
    const formData = new FormData()
    formData.append('recordImage', file)

    try {
      const { data } = await axios.post(backendUrl + '/api/records/upload', formData, {
        headers: { token, 'Content-Type': 'multipart/form-data' }
      })

      if (data.success) {
        toast.success('Medical report uploaded successfully!')
        setShowUploadArea(false)
        await fetchRecords()
        if (data.record) {
          setSelectedRecord(data.record)
          // Automatically run AI analysis on new upload
          analyzeRecordAI(data.record._id)
        }
      } else {
        toast.error(data.message)
      }
    } catch (error) {
      console.error(error)
      toast.error('Upload failed. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  // Run AI analysis
  const analyzeRecordAI = async (recordId) => {
    setAnalyzing(recordId)
    try {
      const { data } = await axios.post(
        backendUrl + '/api/records/analyze',
        { recordId },
        { headers: { token } }
      )

      if (data.success) {
        toast.success('AI Report Analysis Complete!')
        await fetchRecords()
      } else {
        toast.error(data.message)
      }
    } catch (error) {
      console.error(error)
      toast.error('AI analysis failed. Please try again.')
    } finally {
      setAnalyzing(null)
    }
  }

  // Delete a record
  const deleteRecord = async (recordId) => {
    if (!window.confirm('Delete this medical record? This cannot be undone.')) return

    try {
      const { data } = await axios.post(
        backendUrl + '/api/records/delete',
        { recordId },
        { headers: { token } }
      )

      if (data.success) {
        toast.success('Report deleted')
        if (selectedRecord && selectedRecord._id === recordId) {
          setSelectedRecord(null)
        }
        fetchRecords()
      } else {
        toast.error(data.message)
      }
    } catch (error) {
      console.error(error)
      toast.error('Failed to delete report')
    }
  }

  const handleDrag = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      uploadRecord(e.dataTransfer.files[0])
    }
  }

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    })
  }

  useEffect(() => {
    if (token) fetchRecords()
  }, [token])

  const totalMetricsCount = selectedRecord?.aiExtractedData?.vitalMetrics
    ? Object.keys(selectedRecord.aiExtractedData.vitalMetrics).length
    : 0

  return (
    <div className='min-h-[85vh] py-8 max-w-6xl mx-auto space-y-7'>
      {/* Top Header Card */}
      <section className='bg-gradient-to-br from-slate-900 via-slate-800 to-sky-950 border border-slate-700/50 rounded-3xl p-6 sm:p-8 text-white relative overflow-hidden shadow-xl'>
        <div className='absolute -right-20 -top-20 w-80 h-80 bg-sky-500/10 rounded-full blur-3xl pointer-events-none' />

        <div className='relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6'>
          <div className='space-y-2 max-w-2xl'>
            <div className='inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-500/20 border border-sky-400/30 text-sky-200 text-xs font-bold'>
              <BrainCircuit className='w-4 h-4 text-sky-400' />
              <span>Smart Document Archive & Clinical OCR</span>
            </div>

            <h1 className='text-2xl sm:text-3xl font-extrabold tracking-tight text-white'>
              Medical Records & Lab Summaries
            </h1>

            <p className='text-slate-300 text-xs sm:text-sm leading-relaxed'>
              Upload blood tests, lab reports, or doctor prescriptions. Our AI reads the document, explains results in plain English, and pulls out your vital health metrics.
            </p>
          </div>

          <div className='flex items-center gap-3 shrink-0'>
            <div className='bg-white/10 border border-white/15 rounded-2xl px-4 py-2.5 text-xs text-white flex items-center gap-3'>
              <FileCheck className='w-5 h-5 text-emerald-400 shrink-0' />
              <div>
                <p className='font-bold tabular-nums text-sm'>
                  {records.length} {records.length === 1 ? 'Report' : 'Reports'}
                </p>
                <p className='text-slate-300 text-[11px] tabular-nums'>
                  {records.filter((r) => r.isAnalyzed).length} Analyzed
                </p>
              </div>
            </div>

            <button
              type='button'
              onClick={() => setShowUploadArea(!showUploadArea)}
              className='px-5 py-3 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-bold shadow-md shadow-sky-600/25 transition-all flex items-center gap-2 cursor-pointer shrink-0'
            >
              {showUploadArea ? <X className='w-4 h-4' /> : <Plus className='w-4 h-4' />}
              <span>{showUploadArea ? 'Close' : 'Upload Report'}</span>
            </button>
          </div>
        </div>
      </section>

      {/* Drag & Drop Upload Zone */}
      {(showUploadArea || records.length === 0) && (
        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-3xl p-8 text-center transition-all cursor-pointer ${
            dragActive
              ? 'border-sky-500 bg-sky-50/50 scale-[1.005]'
              : 'border-slate-300 hover:border-sky-400 bg-white'
          } ${uploading ? 'opacity-60 pointer-events-none' : ''}`}
          onClick={() => document.getElementById('record-upload').click()}
        >
          <input
            type='file'
            id='record-upload'
            accept='image/*'
            className='hidden'
            onChange={(e) => uploadRecord(e.target.files[0])}
          />

          {uploading ? (
            <div className='flex flex-col items-center gap-3 py-6'>
              <div className='w-10 h-10 border-3 border-sky-600 border-t-transparent rounded-full animate-spin' />
              <p className='text-sm font-bold text-slate-800'>Uploading and encrypting document...</p>
              <p className='text-xs text-slate-500'>Saving securely in your personal health archive</p>
            </div>
          ) : (
            <div className='flex flex-col items-center gap-3 py-4'>
              <div className='w-12 h-12 rounded-2xl bg-sky-50 border border-sky-100 flex items-center justify-center text-sky-600'>
                <UploadCloud className='w-6 h-6' />
              </div>
              <div>
                <p className='font-bold text-slate-800 text-base'>
                  Click or drag & drop a photo of your medical report
                </p>
                <p className='text-xs text-slate-500 mt-1'>
                  Supports JPG, PNG, or WEBP images (up to 10 MB)
                </p>
              </div>
              <span className='text-[11px] font-semibold text-slate-600 bg-slate-100 px-3 py-1 rounded-full'>
                Encrypted & Private Healthcare Storage
              </span>
            </div>
          )}
        </div>
      )}

      {/* Horizontal Report File Cards */}
      {records.length > 0 && (
        <div className='space-y-2.5'>
          <div className='flex items-center justify-between'>
            <h3 className='text-xs font-extrabold uppercase tracking-wider text-slate-600 flex items-center gap-1.5'>
              <FolderOpen className='w-4 h-4 text-sky-600' />
              <span>Select a Report to View Clinical AI Analysis</span>
            </h3>
            <span className='text-xs text-slate-400 font-medium tabular-nums'>
              {records.length} {records.length === 1 ? 'file' : 'files'}
            </span>
          </div>

          <div className='flex items-center gap-3 overflow-x-auto pb-2 pt-1 overscroll-contain'>
            {records.map((record) => {
              const isSelected = selectedRecord && selectedRecord._id === record._id
              return (
                <div
                  key={record._id}
                  onClick={() => setSelectedRecord(record)}
                  className={`flex items-center gap-3 p-3 pr-4 rounded-2xl border transition-all cursor-pointer shrink-0 max-w-xs ${
                    isSelected
                      ? 'border-sky-500 bg-sky-50/70 shadow-xs ring-2 ring-sky-500/20'
                      : 'border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50'
                  }`}
                >
                  <img
                    src={record.fileUrl}
                    alt={record.fileName}
                    className='w-12 h-12 rounded-xl object-cover bg-slate-100 border border-slate-200 shrink-0'
                  />
                  <div className='min-w-0 flex-1'>
                    <p className='font-bold text-slate-900 text-xs truncate max-w-[150px]'>
                      {record.fileName}
                    </p>
                    <p className='text-[11px] text-slate-400 mt-0.5 tabular-nums font-medium'>
                      {formatDate(record.uploadDate)}
                    </p>
                    <div className='mt-1 flex items-center gap-1.5'>
                      {record.isAnalyzed ? (
                        <span className='inline-flex items-center gap-1 text-[10px] px-2 py-0.2 rounded-full bg-emerald-50 text-emerald-700 font-bold border border-emerald-200'>
                          <CheckCircle2 className='w-2.5 h-2.5' /> Ready
                        </span>
                      ) : (
                        <span className='inline-flex items-center gap-1 text-[10px] px-2 py-0.2 rounded-full bg-amber-50 text-amber-700 font-bold border border-amber-200'>
                          <Clock className='w-2.5 h-2.5' /> Needs AI
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    type='button'
                    onClick={(e) => {
                      e.stopPropagation()
                      deleteRecord(record._id)
                    }}
                    className='p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer shrink-0 ml-1'
                    title='Delete Report'
                  >
                    <Trash2 className='w-3.5 h-3.5' />
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Selected Report Dossier */}
      {selectedRecord && (
        <div className='bg-white rounded-3xl border border-slate-200 shadow-2xs overflow-hidden space-y-6 p-6 sm:p-8'>
          <div className='flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200'>
            <div className='space-y-1'>
              <div className='flex flex-wrap items-center gap-2.5'>
                <h2 className='text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight'>
                  {selectedRecord.fileName}
                </h2>
                {selectedRecord.aiExtractedData?.reportType && (
                  <span className='px-3 py-1 rounded-full text-xs font-bold bg-sky-50 text-sky-800 border border-sky-200'>
                    {selectedRecord.aiExtractedData.reportType}
                  </span>
                )}
                {selectedRecord.isAnalyzed ? (
                  <span className='inline-flex items-center gap-1 text-xs px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold'>
                    <CheckCircle2 className='w-3.5 h-3.5' /> AI Verified
                  </span>
                ) : (
                  <span className='inline-flex items-center gap-1 text-xs px-3 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 font-bold'>
                    <Clock className='w-3.5 h-3.5' /> Unanalyzed
                  </span>
                )}
              </div>
              <p className='text-xs text-slate-500 tabular-nums'>
                Uploaded {formatDate(selectedRecord.uploadDate)} • Encrypted Health Record
              </p>
            </div>

            <div className='flex items-center gap-2.5 shrink-0 flex-wrap'>
              <button
                type='button'
                onClick={() => setPreviewModalImg(selectedRecord.fileUrl)}
                className='px-3.5 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer'
              >
                <Eye className='w-3.5 h-3.5 text-slate-600' />
                <span>Enlarge</span>
              </button>

              <button
                type='button'
                onClick={() => analyzeRecordAI(selectedRecord._id)}
                disabled={analyzing === selectedRecord._id}
                className='px-4 py-2 text-xs font-bold text-white bg-sky-600 hover:bg-sky-500 rounded-xl transition-all shadow-sm flex items-center gap-1.5 disabled:opacity-50 cursor-pointer'
              >
                <Sparkles className='w-3.5 h-3.5' />
                <span>
                  {analyzing === selectedRecord._id
                    ? 'Reading Document...'
                    : selectedRecord.isAnalyzed
                    ? 'Re-Run Analysis'
                    : 'Read & Summarize'}
                </span>
              </button>

              <button
                type='button'
                onClick={() => deleteRecord(selectedRecord._id)}
                className='p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer'
                title='Delete Report'
              >
                <Trash2 className='w-4 h-4' />
              </button>
            </div>
          </div>

          {/* Analyzed Report Split Layout */}
          {selectedRecord.isAnalyzed && selectedRecord.aiExtractedData ? (
            <div className='grid grid-cols-1 lg:grid-cols-12 gap-7 items-start'>
              {/* Document Image (5 Cols) */}
              <div className='lg:col-span-5 space-y-4'>
                <div
                  onClick={() => setPreviewModalImg(selectedRecord.fileUrl)}
                  className='group relative rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 shadow-sm cursor-pointer aspect-4/3 flex items-center justify-center'
                >
                  <img
                    src={selectedRecord.fileUrl}
                    alt={selectedRecord.fileName}
                    className='w-full h-full object-contain p-2 group-hover:opacity-90 transition-opacity'
                  />
                  <div className='absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold gap-2'>
                    <Maximize2 className='w-4 h-4' />
                    <span>Click to Enlarge</span>
                  </div>
                </div>

                {/* Flagged Values in Red */}
                {selectedRecord.aiExtractedData.flaggedValues?.length > 0 && (
                  <div className='bg-rose-50/90 border border-rose-200 rounded-2xl p-4 space-y-2'>
                    <p className='text-xs font-extrabold uppercase tracking-wider text-rose-900 flex items-center gap-1.5'>
                      <AlertTriangle className='w-4 h-4 text-rose-600 shrink-0' />
                      <span>Values Outside Normal Range</span>
                    </p>
                    <ul className='space-y-1 text-xs text-rose-800 pl-5 list-disc'>
                      {selectedRecord.aiExtractedData.flaggedValues.map((val, i) => (
                        <li key={i} className='font-semibold'>{val}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* AI Clinical Summary & Findings (7 Cols) */}
              <div className='lg:col-span-7 space-y-5'>
                {/* Clinical Summary */}
                <div className='bg-slate-50 border border-slate-200/90 rounded-2xl p-5 space-y-2'>
                  <h4 className='text-xs font-extrabold uppercase tracking-wider text-slate-700 flex items-center gap-2'>
                    <BrainCircuit className='w-4 h-4 text-sky-600' />
                    <span>Clinical Summary in Plain English</span>
                  </h4>
                  <p className='text-xs sm:text-sm text-slate-700 leading-relaxed'>
                    {selectedRecord.aiExtractedData.summary || 'Summary unavailable.'}
                  </p>
                </div>

                {/* Extracted Biomarker Numbers */}
                {totalMetricsCount > 0 && (
                  <div className='space-y-3'>
                    <div className='flex items-center justify-between'>
                      <h4 className='text-xs font-extrabold uppercase tracking-wider text-slate-700 flex items-center gap-2'>
                        <Activity className='w-4 h-4 text-emerald-600' />
                        <span>Extracted Lab Metrics ({totalMetricsCount})</span>
                      </h4>

                      <button
                        type='button'
                        onClick={() => syncBiomarkersToHealth(selectedRecord._id)}
                        disabled={syncingBiomarkers}
                        className='text-[11px] font-bold text-sky-600 hover:text-sky-700 bg-sky-50 px-2.5 py-1 rounded-lg border border-sky-200 cursor-pointer transition-colors inline-flex items-center gap-1'
                      >
                        <RefreshCw className={`w-3 h-3 ${syncingBiomarkers ? 'animate-spin' : ''}`} />
                        <span>Sync to Health Trends</span>
                      </button>
                    </div>

                    <div className='grid grid-cols-2 sm:grid-cols-3 gap-3'>
                      {Object.entries(selectedRecord.aiExtractedData.vitalMetrics).map(([key, val]) => (
                        <div
                          key={key}
                          className='p-3.5 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-1'
                        >
                          <span className='text-[10px] font-bold uppercase tracking-wider text-slate-400 block truncate'>
                            {key.replace(/([A-Z])/g, ' $1')}
                          </span>
                          <span className='text-base font-extrabold text-slate-900 tabular-nums block'>
                            {typeof val === 'object' ? `${val.value} ${val.unit || ''}` : String(val)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className='py-12 text-center space-y-3 bg-slate-50 rounded-2xl border border-slate-200/80'>
              <Sparkles className='w-8 h-8 text-sky-600 mx-auto' />
              <p className='text-sm font-bold text-slate-800'>Ready for AI Document Reading</p>
              <p className='text-xs text-slate-500 max-w-sm mx-auto'>
                Click "Read & Summarize" to let our medical OCR model extract test values and explain clinical findings.
              </p>
              <button
                type='button'
                onClick={() => analyzeRecordAI(selectedRecord._id)}
                disabled={analyzing === selectedRecord._id}
                className='px-5 py-2.5 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-bold shadow-sm inline-flex items-center gap-2 cursor-pointer'
              >
                <Sparkles className='w-4 h-4' />
                <span>Start AI Analysis</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Native HTML <dialog> Image Preview Modal */}
      <dialog
        ref={previewDialogRef}
        {...{ closedby: 'any' }}
        aria-labelledby={previewTitleId}
        className='m-auto rounded-3xl border border-slate-200 bg-white p-0 shadow-2xl max-w-4xl w-[calc(100%-2rem)] overflow-hidden backdrop:bg-slate-950/70 backdrop:backdrop-blur-xs overscroll-contain'
      >
        <div className='p-5 space-y-4'>
          <div className='flex items-center justify-between pb-3 border-b border-slate-100'>
            <div className='flex items-center gap-2'>
              <FileText className='w-4 h-4 text-sky-600' />
              <h3 id={previewTitleId} className='text-sm font-extrabold text-slate-900'>
                Original Medical Document
              </h3>
            </div>
            <button
              type='button'
              onClick={() => setPreviewModalImg(null)}
              className='p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer'
            >
              <X className='w-5 h-5' />
            </button>
          </div>

          <div className='max-h-[72vh] overflow-auto rounded-2xl bg-slate-950 flex items-center justify-center p-3'>
            <img
              src={previewModalImg}
              alt='Report Preview'
              className='max-h-[66vh] w-auto object-contain rounded-lg'
            />
          </div>

          <div className='flex items-center justify-between pt-1 text-xs text-slate-500'>
            <span>Click outside or press Esc to close</span>
            <a
              href={previewModalImg}
              target='_blank'
              rel='noreferrer'
              className='text-sky-600 hover:underline font-bold inline-flex items-center gap-1'
            >
              Open in New Window <ArrowRight className='w-3.5 h-3.5' />
            </a>
          </div>
        </div>
      </dialog>
    </div>
  )
}

export default MedicalRecords
