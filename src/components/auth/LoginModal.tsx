import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Eye, EyeOff, Lock, User, CheckCircle2, LogOut, Sparkles, KeyRound, ShieldAlert } from 'lucide-react'
import { GlassButton } from '@/components/ui/GlassButton'
import { AppUser, Department, generateUsername, userStore } from '@/services/userStore'

interface LoginModalProps {
  isOpen: boolean
  onClose: () => void
  currentUser: AppUser | null
  onLoginSuccess: (user: AppUser) => void
  onLogout: () => void
  onOpenSettings?: () => void
}

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onLoginSuccess,
  onLogout,
  onOpenSettings,
}) => {
  const hasAdmin = userStore.hasAdmin()

  // Views: 'signin' | 'register-admin' | 'first-login-pwd'
  const [view, setView] = useState<'signin' | 'register-admin' | 'first-login-pwd'>('signin')

  // Sign In fields
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  // Register Admin fields
  const [adminFullName, setAdminFullName] = useState('')
  const [adminPassword, setAdminPassword] = useState('')
  const [adminCompany, setAdminCompany] = useState('Demirtürk Portföy')
  const [adminDept, setAdminDept] = useState<Department>('Yönetim')
  const [adminEmail, setAdminEmail] = useState('')

  // First-time password change fields
  const [pendingUser, setPendingUser] = useState<AppUser | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  // Auto-switch to register-admin if no admin exists in the system
  useEffect(() => {
    if (!hasAdmin && !currentUser) {
      setView('register-admin')
    } else if (view === 'register-admin' && hasAdmin) {
      setView('signin')
    }
  }, [hasAdmin, currentUser])

  // Real-time username preview for admin registration
  const previewUsername = adminFullName ? generateUsername(adminFullName, userStore.getAllUsers()) : ''

  const handleSignIn = (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage('')

    const res = userStore.login(identifier, password)
    if (!res.success || !res.user) {
      setErrorMessage(res.error || 'Giriş yapılamadı.')
      return
    }

    // Check if user must change password (first login with 8-char temporary password)
    if (res.user.mustChangePassword) {
      setPendingUser(res.user)
      setView('first-login-pwd')
      return
    }

    onLoginSuccess(res.user)
    onClose()
  }

  const handleRegisterAdmin = (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage('')

    if (!adminFullName.trim() || !adminPassword.trim()) {
      setErrorMessage('Lütfen tüm zorunlu alanları doldurun.')
      return
    }

    const createdAdmin = userStore.registerAdmin({
      fullName: adminFullName,
      password: adminPassword,
      companyName: adminCompany,
      department: adminDept,
      email: adminEmail,
    })

    onLoginSuccess(createdAdmin)
    onClose()
  }

  const handleFirstLoginPasswordChange = (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage('')

    if (!pendingUser) return
    if (newPassword.length < 6) {
      setErrorMessage('Yeni şifre en az 6 karakter olmalıdır.')
      return
    }
    if (newPassword !== confirmPassword) {
      setErrorMessage('Şifreler birbiriyle eşleşmiyor.')
      return
    }

    userStore.changePassword(pendingUser.id, newPassword)
    const updated = userStore.getCurrentUser()
    if (updated) {
      onLoginSuccess(updated)
    }
    onClose()
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          {/* Backdrop Blur Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/75 backdrop-blur-md"
          />

          {/* Modal Box - Reelms Theme Styling */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            className="relative w-full max-w-md z-10 rounded-[36px] bg-[#34302d] border border-[#4a443f] p-8 sm:p-10 shadow-2xl shadow-black/80 font-sans text-center select-none"
          >
            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute top-5 right-5 p-2 rounded-full text-[#a69f99] hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            {currentUser ? (
              /* Already Logged In View */
              <div className="space-y-6 py-4">
                <div className="w-16 h-16 rounded-full bg-[#282522] border border-[#b99881]/40 flex items-center justify-center mx-auto text-xl font-bold text-[#b99881]">
                  {currentUser.fullName.slice(0, 2).toUpperCase()}
                </div>

                <div className="space-y-1">
                  <h3 className="text-xl font-bold text-white">
                    {currentUser.fullName}
                  </h3>
                  <p className="text-xs text-[#a69f99]">
                    @{currentUser.username} • {currentUser.department} Departmanı
                  </p>
                  <span className="inline-block mt-2 px-3 py-0.5 rounded-full bg-[#b99881]/15 text-[#b99881] border border-[#b99881]/30 text-xs font-bold">
                    {currentUser.isManager ? 'Şirket Yöneticisi' : 'Ekip Üyesi'}
                  </span>
                </div>

                <div className="pt-4 border-t border-[#4a443f] flex flex-col gap-2.5">
                  {onOpenSettings && (
                    <GlassButton
                      variant="gold"
                      size="md"
                      className="w-full rounded-full"
                      onClick={() => {
                        onClose()
                        onOpenSettings()
                      }}
                    >
                      Ayarlar ve Ekip Yönetimi
                    </GlassButton>
                  )}

                  <div className="flex gap-2.5">
                    <GlassButton
                      variant="subtle"
                      size="md"
                      className="flex-1 rounded-full"
                      onClick={onClose}
                    >
                      Kapat
                    </GlassButton>
                    <GlassButton
                      variant="danger"
                      size="md"
                      icon={<LogOut className="w-4 h-4" />}
                      className="flex-1 rounded-full"
                      onClick={() => {
                        onLogout()
                        onClose()
                      }}
                    >
                      Çıkış Yap
                    </GlassButton>
                  </div>
                </div>
              </div>
            ) : view === 'first-login-pwd' ? (
              /* First Login: Force Password Change */
              <div className="space-y-5 text-left">
                <div className="text-center space-y-1">
                  <div className="w-12 h-12 rounded-full bg-amber-500/15 border border-amber-500/30 flex items-center justify-center mx-auto text-amber-400 mb-2">
                    <KeyRound className="w-5 h-5" />
                  </div>
                  <h2 className="text-xl font-bold text-white">
                    İlk Giriş: Şifrenizi Yenileyin
                  </h2>
                  <p className="text-xs text-[#a69f99]">
                    Hesabınızın güvenliği için lütfen 8 karakterli geçici şifrenizi yeni ve kalıcı bir şifre ile değiştirin.
                  </p>
                </div>

                <form onSubmit={handleFirstLoginPasswordChange} className="space-y-4 pt-2">
                  <div>
                    <label className="text-xs font-semibold text-[#f3efe9] block mb-1">
                      Yeni Şifre
                    </label>
                    <input
                      type="password"
                      required
                      placeholder="En az 6 karakter"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full bg-[#24211f] border border-[#4a443f] focus:border-[#b99881] rounded-full px-5 py-3 text-sm text-[#f3efe9] placeholder-[#9e9690] focus:outline-none transition-colors"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-[#f3efe9] block mb-1">
                      Yeni Şifre (Tekrar)
                    </label>
                    <input
                      type="password"
                      required
                      placeholder="Şifrenizi doğrulayın"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full bg-[#24211f] border border-[#4a443f] focus:border-[#b99881] rounded-full px-5 py-3 text-sm text-[#f3efe9] placeholder-[#9e9690] focus:outline-none transition-colors"
                    />
                  </div>

                  {errorMessage && (
                    <p className="text-xs text-rose-400 text-center font-medium">
                      {errorMessage}
                    </p>
                  )}

                  <button
                    type="submit"
                    className="w-full bg-[#b99881] hover:bg-[#d6beae] text-[#1c1a18] font-bold rounded-full py-3 text-sm transition-all shadow-md cursor-pointer"
                  >
                    Şifreyi Kaydet ve Devam Et
                  </button>
                </form>
              </div>
            ) : view === 'register-admin' ? (
              /* Register First Admin */
              <div className="space-y-5 text-left">
                <div className="text-center space-y-1">
                  <div className="w-12 h-12 rounded-full bg-[#b99881]/15 border border-[#b99881]/30 flex items-center justify-center mx-auto text-[#b99881] mb-2">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <h2 className="text-2xl font-bold text-white tracking-tight">
                    Yönetici Hesabı Kurulumu
                  </h2>
                  <p className="text-xs text-[#a69f99]">
                    Sistemde henüz yönetici bulunmuyor. İlk hesabı oluşturup tüm çalışanları siz yöneteceksiniz.
                  </p>
                </div>

                <form onSubmit={handleRegisterAdmin} className="space-y-3.5 pt-1">
                  <div>
                    <label className="text-xs font-semibold text-[#f3efe9] block mb-1">
                      Ad Soyad *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Örn: Berkant Çalışkan"
                      value={adminFullName}
                      onChange={(e) => setAdminFullName(e.target.value)}
                      className="w-full bg-[#24211f] border border-[#4a443f] focus:border-[#b99881] rounded-full px-5 py-2.5 text-sm text-[#f3efe9] placeholder-[#9e9690] focus:outline-none transition-colors"
                    />
                    {previewUsername && (
                      <span className="text-[11px] text-[#b99881] mt-1 block font-mono">
                        Otomatik Kullanıcı Adınız: @{previewUsername}
                      </span>
                    )}
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-[#f3efe9] block mb-1">
                      Şifre *
                    </label>
                    <input
                      type="password"
                      required
                      placeholder="Şifrenizi belirleyin"
                      value={adminPassword}
                      onChange={(e) => setAdminPassword(e.target.value)}
                      className="w-full bg-[#24211f] border border-[#4a443f] focus:border-[#b99881] rounded-full px-5 py-2.5 text-sm text-[#f3efe9] placeholder-[#9e9690] focus:outline-none transition-colors"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="text-xs font-semibold text-[#f3efe9] block mb-1">
                        Şirket Adı
                      </label>
                      <input
                        type="text"
                        required
                        value={adminCompany}
                        onChange={(e) => setAdminCompany(e.target.value)}
                        className="w-full bg-[#24211f] border border-[#4a443f] focus:border-[#b99881] rounded-full px-4 py-2 text-xs text-[#f3efe9] focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-[#f3efe9] block mb-1">
                        Departman
                      </label>
                      <select
                        value={adminDept}
                        onChange={(e) => setAdminDept(e.target.value as Department)}
                        className="w-full bg-[#24211f] border border-[#4a443f] focus:border-[#b99881] rounded-full px-3 py-2 text-xs text-[#f3efe9] focus:outline-none cursor-pointer"
                      >
                        <option value="Yönetim">Yönetim</option>
                        <option value="Satış">Satış</option>
                        <option value="Pazarlama">Pazarlama</option>
                        <option value="Müşteri İlişkileri">Müşteri İlişkileri</option>
                        <option value="Muhasebe">Muhasebe</option>
                      </select>
                    </div>
                  </div>

                  {errorMessage && (
                    <p className="text-xs text-rose-400 text-center font-medium">
                      {errorMessage}
                    </p>
                  )}

                  <button
                    type="submit"
                    className="w-full bg-[#b99881] hover:bg-[#d6beae] text-[#1c1a18] font-bold rounded-full py-3 text-sm transition-all shadow-md cursor-pointer mt-2"
                  >
                    Yönetici Hesabı Oluştur ve Başla
                  </button>

                  {hasAdmin && (
                    <div className="text-center pt-2">
                      <button
                        type="button"
                        onClick={() => setView('signin')}
                        className="text-xs text-[#a69f99] hover:text-white transition-colors"
                      >
                        Zaten bir hesabınız var mı? <b>Giriş Yap</b>
                      </button>
                    </div>
                  )}
                </form>
              </div>
            ) : (
              /* Sign In Form - Reelms Aesthetic */
              <div className="space-y-6">
                {/* Title */}
                <div className="space-y-1">
                  <h2 className="text-2xl sm:text-3xl font-bold text-[#f3efe9] tracking-tight">
                    Welcome to Demirtürk.
                  </h2>
                  <p className="text-xs text-[#a69f99]">
                    Demirtürk Portföy yönetim sistemine giriş yapın.
                  </p>
                </div>

                <form onSubmit={handleSignIn} className="space-y-4 text-left">
                  {/* Identifier Input */}
                  <div className="space-y-1">
                    <input
                      type="text"
                      required
                      placeholder="E-mail or username"
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      className="w-full bg-[#24211f] border border-[#4a443f] focus:border-[#b99881] rounded-full px-5 py-3 text-sm text-[#f3efe9] placeholder-[#9e9690] focus:outline-none transition-colors"
                    />
                  </div>

                  {/* Password Input with Show/Hide & Forgot? */}
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      placeholder="Password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-[#24211f] border border-[#4a443f] focus:border-[#b99881] rounded-full pl-5 pr-24 py-3 text-sm text-[#f3efe9] placeholder-[#9e9690] focus:outline-none transition-colors"
                    />
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="text-[#a69f99] hover:text-[#f3efe9] transition-colors p-1"
                      >
                        {showPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => alert('Şifrenizi unuttuysanız lütfen şirket yöneticinizle iletişime geçin.')}
                        className="text-xs text-[#a69f99] hover:text-[#f3efe9] transition-colors font-medium cursor-pointer"
                      >
                        Forgot?
                      </button>
                    </div>
                  </div>

                  {errorMessage && (
                    <p className="text-xs text-rose-400 text-center font-medium">
                      {errorMessage}
                    </p>
                  )}

                  {/* Sign In Button */}
                  <button
                    type="submit"
                    className="w-full bg-[#453f3b] hover:bg-[#524b46] active:scale-[0.99] border border-[#5c544e] hover:border-[#b99881]/50 text-[#f3efe9] font-semibold rounded-full py-3 text-sm transition-all shadow-md cursor-pointer"
                  >
                    Sign in
                  </button>

                  {/* Continue with Google */}
                  <button
                    type="button"
                    onClick={() => {
                      // If admin exists, log in as first admin, otherwise open register
                      const first = userStore.getAllUsers()[0]
                      if (first) {
                        onLoginSuccess(first)
                        onClose()
                      } else {
                        setView('register-admin')
                      }
                    }}
                    className="w-full bg-[#24211f] hover:bg-[#2d2926] border border-[#4a443f] rounded-full py-2.5 text-xs text-[#d6beae] font-medium transition-colors flex items-center justify-center gap-2.5 cursor-pointer"
                  >
                    {/* Google G SVG */}
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.36 24 12 24z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.28 14.28c-.25-.72-.38-1.49-.38-2.28s.14-1.56.38-2.28V6.57H1.25C.45 8.16 0 9.98 0 12s.45 3.84 1.25 5.43l4.03-3.15z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.36 0 3.26 2.64 1.25 6.57l4.03 3.15c.95-2.83 3.6-4.97 6.72-4.97z"
                      />
                    </svg>
                    <span>Continue with Google</span>
                  </button>

                  <div className="text-center pt-2">
                    <button
                      type="button"
                      onClick={() => setView('register-admin')}
                      className="text-xs text-[#a69f99] hover:text-[#b99881] transition-colors"
                    >
                      Yeni bir yönetici hesabı oluşturun
                    </button>
                  </div>
                </form>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
