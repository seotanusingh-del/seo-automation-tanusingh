import React, { useState } from 'react';
import {
  Lock,
  User,
  Eye,
  EyeOff,
  ShieldCheck,
  AlertCircle,
  KeyRound,
  X,
  Download,
  Linkedin,
  Mail,
  Instagram,
} from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface LoginScreenProps {
  onAuthenticated: () => void;
  hasSavedWorkspace?: boolean;
  lastSavedTab?: string;
}

const VALID_USERNAME = '8081368879';
const DEFAULT_PASSWORD = 'seo.8268';
const LOGIN_OTP = '6307500844';

export const LoginScreen: React.FC<LoginScreenProps> = ({
  onAuthenticated,
}) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Install Popup State (Bottom Popup on Login Page Only)
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [showInstallHelpModal, setShowInstallHelpModal] = useState(false);

  // Two-Step Verification OTP Modal State
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otpInput, setOtpInput] = useState('');
  const [otpError, setOtpError] = useState<string | null>(null);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);

  const getExpectedLocalPassword = () => {
    return localStorage.getItem('seo_custom_app_password') || DEFAULT_PASSWORD;
  };

  const handleInstallClick = async () => {
    if (isInstallable) {
      const accepted = await install();
      if (accepted) {
        setBannerDismissed(true);
      }
      return;
    }
    setShowInstallHelpModal(true);
  };

  const handleStep1Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const trimmedUser = username.trim();
    const expectedPass = getExpectedLocalPassword();

    try {
      let step1Passed = false;
      try {
        const res = await fetch('/api/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: trimmedUser,
            password,
            clientStoredPassword: expectedPass,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          step1Passed = Boolean(data.step1Verified || data.authenticated);
        }
      } catch {
        step1Passed =
          trimmedUser === VALID_USERNAME && password === expectedPass;
      }

      if (
        step1Passed ||
        (trimmedUser === VALID_USERNAME && password === expectedPass)
      ) {
        setOtpInput('');
        setOtpError(null);
        setShowOtpModal(true);
      } else {
        setError('Invalid username or password. Access denied.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setOtpError(null);
    setIsVerifyingOtp(true);

    const cleanOtp = otpInput.trim();

    try {
      let otpValid = false;
      try {
        const res = await fetch('/api/verify-login-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: username.trim(),
            otp: cleanOtp,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          otpValid = Boolean(data.otpVerified && data.authenticated);
          if (data.sessionToken) {
            sessionStorage.setItem('seo_studio_auth_session', data.sessionToken);
          }
        }
      } catch {
        otpValid = cleanOtp === LOGIN_OTP;
      }

      if (otpValid || cleanOtp === LOGIN_OTP) {
        setShowOtpModal(false);
        onAuthenticated();
      } else {
        setOtpError('Invalid verification OTP. Please try again.');
      }
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  const handleCancelOtpModal = () => {
    setShowOtpModal(false);
    setOtpInput('');
    setOtpError(null);
    setPassword('');
    setError('Verification cancelled. Session remained locked.');
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col justify-center items-center px-4 py-10 pb-24 relative">
      {/* Centered Login Card */}
      <div className="w-full max-w-[420px] bg-white border border-slate-200/90 rounded-2xl shadow-xs p-7 sm:p-8">
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center mb-4">
            <ShieldCheck className="w-6 h-6 text-blue-600" />
          </div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            SEO AUTOMATOR
          </h1>
          <p className="text-xs text-slate-500 mt-1.5">
            Enter your credentials to access the workspace
          </p>
        </div>

        <form onSubmit={handleStep1Submit} className="space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs font-medium text-red-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Username
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                required
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter username"
                className="w-full h-11 pl-10 pr-3.5 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                className="w-full h-11 pl-10 pr-10 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full h-11 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors cursor-pointer mt-2"
          >
            {isSubmitting ? 'Signing In...' : 'Sign In'}
          </button>
        </form>

        {/* Developer Info Footer with LinkedIn, Gmail & Instagram Links */}
        <div className="mt-6 pt-5 border-t border-slate-100 flex flex-col items-center gap-2.5">
          <span className="text-[11px] font-medium text-slate-500">
            Developed by <strong className="text-slate-800">Shashank Rajput</strong>
          </span>
          <div className="flex items-center gap-3">
            <a
              href="https://www.linkedin.com/in/shashankrajputx/"
              target="_blank"
              rel="noopener noreferrer"
              title="LinkedIn — Shashank Rajput"
              className="w-9 h-9 rounded-xl bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-200 text-slate-600 hover:text-blue-600 flex items-center justify-center transition-colors"
            >
              <Linkedin className="w-4 h-4" />
            </a>
            <a
              href="https://mail.google.com/mail/?view=cm&fs=1&to=aws.shashanksingh@gmail.com"
              target="_blank"
              rel="noopener noreferrer"
              title="Send Gmail to aws.shashanksingh@gmail.com"
              className="w-9 h-9 rounded-xl bg-slate-50 hover:bg-red-50 border border-slate-200 hover:border-red-200 text-slate-600 hover:text-red-600 flex items-center justify-center transition-colors"
            >
              <Mail className="w-4 h-4" />
            </a>
            <a
              href="https://www.instagram.com/shashankrajput.__/"
              target="_blank"
              rel="noopener noreferrer"
              title="Instagram — @shashankrajput.__"
              className="w-9 h-9 rounded-xl bg-slate-50 hover:bg-pink-50 border border-slate-200 hover:border-pink-200 text-slate-600 hover:text-pink-600 flex items-center justify-center transition-colors"
            >
              <Instagram className="w-4 h-4" />
            </a>
          </div>
        </div>
      </div>

      {/* Bottom Floating Install App Popup (Login Page Only) */}
      {!isInstalled && !bannerDismissed && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-40 w-[calc(100%-2rem)] max-w-lg bg-white border border-slate-200 rounded-2xl shadow-lg px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center shrink-0">
              <Download className="w-4 h-4 text-white" />
            </div>
            <span className="text-xs sm:text-sm font-semibold text-slate-800 truncate">
              Install SEO AUTOMATOR for faster access.
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleInstallClick}
              className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-3.5 py-2 rounded-xl inline-flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Install App</span>
            </button>
            <button
              type="button"
              onClick={() => setBannerDismissed(true)}
              className="text-slate-400 hover:text-slate-700 p-1 rounded-lg transition-colors cursor-pointer"
              title="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Mandatory 2-Step Verification Popup Modal (Light UI, Invisible OTP) */}
      {showOtpModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-sm w-full overflow-hidden shadow-2xl">
            <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center">
                  <KeyRound className="w-4 h-4 text-blue-600" />
                </div>
                <h2 className="text-sm font-bold text-slate-900">
                  Two-Step Verification
                </h2>
              </div>
              <button
                type="button"
                onClick={handleCancelOtpModal}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
                title="Cancel"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleVerifyOtp} className="p-5 space-y-4">
              {otpError && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs font-medium text-red-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                  <span>{otpError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Verification OTP
                </label>
                <input
                  type="password"
                  required
                  autoFocus
                  autoComplete="off"
                  value={otpInput}
                  onChange={(e) => setOtpInput(e.target.value)}
                  placeholder="••••••••"
                  className="w-full h-11 px-3.5 rounded-lg border border-slate-300 text-base font-mono font-bold tracking-widest text-center text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div className="flex items-center gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={handleCancelOtpModal}
                  className="flex-1 h-10 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isVerifyingOtp}
                  className="flex-1 h-10 px-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer"
                >
                  {isVerifyingOtp ? 'Verifying...' : 'Verify & Unlock'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Install App Guide Modal */}
      {showInstallHelpModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center text-white">
                  <Download className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Install SEO AUTOMATOR
                  </h3>
                  <p className="text-xs text-slate-500">
                    Add to your Desktop or Mobile Home Screen
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowInstallHelpModal(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {isIOS ? (
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 space-y-2 leading-relaxed">
                <p className="font-semibold text-slate-900">
                  To install on iPhone or iPad:
                </p>
                <p>
                  1. Tap the <strong>Share</strong> button in your Safari toolbar.
                </p>
                <p>
                  2. Scroll down and tap <strong>Add to Home Screen</strong>.
                </p>
              </div>
            ) : (
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 space-y-2 leading-relaxed">
                <p className="font-semibold text-slate-900">
                  To install on Chrome, Edge, or Desktop:
                </p>
                <p>
                  1. Open the application URL directly in a full browser tab.
                </p>
                <p>
                  2. Click the <strong>Install icon</strong> on the right side of the address bar (or open Browser Menu &rarr; <strong>Install SEO AUTOMATOR</strong>).
                </p>
              </div>
            )}

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setShowInstallHelpModal(false)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg cursor-pointer"
              >
                Got It
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
