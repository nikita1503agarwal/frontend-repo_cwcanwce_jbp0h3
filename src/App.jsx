import { useEffect, useMemo, useRef, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation, Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Home as HomeIcon, Calendar, Newspaper, LogOut, Settings2, User, Moon, Sun, Image as ImageIcon } from 'lucide-react'
import { auth, db, googleProvider } from './firebase'
import { signInWithEmailAndPassword, onAuthStateChanged, signInWithPopup, createUserWithEmailAndPassword, signOut, updateProfile } from 'firebase/auth'
import { collection, doc, getDoc, setDoc, updateDoc, serverTimestamp, onSnapshot, query, orderBy } from 'firebase/firestore'
import './index.css'

// Danish strings
const da = {
  home: 'Hjem',
  booking: 'Booking',
  news: 'Nyheder',
  bookCleaning: 'Book rengøring',
  greeting: (name) => `Hej, ${name || 'ven'}`,
  loginTitle: 'Log ind',
  email: 'E-mail',
  password: 'Adgangskode',
  or: 'eller',
  loginGoogle: 'Fortsæt med Google',
  registerHint: 'Har du ikke en konto?',
  register: 'Opret konto',
  name: 'Navn',
  address: 'Adresse',
  phone: 'Telefon',
  language: 'Sprog',
  danish: 'Dansk',
  preferredDate: 'Foretrukken dato',
  hours: 'Hvor mange timer ønsker du rengøring?',
  sendBooking: 'Send booking',
  thanks: 'Tak! Din booking er sendt.',
  settings: 'Indstillinger',
  changePhoto: 'Skift profilfoto',
  lightMode: 'Lyst tema',
  darkMode: 'Mørkt tema',
  logout: 'Log ud',
  latestBooking: 'Seneste booking',
  upcoming: 'Kommende aftaler',
}

// Local storage helpers for instant cache
const storage = {
  get: (k, d=null) => {
    try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d } catch { return d }
  },
  set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch {} }
}

function useAuth() {
  const [user, setUser] = useState(() => auth.currentUser)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u)
      setLoading(false)
    })
    return () => unsub()
  }, [])
  return { user, loading }
}

// Firestore user profile doc
async function ensureProfile(uid) {
  const ref = doc(db, 'profiles', uid)
  const snap = await getDoc(ref)
  if (!snap.exists()) {
    const base = {
      name: '',
      address: '',
      phone: '',
      language: 'da',
      photoURL: '',
      darkMode: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }
    await setDoc(ref, base)
    return base
  }
  return snap.data()
}

function useProfile(uid) {
  const [profile, setProfile] = useState(storage.get('profile', null))
  useEffect(() => {
    if (!uid) return
    const ref = doc(db, 'profiles', uid)
    ensureProfile(uid)
    const unsub = onSnapshot(ref, (s) => {
      const data = s.data()
      setProfile(data)
      storage.set('profile', data)
      if (data?.darkMode) document.documentElement.classList.add('dark')
      else document.documentElement.classList.remove('dark')
    })
    return () => unsub()
  }, [uid])
  return profile
}

function SmoothContainer({ children }) {
  const location = useLocation()
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname}
        initial={{ opacity: 0, y: 8, filter: 'blur(6px)' }}
        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
        exit={{ opacity: 0, y: -8, filter: 'blur(6px)' }}
        transition={{ duration: 0.4, ease: 'easeInOut' }}
        className="min-h-screen bg-gradient-to-br from-zinc-50 to-zinc-100 dark:from-zinc-900 dark:to-black text-zinc-900 dark:text-zinc-100"
      >
        <div className="fixed inset-0 pointer-events-none">
          <div className="absolute inset-0 backdrop-blur-2xl" />
          <div className="absolute inset-0 bg-[radial-gradient(1000px_400px_at_10%_-10%,rgba(0,0,0,0.06),transparent),radial-gradient(800px_300px_at_90%_10%,rgba(0,0,0,0.06),transparent)] dark:bg-[radial-gradient(1000px_400px_at_10%_-10%,rgba(255,255,255,0.06),transparent),radial-gradient(800px_300px_at_90%_10%,rgba(255,255,255,0.06),transparent)]" />
        </div>
        <div className="relative max-w-md mx-auto min-h-screen pb-24">{children}</div>
      </motion.div>
    </AnimatePresence>
  )
}

function BottomNav({ theme }) {
  const items = [
    { to: '/home', label: da.home, icon: HomeIcon },
    { to: '/booking', label: da.booking, icon: Calendar },
    { to: '/news', label: da.news, icon: Newspaper },
  ]
  const location = useLocation()
  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 w-[92%] max-w-md bg-white/80 dark:bg-zinc-800/80 backdrop-blur-xl border border-zinc-200/60 dark:border-zinc-700/60 rounded-3xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.25)]">
      <div className="grid grid-cols-3">
        {items.map(({ to, label, icon: Icon }) => {
          const active = location.pathname === to
          return (
            <Link key={to} to={to} className="py-3 px-4 flex flex-col items-center gap-1">
              <Icon className={`w-5 h-5 transition-all ${active ? 'text-zinc-900 dark:text-white' : 'text-zinc-500'} ${active ? 'scale-110' : 'scale-100'}`} />
              <span className={`text-xs ${active ? 'font-medium' : 'text-zinc-500'}`}>{label}</span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}

function ProfileButton({ onOpen, profile }) {
  const photo = profile?.photoURL
  return (
    <button onClick={onOpen} className="absolute top-4 right-4 rounded-full p-1.5 bg-white/70 dark:bg-zinc-800/70 backdrop-blur-xl border border-zinc-200/60 dark:border-zinc-700/60 shadow hover:scale-105 transition">
      {photo ? (
        <img src={photo} alt="Profil" className="w-9 h-9 rounded-full object-cover" />
      ) : (
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-zinc-200 to-zinc-300 dark:from-zinc-700 dark:to-zinc-600 flex items-center justify-center">
          <User className="w-5 h-5 text-zinc-700 dark:text-zinc-200" />
        </div>
      )}
    </button>
  )
}

function SettingsModal({ open, onClose, profile, uid }) {
  const [form, setForm] = useState(() => ({
    name: profile?.name || '',
    address: profile?.address || '',
    phone: profile?.phone || '',
    language: profile?.language || 'da',
    photoURL: profile?.photoURL || '',
    darkMode: !!profile?.darkMode,
  }))

  useEffect(() => {
    setForm({
      name: profile?.name || '',
      address: profile?.address || '',
      phone: profile?.phone || '',
      language: profile?.language || 'da',
      photoURL: profile?.photoURL || '',
      darkMode: !!profile?.darkMode,
    })
  }, [profile])

  async function save() {
    if (!uid) return
    const ref = doc(db, 'profiles', uid)
    await updateDoc(ref, { ...form, updatedAt: serverTimestamp() })
    if (auth.currentUser && form.name && auth.currentUser.displayName !== form.name) {
      await updateProfile(auth.currentUser, { displayName: form.name, photoURL: form.photoURL || null })
    }
  }

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', stiffness: 280, damping: 30 }} className="absolute bottom-0 left-0 right-0 bg-white dark:bg-zinc-900 rounded-t-3xl p-6 shadow-2xl border border-zinc-200/60 dark:border-zinc-800">
        <div className="mx-auto max-w-md">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">{da.settings}</h3>
            <button onClick={onClose} className="text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200">Luk</button>
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-4">
              {form.photoURL ? (
                <img src={form.photoURL} alt="Profil" className="w-16 h-16 rounded-full object-cover" />
              ) : (
                <div className="w-16 h-16 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center">
                  <ImageIcon className="w-7 h-7 text-zinc-500" />
                </div>
              )}
              <input type="url" placeholder="Profilfoto URL" value={form.photoURL} onChange={(e) => setForm({ ...form, photoURL: e.target.value })} className="flex-1 px-3 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-transparent focus:border-zinc-400 outline-none" />
            </div>

            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={da.name} className="w-full px-3 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-transparent focus:border-zinc-400 outline-none" />
            <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder={da.address} className="w-full px-3 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-transparent focus:border-zinc-400 outline-none" />
            <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder={da.phone} className="w-full px-3 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-transparent focus:border-zinc-400 outline-none" />

            <div className="flex items-center justify-between bg-zinc-100 dark:bg-zinc-800 rounded-xl p-3">
              <div className="flex items-center gap-2">
                {form.darkMode ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
                <span>{form.darkMode ? da.darkMode : da.lightMode}</span>
              </div>
              <button onClick={() => setForm((f) => ({ ...f, darkMode: !f.darkMode }))} className="px-3 py-1 rounded-lg bg-white/70 dark:bg-black/30 border border-zinc-200 dark:border-zinc-700">
                {form.darkMode ? 'Slå fra' : 'Slå til'}
              </button>
            </div>

            <div className="flex items-center justify-between pt-2">
              <button onClick={save} className="px-4 py-2 rounded-xl bg-zinc-900 text-white dark:bg-white dark:text-black">Gem</button>
              <button onClick={() => signOut(auth)} className="px-3 py-2 rounded-xl bg-red-500/90 text-white inline-flex items-center gap-2"><LogOut className="w-4 h-4" /> {da.logout}</button>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

function Header({ onOpen, profile }) {
  return (
    <div className="pt-12 pb-6 px-6">
      <div className="flex items-center justify-between">
        <div className="text-2xl font-semibold tracking-tight">{da.greeting(profile?.name)}</div>
        <ProfileButton onOpen={onOpen} profile={profile} />
      </div>
    </div>
  )
}

function Card({ children }) {
  return <div className="bg-white/80 dark:bg-zinc-800/80 backdrop-blur-xl border border-zinc-200/60 dark:border-zinc-700/60 rounded-2xl p-4 shadow-sm">{children}</div>
}

function Home({ profile, onOpenSettings }) {
  return (
    <div className="px-6 space-y-4">
      <Header onOpen={onOpenSettings} profile={profile} />
      <motion.button whileTap={{ scale: 0.98 }} className="w-full bg-zinc-900 text-white dark:bg-white dark:text-black rounded-2xl py-3 font-medium">
        <Link to="/booking">{da.bookCleaning}</Link>
      </motion.button>

      <Card>
        <div className="text-sm text-zinc-500 mb-1">{da.latestBooking}</div>
        <div className="text-zinc-900 dark:text-zinc-100">Ingen data endnu</div>
      </Card>

      <Card>
        <div className="text-sm text-zinc-500 mb-1">{da.upcoming}</div>
        <div className="text-zinc-900 dark:text-zinc-100">Ingen aftaler</div>
      </Card>
    </div>
  )
}

function Booking({ uid, profile }) {
  const [setup, setSetup] = useState(() => !!(profile?.name && profile?.address && profile?.phone))
  const [name, setName] = useState(profile?.name || '')
  const [address, setAddress] = useState(profile?.address || '')
  const [phone, setPhone] = useState(profile?.phone || '')
  const [date, setDate] = useState('')
  const [hours, setHours] = useState(2)
  const [sent, setSent] = useState(false)
  const sendingRef = useRef(false)

  useEffect(() => {
    setSetup(!!(profile?.name && profile?.address && profile?.phone))
    if (!setup) {
      setName(profile?.name || '')
      setAddress(profile?.address || '')
      setPhone(profile?.phone || '')
    }
  }, [profile])

  async function saveProfile() {
    if (!uid) return
    const ref = doc(db, 'profiles', uid)
    await updateDoc(ref, { name, address, phone, updatedAt: serverTimestamp() })
    setSetup(true)
  }

  async function sendBooking() {
    if (sendingRef.current) return
    sendingRef.current = true
    try {
      const payload = {
        name: profile?.name || name,
        address: profile?.address || address,
        phone: profile?.phone || phone,
        hours: String(hours),
        date: date || new Date().toISOString().slice(0, 10),
        userId: uid || ''
      }
      await fetch('https://hook.eu2.make.com/wlrvmxwpe8f9junjaqw6622pmtn3t7vi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      setSent(true)
      setTimeout(() => setSent(false), 3000)
    } catch (e) {
      console.error(e)
    } finally {
      sendingRef.current = false
    }
  }

  return (
    <div className="px-6">
      <Header onOpen={() => {}} profile={profile} />
      {!setup ? (
        <div className="space-y-3">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder={da.name} className="w-full px-3 py-3 rounded-2xl bg-white/80 dark:bg-zinc-800/80 border border-zinc-200/60 dark:border-zinc-700/60" />
          <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder={da.address} className="w-full px-3 py-3 rounded-2xl bg-white/80 dark:bg-zinc-800/80 border border-zinc-200/60 dark:border-zinc-700/60" />
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={da.phone} className="w-full px-3 py-3 rounded-2xl bg-white/80 dark:bg-zinc-800/80 border border-zinc-200/60 dark:border-zinc-700/60" />
          <div className="flex items-center justify-between">
            <div className="text-sm text-zinc-500">{da.preferredDate}</div>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="px-3 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-transparent focus:border-zinc-400 outline-none" />
          </div>
          <button onClick={saveProfile} className="w-full py-3 rounded-2xl bg-zinc-900 text-white dark:bg-white dark:text-black">Fortsæt</button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-white/80 dark:bg-zinc-800/80 rounded-2xl p-5 border border-zinc-200/60 dark:border-zinc-700/60">
            <div className="text-sm text-zinc-500 mb-2">{da.hours}</div>
            <input type="range" min={1} max={8} value={hours} onChange={(e) => setHours(Number(e.target.value))} className="w-full" />
            <div className="text-center mt-2 text-lg font-medium">{hours} timer</div>
          </div>
          <div className="bg-white/80 dark:bg-zinc-800/80 rounded-2xl p-5 border border-zinc-200/60 dark:border-zinc-700/60 flex items-center justify-between">
            <div className="text-sm text-zinc-500">{da.preferredDate}</div>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="px-3 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-transparent focus:border-zinc-400 outline-none" />
          </div>
          <motion.button whileTap={{ scale: 0.98 }} onClick={sendBooking} className="w-full py-3 rounded-2xl bg-zinc-900 text-white dark:bg-white dark:text-black">
            {da.sendBooking}
          </motion.button>
          <AnimatePresence>
            {sent && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="text-center text-green-600 font-medium">
                {da.thanks}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}

function News() {
  const [items, setItems] = useState([])
  useEffect(() => {
    const q = query(collection(db, 'news'), orderBy('createdAt', 'desc'))
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
      setItems(list)
    })
    return () => unsub()
  }, [])

  return (
    <div className="px-6 space-y-4">
      <div className="pt-12 pb-2 px-1 text-2xl font-semibold">{da.news}</div>
      <div className="space-y-4">
        {items.map((n) => (
          <motion.div key={n.id} initial={{ opacity: 0, y: 8 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="bg-white/80 dark:bg-zinc-800/80 rounded-2xl overflow-hidden border border-zinc-200/60 dark:border-zinc-700/60">
            {n.image && <img src={n.image} alt="" className="w-full h-40 object-cover" />}
            <div className="p-4">
              <div className="text-lg font-semibold mb-1">{n.title}</div>
              <div className="text-sm text-zinc-500 mb-2">{n.createdAt?.toDate ? n.createdAt.toDate().toLocaleDateString('da-DK') : ''}</div>
              <div className="text-sm text-zinc-700 dark:text-zinc-200">{n.description}</div>
            </div>
          </motion.div>
        ))}
        {items.length === 0 && (
          <div className="text-center text-zinc-500">Ingen nyheder endnu</div>
        )}
      </div>
    </div>
  )
}

function AuthScreen() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState('login')
  const [error, setError] = useState('')

  async function doEmail() {
    try {
      setError('')
      if (mode === 'login') await signInWithEmailAndPassword(auth, email, password)
      else await createUserWithEmailAndPassword(auth, email, password)
    } catch (e) {
      setError('Kunne ikke logge ind')
    }
  }

  async function doGoogle() {
    try {
      await signInWithPopup(auth, googleProvider)
    } catch (e) {
      setError('Google-login mislykkedes')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-zinc-50 to-zinc-100 dark:from-zinc-900 dark:to-black">
      <div className="w-full max-w-sm bg-white/80 dark:bg-zinc-800/80 backdrop-blur-xl p-6 rounded-3xl border border-zinc-200/60 dark:border-zinc-700/60 shadow-xl">
        <h1 className="text-2xl font-bold mb-4">{da.loginTitle}</h1>
        <div className="space-y-3">
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder={da.email} className="w-full px-3 py-3 rounded-2xl bg-zinc-100 dark:bg-zinc-900 border border-transparent focus:border-zinc-400 outline-none" />
          <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder={da.password} type="password" className="w-full px-3 py-3 rounded-2xl bg-zinc-100 dark:bg-zinc-900 border border-transparent focus:border-zinc-400 outline-none" />
          {error && <div className="text-sm text-red-500">{error}</div>}
          <button onClick={doEmail} className="w-full py-3 rounded-2xl bg-zinc-900 text-white dark:bg-white dark:text-black">
            {mode === 'login' ? da.loginTitle : da.register}
          </button>
          <div className="text-center text-sm text-zinc-500">{da.or}</div>
          <button onClick={doGoogle} className="w-full py-3 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700">
            {da.loginGoogle}
          </button>
          <div className="text-center text-sm text-zinc-500">
            {da.registerHint}{' '}
            <button className="underline" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>
              {mode === 'login' ? da.register : da.loginTitle}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function Shell() {
  const { user, loading } = useAuth()
  const profile = useProfile(user?.uid)
  const [open, setOpen] = useState(false)

  if (loading) return <div className="min-h-screen grid place-items-center text-zinc-500">Indlæser…</div>
  if (!user) return <AuthScreen />

  return (
    <SmoothContainer>
      <Routes>
        <Route path="/" element={<Navigate to="/home" replace />} />
        <Route path="/home" element={<Home profile={profile} onOpenSettings={() => setOpen(true)} />} />
        <Route path="/booking" element={<Booking uid={user.uid} profile={profile} />} />
        <Route path="/news" element={<News />} />
      </Routes>
      <BottomNav />
      <SettingsModal open={open} onClose={() => setOpen(false)} profile={profile} uid={user?.uid} />
    </SmoothContainer>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Shell />
    </BrowserRouter>
  )
}
