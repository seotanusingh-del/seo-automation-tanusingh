import React, { useState } from 'react';
import {
  Download,
  ExternalLink,
  Save,
  RotateCcw,
  Terminal,
  CheckCircle2,
  AlertTriangle,
  Cloud,
  KeyRound,
  FileCode2,
  RefreshCw,
} from 'lucide-react';
import {
  ServiceAccountCredentials,
  DEFAULT_CREDENTIALS,
  LIBREOFFICE_WEBSITE_URL,
  LIBREOFFICE_DOWNLOAD_URL,
} from '../lib/seoHelpers';

interface SettingsAndGuidePanelProps {
  credentials: ServiceAccountCredentials;
  onSaveCredentials: (creds: ServiceAccountCredentials) => void;
  libreOfficePath: string;
  onChangeLibreOfficePath: (path: string) => void;
  localBridgeUrl: string;
  onChangeLocalBridgeUrl: (url: string) => void;
  serverStatus: {
    libreofficeAvailable: boolean;
    libreofficePath: string | null;
    platform: string;
    isVercel: boolean;
  } | null;
  onRefreshServerStatus: () => void;
}

export const SettingsAndGuidePanel: React.FC<SettingsAndGuidePanelProps> = ({
  credentials,
  onSaveCredentials,
  libreOfficePath,
  onChangeLibreOfficePath,
  localBridgeUrl,
  onChangeLocalBridgeUrl,
  serverStatus,
  onRefreshServerStatus,
}) => {
  const [formCreds, setFormCreds] = useState<ServiceAccountCredentials>(credentials);
  const [statusMsg, setStatusMsg] = useState('Ready to edit credentials & configuration.');
  const [activeGuideTab, setActiveGuideTab] = useState<
    'libreoffice' | 'vercel' | 'google'
  >('libreoffice');

  const handleFieldChange = (
    key: keyof ServiceAccountCredentials,
    value: string
  ) => {
    setFormCreds((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    onSaveCredentials(formCreds);
    setStatusMsg('Credentials & settings saved successfully!');
    setTimeout(() => setStatusMsg('Ready to edit credentials & configuration.'), 3000);
  };

  const handleReset = () => {
    setFormCreds(DEFAULT_CREDENTIALS);
    onSaveCredentials(DEFAULT_CREDENTIALS);
    setStatusMsg('Credentials reset to default values!');
    setTimeout(() => setStatusMsg('Ready to edit credentials & configuration.'), 3000);
  };

  const handleDownloadCredentialsJson = () => {
    const blob = new Blob([JSON.stringify(formCreds, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'credentials.json';
    a.click();
    URL.revokeObjectURL(url);
    setStatusMsg('Downloaded credentials.json');
  };

  return (
    <div className="flex flex-col gap-6">
      {/* LibreOffice External App Banner & Quick Setup */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-200">
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <h2 className="text-base font-bold text-slate-900">
                External PDF Engine: LibreOffice Setup &amp; Download
              </h2>
              {serverStatus?.libreofficeAvailable ? (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Connected ({serverStatus.libreofficePath})
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Cloud / Batch Mode Active
                </span>
              )}
            </div>
            <p className="text-xs text-slate-600">
              This application uses <strong>LibreOffice</strong> (<code>soffice --headless --convert-to pdf</code>) for lossless DOCX-to-PDF conversion. Download the official external application from{' '}
              <a
                href={LIBREOFFICE_WEBSITE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 font-semibold underline hover:text-blue-800"
              >
                https://www.libreoffice.org/
              </a>
              .
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <a
              href={LIBREOFFICE_WEBSITE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="h-10 px-4 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-colors inline-flex items-center gap-2 whitespace-nowrap"
            >
              <Download className="w-4 h-4" />
              <span>Download LibreOffice (libreoffice.org)</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
            <a
              href={LIBREOFFICE_DOWNLOAD_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="h-10 px-3.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-lg transition-colors inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              <span>Direct Releases</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
            <button
              type="button"
              onClick={onRefreshServerStatus}
              className="h-10 px-3 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-medium rounded-lg transition-colors inline-flex items-center gap-1.5 cursor-pointer"
              title="Re-check LibreOffice Binary"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Verify Binary</span>
            </button>
          </div>
        </div>

        {/* LibreOffice Path & Local Companion Bridge Inputs */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Custom LibreOffice Binary Path (LIBREOFFICE_BIN)
            </label>
            <input
              type="text"
              value={libreOfficePath}
              onChange={(e) => onChangeLibreOfficePath(e.target.value)}
              placeholder="e.g. /Applications/LibreOffice.app/Contents/MacOS/soffice or C:\Program Files\LibreOffice\program\soffice.exe"
              className="w-full h-9 px-3 rounded-lg border border-slate-300 text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Leave blank to auto-detect from standard macOS, Windows, and Linux paths.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Optional Local LibreOffice Companion URL (When Hosted on Vercel)
            </label>
            <input
              type="text"
              value={localBridgeUrl}
              onChange={(e) => onChangeLocalBridgeUrl(e.target.value)}
              placeholder="Optional: http://localhost:3000 (if running local server alongside Vercel)"
              className="w-full h-9 px-3 rounded-lg border border-slate-300 text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              If running on Vercel without a local server, every generated ZIP automatically includes 1-click LibreOffice batch scripts (<code>.bat</code> &amp; <code>.sh</code>).
            </p>
          </div>
        </div>
      </div>

      {/* Interactive Setup & Deployment Guide */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-slate-50/60">
          <h3 className="text-sm font-bold text-slate-900">
            Complete Setup &amp; Deployment Guide
          </h3>

          <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg">
            <button
              type="button"
              onClick={() => setActiveGuideTab('libreoffice')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                activeGuideTab === 'libreoffice'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Terminal className="w-3.5 h-3.5" />
              <span>1. LibreOffice Setup</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveGuideTab('vercel')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                activeGuideTab === 'vercel'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Cloud className="w-3.5 h-3.5" />
              <span>2. Vercel Deployment</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveGuideTab('google')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                activeGuideTab === 'google'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>3. Google Cloud &amp; Local Run</span>
            </button>
          </div>
        </div>

        <div className="p-5 text-xs text-slate-700 space-y-4 leading-relaxed">
          {activeGuideTab === 'libreoffice' && (
            <div className="space-y-4">
              <div className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <p className="font-bold text-slate-900">
                    Step 1: Download &amp; Install LibreOffice
                  </p>
                  <p className="text-slate-600 mt-0.5">
                    Visit the official LibreOffice website (
                    <a
                      href={LIBREOFFICE_WEBSITE_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-700 font-semibold underline"
                    >
                      https://www.libreoffice.org/
                    </a>
                    ) and install the latest stable package for your operating system.
                  </p>
                </div>
                <a
                  href={LIBREOFFICE_WEBSITE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg inline-flex items-center gap-1.5 shrink-0 whitespace-nowrap"
                >
                  <span>Open libreoffice.org</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 border border-slate-200 rounded-lg bg-slate-50/40">
                  <p className="font-bold text-slate-900 mb-1.5">
                    macOS Setup
                  </p>
                  <ol className="list-decimal list-inside space-y-1.5 text-slate-600">
                    <li>
                      Download from{' '}
                      <a
                        href={LIBREOFFICE_WEBSITE_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 underline"
                      >
                        libreoffice.org
                      </a>{' '}
                      or run:
                      <pre className="mt-1 p-2 bg-slate-900 text-slate-100 rounded font-mono text-[11px] overflow-x-auto">
                        brew install --cask libreoffice
                      </pre>
                    </li>
                    <li>
                      Default binary location:
                      <code className="block mt-1 p-1.5 bg-slate-100 rounded font-mono text-[11px]">
                        /Applications/LibreOffice.app/Contents/MacOS/soffice
                      </code>
                    </li>
                  </ol>
                </div>

                <div className="p-4 border border-slate-200 rounded-lg bg-slate-50/40">
                  <p className="font-bold text-slate-900 mb-1.5">
                    Windows Setup
                  </p>
                  <ol className="list-decimal list-inside space-y-1.5 text-slate-600">
                    <li>
                      Download the Windows <code>.msi</code> installer from{' '}
                      <a
                        href={LIBREOFFICE_WEBSITE_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 underline"
                      >
                        libreoffice.org
                      </a>
                      .
                    </li>
                    <li>
                      Default binary location:
                      <code className="block mt-1 p-1.5 bg-slate-100 rounded font-mono text-[11px] break-all">
                        C:\Program Files\LibreOffice\program\soffice.exe
                      </code>
                    </li>
                  </ol>
                </div>

                <div className="p-4 border border-slate-200 rounded-lg bg-slate-50/40">
                  <p className="font-bold text-slate-900 mb-1.5">
                    Linux (Ubuntu / Debian)
                  </p>
                  <ol className="list-decimal list-inside space-y-1.5 text-slate-600">
                    <li>
                      Install via APT:
                      <pre className="mt-1 p-2 bg-slate-900 text-slate-100 rounded font-mono text-[11px] overflow-x-auto">
                        sudo apt update &amp;&amp; sudo apt install -y libreoffice
                      </pre>
                    </li>
                    <li>
                      Default binary location:
                      <code className="block mt-1 p-1.5 bg-slate-100 rounded font-mono text-[11px]">
                        /usr/bin/soffice
                      </code>
                    </li>
                  </ol>
                </div>
              </div>

              <div className="p-4 border border-slate-200 rounded-lg bg-slate-50/60">
                <p className="font-bold text-slate-900 mb-1">
                  How LibreOffice Works When You Use the Web App on Vercel
                </p>
                <ul className="list-disc list-inside space-y-1 text-slate-600">
                  <li>
                    <strong>Mode A (Cloud Generation + 1-Click Local LibreOffice Script):</strong>{' '}
                    From anywhere on Vercel, the web app performs all TFN and Airline replacements inside your DOCX template and bundles them into a ZIP archive along with <code>convert_to_pdf_windows.bat</code> and <code>convert_to_pdf_mac_linux.sh</code>. Simply extract the ZIP and double-click the script to run your local LibreOffice (<code>soffice --headless --convert-to pdf</code>) across all 44 files in seconds.
                  </li>
                  <li>
                    <strong>Mode B (Local Server / Companion Bridge):</strong>{' '}
                    If you run <code>npm run dev</code> locally on a computer with LibreOffice installed (or set <code>http://localhost:3000</code> in the Local Companion URL field above), the app converts all DOCX files directly into PDFs on the fly and lets you download individual PDFs or a complete PDF ZIP archive immediately.
                  </li>
                </ul>
              </div>
            </div>
          )}

          {activeGuideTab === 'vercel' && (
            <div className="space-y-4">
              <p className="font-bold text-slate-900">
                Deploying SEO Document Studio to Vercel (Ready Out-of-the-Box)
              </p>
              <p className="text-slate-600">
                This project includes a pre-configured <code>vercel.json</code> and Serverless API handler at <code>/api/index.ts</code> so you can deploy directly to Vercel with zero code changes:
              </p>
              <ol className="list-decimal list-inside space-y-2.5 text-slate-700">
                <li>
                  <strong>Push to GitHub / GitLab / Bitbucket:</strong> Commit all files in this project (including <code>vercel.json</code> and <code>/api/index.ts</code>) to your Git repository.
                </li>
                <li>
                  <strong>Import Project in Vercel:</strong> Go to{' '}
                  <a
                    href="https://vercel.com/new"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 underline font-medium"
                  >
                    https://vercel.com/new
                  </a>{' '}
                  and select your repository.
                </li>
                <li>
                  <strong>Verify Build Settings (Auto-Detected via vercel.json):</strong>
                  <div className="mt-1.5 grid grid-cols-1 sm:grid-cols-3 gap-2 font-mono text-[11px]">
                    <div className="p-2.5 bg-slate-100 rounded border border-slate-200">
                      <span className="text-slate-500 block">Framework Preset:</span>
                      <strong>Vite</strong>
                    </div>
                    <div className="p-2.5 bg-slate-100 rounded border border-slate-200">
                      <span className="text-slate-500 block">Build Command:</span>
                      <strong>npm run build</strong>
                    </div>
                    <div className="p-2.5 bg-slate-100 rounded border border-slate-200">
                      <span className="text-slate-500 block">Output Directory:</span>
                      <strong>dist</strong>
                    </div>
                  </div>
                </li>
                <li>
                  <strong>Click Deploy:</strong> Your web app will be live on your <code>.vercel.app</code> domain and accessible from any computer or mobile device anywhere.
                </li>
              </ol>
            </div>
          )}

          {activeGuideTab === 'google' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 border border-slate-200 rounded-lg bg-slate-50/40">
                  <p className="font-bold text-slate-900 mb-1.5">
                    Running Locally on Your Machine
                  </p>
                  <ol className="list-decimal list-inside space-y-1.5 text-slate-600">
                    <li>Install Node.js 18+ and LibreOffice (<a href={LIBREOFFICE_WEBSITE_URL} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">libreoffice.org</a>).</li>
                    <li>
                      Install dependencies:
                      <pre className="mt-1 p-2 bg-slate-900 text-slate-100 rounded font-mono text-[11px]">
                        npm install
                      </pre>
                    </li>
                    <li>
                      Start the full-stack server:
                      <pre className="mt-1 p-2 bg-slate-900 text-slate-100 rounded font-mono text-[11px]">
                        npm run dev
                      </pre>
                    </li>
                    <li>Open <code>http://localhost:3000</code> in your browser.</li>
                  </ol>
                </div>

                <div className="p-4 border border-slate-200 rounded-lg bg-slate-50/40">
                  <p className="font-bold text-slate-900 mb-1.5">
                    Google Docs &amp; Google Sheets API Setup
                  </p>
                  <ol className="list-decimal list-inside space-y-1.5 text-slate-600">
                    <li>
                      Ensure the <strong>Google Docs API</strong>, <strong>Google Drive API</strong>, and <strong>Google Sheets API</strong> are enabled in your Google Cloud project.
                    </li>
                    <li>
                      Share your Google Doc (<code>1wWLgilVoc0AabtNoDcmEHzYv2K4VjvHb7qfycs-ZCTU</code>) and Google Sheet (<code>1E4gyzCpwb4eIwUubY6CiKkl9CjO49kw327D8bUfj5Fg</code>) with the Service Account email (<code>{formCreds.client_email}</code>).
                    </li>
                    <li>
                      You can edit or reset the Service Account keys directly below.
                    </li>
                  </ol>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Google Cloud Service Account Settings Editor */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-slate-50/60">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Google Cloud Service Account Settings
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Safe &amp; Backed Up · Fully Editable · Reset Available
            </p>
          </div>

          <button
            type="button"
            onClick={handleDownloadCredentialsJson}
            className="h-9 px-3.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg transition-colors inline-flex items-center gap-1.5 cursor-pointer"
          >
            <FileCode2 className="w-3.5 h-3.5 text-blue-600" />
            <span>Export credentials.json</span>
          </button>
        </div>

        <div className="p-5 space-y-6">
          {/* Project Information */}
          <div>
            <h4 className="text-xs font-bold text-slate-800 mb-3 pb-1.5 border-b border-slate-100">
              01. Project Information
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Type
                </label>
                <input
                  type="text"
                  value={formCreds.type}
                  onChange={(e) => handleFieldChange('type', e.target.value)}
                  className="w-full h-9 px-3 rounded-lg border border-slate-300 text-xs font-mono text-slate-800"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Project ID
                </label>
                <input
                  type="text"
                  value={formCreds.project_id}
                  onChange={(e) =>
                    handleFieldChange('project_id', e.target.value)
                  }
                  className="w-full h-9 px-3 rounded-lg border border-slate-300 text-xs font-mono text-slate-800"
                />
              </div>
            </div>
          </div>

          {/* Credentials */}
          <div>
            <h4 className="text-xs font-bold text-slate-800 mb-3 pb-1.5 border-b border-slate-100">
              02. Credentials
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Private Key ID
                </label>
                <input
                  type="text"
                  value={formCreds.private_key_id}
                  onChange={(e) =>
                    handleFieldChange('private_key_id', e.target.value)
                  }
                  className="w-full h-9 px-3 rounded-lg border border-slate-300 text-xs font-mono text-slate-800"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Client ID
                </label>
                <input
                  type="text"
                  value={formCreds.client_id}
                  onChange={(e) =>
                    handleFieldChange('client_id', e.target.value)
                  }
                  className="w-full h-9 px-3 rounded-lg border border-slate-300 text-xs font-mono text-slate-800"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Client Email
                </label>
                <input
                  type="text"
                  value={formCreds.client_email}
                  onChange={(e) =>
                    handleFieldChange('client_email', e.target.value)
                  }
                  className="w-full h-9 px-3 rounded-lg border border-slate-300 text-xs font-mono text-slate-800"
                />
              </div>
            </div>
          </div>

          {/* OAuth URLs & Universe Domain */}
          <div>
            <h4 className="text-xs font-bold text-slate-800 mb-3 pb-1.5 border-b border-slate-100">
              03. OAuth Endpoints &amp; Domain
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Auth URI
                </label>
                <input
                  type="text"
                  value={formCreds.auth_uri}
                  onChange={(e) => handleFieldChange('auth_uri', e.target.value)}
                  className="w-full h-9 px-3 rounded-lg border border-slate-300 text-xs font-mono text-slate-800"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Token URI
                </label>
                <input
                  type="text"
                  value={formCreds.token_uri}
                  onChange={(e) =>
                    handleFieldChange('token_uri', e.target.value)
                  }
                  className="w-full h-9 px-3 rounded-lg border border-slate-300 text-xs font-mono text-slate-800"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Auth Provider X509 Cert URL
                </label>
                <input
                  type="text"
                  value={formCreds.auth_provider_x509_cert_url}
                  onChange={(e) =>
                    handleFieldChange(
                      'auth_provider_x509_cert_url',
                      e.target.value
                    )
                  }
                  className="w-full h-9 px-3 rounded-lg border border-slate-300 text-xs font-mono text-slate-800"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Client X509 Cert URL
                </label>
                <input
                  type="text"
                  value={formCreds.client_x509_cert_url}
                  onChange={(e) =>
                    handleFieldChange('client_x509_cert_url', e.target.value)
                  }
                  className="w-full h-9 px-3 rounded-lg border border-slate-300 text-xs font-mono text-slate-800"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Universe Domain
                </label>
                <input
                  type="text"
                  value={formCreds.universe_domain}
                  onChange={(e) =>
                    handleFieldChange('universe_domain', e.target.value)
                  }
                  className="w-full h-9 px-3 rounded-lg border border-slate-300 text-xs font-mono text-slate-800"
                />
              </div>
            </div>
          </div>

          {/* Private Key */}
          <div>
            <h4 className="text-xs font-bold text-slate-800 mb-2">
              04. Private Key
            </h4>
            <textarea
              rows={5}
              value={formCreds.private_key}
              onChange={(e) => handleFieldChange('private_key', e.target.value)}
              className="w-full p-3 rounded-lg border border-slate-300 text-[11px] font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2">
            <button
              type="button"
              onClick={handleSave}
              className="flex-1 h-10 px-5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>Save Changes</span>
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="flex-1 h-10 px-5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Reset to Default</span>
            </button>
          </div>
        </div>
      </div>

      <p className="text-xs italic text-slate-500 px-1">{statusMsg}</p>
    </div>
  );
};
