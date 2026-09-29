import React, { useState } from 'react';
import {
  ExternalLink,
  Save,
  RotateCcw,
  FileCode2,
} from 'lucide-react';
import {
  ServiceAccountCredentials,
  DEFAULT_CREDENTIALS,
  DEFAULT_GOOGLE_DOC_URL,
  buildGoogleDocUrl,
  extractGoogleDocId,
} from '../lib/seoHelpers';

interface SettingsAndGuidePanelProps {
  credentials: ServiceAccountCredentials;
  onSaveCredentials: (creds: ServiceAccountCredentials) => void;
  googleDocUrl: string;
  onChangeGoogleDocUrl: (url: string) => void;
}

export const SettingsAndGuidePanel: React.FC<SettingsAndGuidePanelProps> = ({
  credentials,
  onSaveCredentials,
  googleDocUrl,
  onChangeGoogleDocUrl,
}) => {
  const [formCreds, setFormCreds] = useState<ServiceAccountCredentials>(credentials);
  const [statusMsg, setStatusMsg] = useState('Ready to edit credentials & configuration.');

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
      {/* Google Docs Link Configuration */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Active Google Docs Link &amp; Template Source
            </h2>
            <p className="text-xs text-slate-600 mt-0.5">
              Update your Google Docs link anytime. Paste any Google Docs URL or Document ID below.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <a
              href={buildGoogleDocUrl(googleDocUrl)}
              target="_blank"
              rel="noopener noreferrer"
              className="h-9 px-3.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-colors inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              <span>Open Google Doc</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
            <button
              type="button"
              onClick={() => {
                onChangeGoogleDocUrl(DEFAULT_GOOGLE_DOC_URL);
                setStatusMsg('Reset Google Docs link to default.');
              }}
              className="h-9 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
            >
              Reset Default Link
            </button>
          </div>
        </div>

        <div className="pt-4 grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
          <div className="md:col-span-9">
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Google Docs URL or Document ID
            </label>
            <input
              type="text"
              value={googleDocUrl}
              onChange={(e) => onChangeGoogleDocUrl(e.target.value)}
              placeholder="https://docs.google.com/document/d/YOUR_DOC_ID/edit"
              className="w-full h-10 px-3.5 rounded-lg border border-slate-300 text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>
          <div className="md:col-span-3">
            <div className="h-10 px-3 rounded-lg bg-slate-50 border border-slate-200 flex flex-col justify-center">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Detected Doc ID
              </span>
              <span className="text-xs font-mono text-slate-800 truncate">
                {extractGoogleDocId(googleDocUrl)}
              </span>
            </div>
          </div>
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
