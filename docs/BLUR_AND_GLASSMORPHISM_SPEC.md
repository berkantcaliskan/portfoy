# Demirtürk Portföy - Arka Plan Bluru ve Frosted Glassmorphism Standardı

> **KORUMALI SİSTEM KURALI**: Kullanıcı tarafından özel olarak onaylanan (`media_1790583830364.png`) arka plan bluru ve cam efekti formülüdür. **Asla değiştirilmemeli veya bozulmamalıdır.**

---

## 1. Açılır Pencereler (Modallar) Arka Plan Bluru

Kullanıcının ekran görüntüsünde ("Yeni Gayrimenkul Projesi Ekle") çok beğendiği arka plan bluru aşağıdaki bileşen ve sınıflar tarafından üretilmektedir:

### Kaynak Bileşen:
* `frontend/src/components/ui/GlassModal.tsx`

### Arka Plan Karartma & Blur Katmanı (Backdrop Overlay):
```tsx
<motion.div
  initial={{ opacity: 0 }}
  animate={{ opacity: 1 }}
  exit={{ opacity: 0 }}
  transition={{ duration: 0.2 }}
  onClick={onClose}
  className="fixed inset-0 bg-black/65 backdrop-blur-md"
/>
```
* **Karartma Oranı**: `bg-black/65` (`rgba(0, 0, 0, 0.65)`) — arkadaki sayfayı kapatmadan derinlik hissi veren yarı-opak siyah tonu.
* **Bulanıklık**: `backdrop-blur-md` (`backdrop-filter: blur(12px)`) — arkadaki menü, kart ve metinleri pürüzsüz ve buğulu bir şekilde bulanıklaştırır.

### Modal Pencere Gövdesi (Modal Panel):
```tsx
<motion.div
  className="glass-modal relative w-full z-10 my-8 rounded-[36px] bg-navy-900/90 backdrop-blur-2xl border border-white/15 p-7 shadow-2xl shadow-black/80"
>
  {/* Üst Zarif Altın Yansıma Çizgisi */}
  <div className="pointer-events-none absolute -top-px left-10 right-10 h-px bg-gradient-to-r from-transparent via-brand-gold/40 to-transparent" />
  ...
</motion.div>
```

---

## 2. Açılır Menüler (Dropdown Panels & Menus)

Tüm açılır menüler (`.dropdown-panel`, `.dropdown-menu`, `[role="menu"]`), modal arka planı ile aynı derinlik ve estetik algısına sahip frosted glassmorphism efektini kullanır:

### Kaynak CSS:
* `frontend/src/index.css` (Satır 132–175)

### CSS Formülü:
```css
.dropdown-panel,
.dropdown-menu,
.popover-panel,
[role="menu"],
[role="listbox"],
header .dropdown-panel,
div.dropdown-panel {
  background: linear-gradient(145deg, rgba(65, 58, 51, 0.65) 0%, rgba(36, 31, 27, 0.72) 100%) !important;
  background-color: rgba(45, 39, 34, 0.68) !important;
  backdrop-filter: blur(36px) saturate(220%) brightness(110%) !important;
  -webkit-backdrop-filter: blur(36px) saturate(220%) brightness(110%) !important;
  border: 1px solid rgba(255, 255, 255, 0.18) !important;
  box-shadow: 0 28px 70px -12px rgba(0, 0, 0, 0.75), 
              0 10px 28px -4px rgba(0, 0, 0, 0.45), 
              inset 0 1px 1px 0 rgba(255, 255, 255, 0.28), 
              inset 0 0 24px 0 rgba(255, 255, 255, 0.04) !important;
}

.dropdown-panel::before,
.dropdown-menu::before,
[role="menu"]::before {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: inherit;
  backdrop-filter: blur(36px) saturate(220%) brightness(110%);
  -webkit-backdrop-filter: blur(36px) saturate(220%) brightness(110%);
  z-index: -1;
  pointer-events: none;
}
```

---

## 3. Kritik Tarayıcı Kuralı (Chromium Nested Backdrop-Filter Önlemi)

* Chromium tabanlı tarayıcılarda (Chrome, Edge, Opera, Brave vb.), bir üst kapsayıcıda (`<header>` veya sabit bar) `backdrop-filter` tanımlanırsa, bu kapsayıcıdan taşan alt açılır menülerin `backdrop-filter` özelliği **tarayıcı tarafından devre dışı bırakılır**.
* Bu nedenle `<header>` gibi kapsayıcılarda `backdrop-filter` kullanılmaz; sabit arka plan rengi `#34302d` verilir. Böylece alt açılır menüler sayfa elemanlarını tam güçle ve kesintisiz bulanıklaştırır.
