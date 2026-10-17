import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Eye, EyeOff, Lock, User, Mail, Building2, ShieldCheck, Sparkles, AlertCircle, ArrowRight, CheckCircle2 } from 'lucide-react'
import { BookLogo, BrandLogoLockup } from '@/components/common/BookLogo'
import { WindowControls } from '@/components/common/WindowControls'
import { AppUser, Department, generateUsername, userStore } from '@/services/userStore'

interface AuthScreenProps {
  onLoginSuccess: (user: AppUser) => void
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onLoginSuccess }) => {
  const [activeTab, setActiveTab] = useState<'signin' | 'signup'>('signin')

  // Sign In States
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [signInError, setSignInError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Sign Up (Admin / Manager) States
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [companyName, setCompanyName] = useState('Demirtürk İnşaat & Gayrimenkul')
  const [newPassword, setNewPassword] = useState('')
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [department, setDepartment] = useState<Department>('Yönetim')
  const [signUpError, setSignUpError] = useState('')

  // Preview generated username for new admin
  const previewUsername = fullName.trim()
    ? generateUsername(fullName, userStore.getAllUsers())
    : ''

  const handleSignIn = (e: React.FormEvent) => {
    e.preventDefault()
    setSignInError('')

    if (!identifier.trim() || !password.trim()) {
      setSignInError('Lütfen e-posta / kullanıcı adı ve şifrenizi girin.')
      return
    }

    setIsSubmitting(true)
    setTimeout(() => {
      const res = userStore.login(identifier, password)
      setIsSubmitting(false)

      if (!res.success || !res.user) {
        setSignInError(res.error || 'Giriş yapılamadı. Bilgilerinizi kontrol edin.')
        return
      }

      onLoginSuccess(res.user)
    }, 250)
  }

  const handleSignUp = (e: React.FormEvent) => {
    e.preventDefault()
    setSignUpError('')

    if (!fullName.trim() || !email.trim() || !newPassword.trim() || !companyName.trim()) {
      setSignUpError('Lütfen zorunlu alanların tümünü doldurun.')
      return
    }

    if (newPassword.length < 6) {
      setSignUpError('Şifre en az 6 karakter olmalıdır.')
      return
    }

    setIsSubmitting(true)
    setTimeout(() => {
      try {
        const createdAdmin = userStore.registerAdmin({
          fullName,
          email,
          password: newPassword,
          companyName,
          department,
        })
        setIsSubmitting(false)
        onLoginSuccess(createdAdmin)
      } catch (err: any) {
        setIsSubmitting(false)
        setSignUpError(err?.message || 'Yönetici hesabı oluşturulurken bir hata oluştu.')
      }
    }, 250)
  }

  return (
    <div className="min-h-screen w-full bg-[#f5f5f2] flex flex-col justify-between text-[#292d2b] select-none relative overflow-x-hidden font-sans">
      {/* Background Ambience */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-[#657a72]/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[500px] h-[300px] bg-[#657a72]/5 rounded-full blur-[120px] pointer-events-none" />

      {/* 1. Header Bar (Frameless Drag + Window Controls) */}
      <header
        className="w-full h-14 px-6 flex items-center justify-between border-b border-[#292d2b]/10 bg-[#e3e5e1] sticky top-0 z-50"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        {/* Brand Logo & Name */}
        <div
          className="flex items-center select-none"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        >
          <BrandLogoLockup
            logoSize={22}
            gapClassName="gap-2.5"
            slideDistance={22}
            textClassName="font-the-seasons text-lg tracking-wide text-[#292d2b]"
          />
        </div>

        {/* Desktop Frameless Window Controls */}
        <div
          className="flex items-center"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        >
          <WindowControls />
        </div>
      </header>

      {/* 2. Main Centered Login Box */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-8 z-10 relative">
        <motion.div
          initial={{ opacity: 0, y: 16, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className="glass-card w-full max-w-[460px] rounded-[32px] bg-white border border-[#292d2b]/12 p-8 sm:p-10 shadow-xl"
        >
          {/* Logo & Headline */}
          <div className="text-center space-y-2 mb-7">
            <div className="w-14 h-14 rounded-2xl bg-[#ebece9] border border-[#657a72]/30 mx-auto flex items-center justify-center text-[#657a72] shadow-xs mb-3">
              <BookLogo size={28} className="text-[#657a72]" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#292d2b]">
              Demirtürk Portföy
            </h1>
            <p className="text-xs text-[#a69f99]">
              Kurumsal Gayrimenkul & Portföy Yönetim Platformu
            </p>
          </div>

          {/* Segmented Tab Switcher (Giriş Yap | Yönetici Kaydı) */}
          <div className="grid grid-cols-2 p-1.5 rounded-2xl bg-[#ebece9] border border-[#292d2b]/10 mb-6">
            <button
              type="button"
              onClick={() => {
                setActiveTab('signin')
                setSignInError('')
              }}
              className={`py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'signin'
                  ? 'bg-[#b99881] text-[#1c1a18] shadow-md'
                  : 'text-[#a69f99] hover:text-white'
              }`}
            >
              Giriş Yap
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('signup')
                setSignUpError('')
              }}
              className={`py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'signup'
                  ? 'bg-[#b99881] text-[#1c1a18] shadow-md'
                  : 'text-[#a69f99] hover:text-white'
              }`}
            >
              Yönetici Kaydı
            </button>
          </div>

          {/* Tab 1: GİRİŞ YAP (SIGN IN) */}
          {activeTab === 'signin' && (
            <motion.form
              key="signin"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.2 }}
              onSubmit={handleSignIn}
              className="space-y-4"
            >
              {/* E-posta veya Kullanıcı Adı */}
              <div className="space-y-1.5 text-left">
                <label className="text-xs font-semibold text-[#d6beae] block pl-1">
                  E-Posta veya Kullanıcı Adı
                </label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#8c857f]">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    required
                    placeholder="E-posta veya kullanıcı adı"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    className="w-full bg-[#1e1b19] border border-[#443d37] focus:border-[#b99881] rounded-2xl pl-11 pr-4 py-3 text-sm text-[#f3efe9] placeholder-[#7d756f] focus:outline-none transition-colors"
                  />
                </div>
              </div>

              {/* Şifre */}
              <div className="space-y-1.5 text-left">
                <div className="flex items-center justify-between pl-1">
                  <label className="text-xs font-semibold text-[#d6beae]">
                    Şifre
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      alert(
                        'Şifrenizi unuttuysanız lütfen şirket yöneticinizle iletişime geçiniz.'
                      )
                    }
                    className="text-[11px] text-[#b99881] hover:underline cursor-pointer"
                  >
                    Şifremi Unuttum?
                  </button>
                </div>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#8c857f]">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-[#1e1b19] border border-[#443d37] focus:border-[#b99881] rounded-2xl pl-11 pr-11 py-3 text-sm text-[#f3efe9] placeholder-[#7d756f] focus:outline-none transition-colors font-sans"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#8c857f] hover:text-[#d6beae] transition-colors p-1 cursor-pointer"
                    title={showPassword ? 'Şifreyi Gizle' : 'Şifreyi Göster'}
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Hata Mesajı */}
              {signInError && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-2 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-medium text-left"
                >
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>{signInError}</span>
                </motion.div>
              )}

              {/* Giriş Butonu */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full mt-2 bg-[#b99881] hover:bg-[#c9a790] active:scale-[0.99] text-[#1c1a18] font-bold rounded-2xl py-3 text-sm transition-all shadow-lg shadow-[#b99881]/20 cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <div className="w-5 h-5 border-2 border-[#1c1a18] border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <span>Giriş Yap</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              {/* Çalışan Hesabı Bilgilendirme Notu */}
              <div className="pt-3 border-t border-[#3d3733]/60 text-center space-y-2">
                <p className="text-[11px] text-[#8c857f] leading-relaxed">
                  Çalışan hesapları şirket yöneticisi tarafından sistem içinden açılır.
                  Yeni şirket açmak için{' '}
                  <button
                    type="button"
                    onClick={() => setActiveTab('signup')}
                    className="text-[#b99881] font-semibold hover:underline cursor-pointer"
                  >
                    Yönetici Kaydı Yapın
                  </button>
                  .
                </p>
              </div>
            </motion.form>
          )}

          {/* Tab 2: YÖNETİCİ KAYDI (SIGN UP) */}
          {activeTab === 'signup' && (
            <motion.form
              key="signup"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.2 }}
              onSubmit={handleSignUp}
              className="space-y-3.5"
            >
              {/* Yönetici Bildirimi Banner */}
              <div className="p-3 rounded-2xl bg-[#b99881]/10 border border-[#b99881]/30 text-left flex items-start gap-2.5">
                <ShieldCheck className="w-5 h-5 text-[#b99881] shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <p className="text-xs font-bold text-white">Yönetici / Şirket Kayıt Alanı</p>
                  <p className="text-[11px] text-[#a69f99] leading-tight">
                    Bu kayıt yalnızca şirket yöneticileri içindir. Ekip çalışanlarının hesapları yönetici paneli üzerinden açılmaktadır.
                  </p>
                </div>
              </div>

              {/* Ad Soyad */}
              <div className="space-y-1 text-left">
                <label className="text-xs font-semibold text-[#d6beae] block pl-1">
                  Ad Soyad *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Adınız ve Soyadınız"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full bg-[#1e1b19] border border-[#443d37] focus:border-[#b99881] rounded-2xl px-4 py-2.5 text-sm text-[#f3efe9] placeholder-[#7d756f] focus:outline-none transition-colors"
                />
                {previewUsername && (
                  <span className="text-[11px] text-[#b99881] pl-1 font-mono">
                    Kullanıcı Adı: @{previewUsername}
                  </span>
                )}
              </div>

              {/* E-Posta */}
              <div className="space-y-1 text-left">
                <label className="text-xs font-semibold text-[#d6beae] block pl-1">
                  E-Posta *
                </label>
                <div className="relative">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8c857f]">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    type="email"
                    required
                    placeholder="ornek@sirketiniz.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-[#1e1b19] border border-[#443d37] focus:border-[#b99881] rounded-2xl pl-10 pr-4 py-2.5 text-sm text-[#f3efe9] placeholder-[#7d756f] focus:outline-none transition-colors"
                  />
                </div>
              </div>

              {/* Şirket Adı & Departman */}
              <div className="grid grid-cols-2 gap-2 text-left">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-[#d6beae] block pl-1">
                    Şirket / Firma Adı *
                  </label>
                  <input
                    type="text"
                    required
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    className="w-full bg-[#1e1b19] border border-[#443d37] focus:border-[#b99881] rounded-2xl px-3.5 py-2.5 text-xs text-[#f3efe9] focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-[#d6beae] block pl-1">
                    Departman
                  </label>
                  <select
                    value={department}
                    onChange={(e) => setDepartment(e.target.value as Department)}
                    className="w-full bg-[#1e1b19] border border-[#443d37] focus:border-[#b99881] rounded-2xl px-3 py-2.5 text-xs text-[#f3efe9] focus:outline-none cursor-pointer"
                  >
                    <option value="Yönetim">Yönetim</option>
                    <option value="Pazarlama">Pazarlama</option>
                    <option value="Satış">Satış</option>
                    <option value="Müşteri İlişkileri">Müşteri İlişkileri</option>
                    <option value="Muhasebe">Muhasebe</option>
                  </select>
                </div>
              </div>

              {/* Şifre */}
              <div className="space-y-1 text-left">
                <label className="text-xs font-semibold text-[#d6beae] block pl-1">
                  Yönetici Şifresi *
                </label>
                <div className="relative">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    required
                    placeholder="En az 6 karakter"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full bg-[#1e1b19] border border-[#443d37] focus:border-[#b99881] rounded-2xl px-4 py-2.5 text-sm text-[#f3efe9] placeholder-[#7d756f] focus:outline-none transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8c857f] hover:text-[#d6beae] p-1 cursor-pointer"
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Hata Mesajı */}
              {signUpError && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-2 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-medium text-left"
                >
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>{signUpError}</span>
                </motion.div>
              )}

              {/* Kayıt Butonu */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full mt-2 bg-[#b99881] hover:bg-[#c9a790] active:scale-[0.99] text-[#1c1a18] font-bold rounded-2xl py-3 text-sm transition-all shadow-lg shadow-[#b99881]/20 cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <div className="w-5 h-5 border-2 border-[#1c1a18] border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Yönetici Hesabı Oluştur ve Başla</span>
                  </>
                )}
              </button>

              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={() => setActiveTab('signin')}
                  className="text-xs text-[#a69f99] hover:text-white transition-colors"
                >
                  Zaten bir hesabınız var mı? <b className="text-[#b99881]">Giriş Yapın</b>
                </button>
              </div>
            </motion.form>
          )}
        </motion.div>
      </main>

      {/* 3. Footer */}
      <footer className="w-full py-4 text-center text-xs text-[#6e6761] border-t border-[#3d3733]/40 z-10">
        © 2026 Demirtürk Portföy Yönetim Sistemi • Güvenli Kurumsal Giriş
      </footer>
    </div>
  )
}
