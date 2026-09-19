# 🪄 Pixy - Modern Image Compression & Enhancement Tool

> **Kenapa bikin tool ini?**  
> Jujur, ribet banget setiap kali mau kompres aset gambar atau animasi GIF di website-website gratisan online: sering ada limit jumlah file sekali upload, ukuran file dibatasi, banyak iklan, lemot kalau filenya bejibun, dan harus upload aset kita ke server orang lain.  
> 
> Makanya tool ini dibuat awalnya buat kebutuhan diri sendiri—biar serba lokal di laptop/PC, super cepat, tanpa batasan apa pun, dan praktis tinggal ketik `pixy` atau drag-and-drop. Tapi kalau ada yang ngerasa kebantu dan mau pakai juga, **silakan bebas dipakai!** 🎉

CLI dan Interactive Terminal Tool untuk kompresi dan peningkatan kualitas gambar (WebP, GIF animasi, JPG, PNG) dengan mode Non-AI (Lanczos3 + Smart Sharpen) dan AI Super-Resolution (Real-ESRGAN Vulkan).

---

## 🚀 Cara Instalasi & Menjalankan

### 1. Langsung Install via NPM (Resmi & Publik)
Siapa saja dapat langsung menginstall Pixy secara global dengan satu perintah:
```bash
npm install -g pixy-cli
```
Setelah itu, perintah **`pixy`** langsung aktif dan bisa dipanggil di terminal mana saja!

Atau jika tidak ingin menginstall secara permanen, cukup jalankan sekali pakai via `npx`:
```bash
npx pixy-cli
```

### 2. Menggunakan File Binary Executable (`pixy.exe`)
Di dalam folder proyek sudah tersedia **`pixy.exe`** (bisa dibuat ulang kapan saja dengan `npm run build:exe`):
- **Double-click `pixy.exe`** langsung untuk membuka menu interaktif wizard (menu panah keyboard).
- Atau jalankan dari command line: `.\pixy.exe <path-gambar> [opsi]`.

### 3. Install dari Source Lokal
```bash
npm run install:global
```

---

## 📖 Cara Penggunaan

### 1. Mode Interaktif (Wizard Keyboard)
Cukup jalankan:
```bash
pixy
```
Menu interaktif akan muncul, memungkinkan Anda memilih aksi (Kompresi, Enhance, AI), drag & drop file/folder dari File Explorer, dan memilih preset kualitas dengan tombol panah.

### 2. Mode Kompresi Gambar & Animasi GIF
```bash
# Kompres gambar statis menjadi WebP (kualitas 80):
pixy gambar.jpg -q 80

# Kompres sambil mempertahankan format asli JPG, PNG, atau WebP:
pixy gambar.png -q 80 --format original

# Kompres animasi GIF (framerate & delay utuh, ukuran hemat hingga 60%+):
pixy animasi.gif -q 80

# Kompres seluruh isi folder:
pixy path/ke/folder -q 75
```
*Secara default output tersimpan di: `<folder-sumber>/compress/`. Gunakan `--output <folder>` untuk memilih folder akar lain.*

### 3. Mode Peningkatan Kualitas Non-AI (Lanczos3 + Sharpening)
*Khusus gambar statis (JPG, PNG, WebP) untuk mempertahankan ketajaman garis dan teks tanpa efek lilin/meleleh:*
```bash
# Perbesar resolusi 2x dengan kernel Lanczos3 dan penajaman garis:
pixy foto.png -e -s 2

# Perbesar resolusi 4x maksimal:
pixy foto.png -e -s 4
```
*Secara default output tersimpan di: `<folder-sumber>/enhance/`. Gunakan `--output <folder>` untuk memilih folder akar lain.*

### 4. Mode AI Super-Resolution (Real-ESRGAN Vulkan)
*Khusus gambar statis (JPG, PNG, WebP) dengan rekonstruksi tekstur berbasis deep learning:*
```bash
# Preset Teks, Screenshot, & Dokumen (tulisan tetap tajam & tidak meleleh):
pixy screenshot.png --ai --preset text -s 2

# Preset Foto Pemandangan, Alam & Landscape:
pixy pemandangan.jpg --ai --preset landscape -s 2

# Preset Anime & Ilustrasi 2D:
pixy artwork.png --ai --preset anime -s 2
```
*Secara default output tersimpan di: `<folder-sumber>/enhance/ai/`. Gunakan `--output <folder>` untuk memilih folder akar lain.*

---

## 🛠️ Build dari Source
```bash
# Compile TypeScript:
npm run build

# Build pixy.exe:
npm run build:exe
```

---

## 📄 Lisensi

Didistribusikan di bawah Lisensi **MIT**. Silakan cek file [`LICENSE`](LICENSE) untuk informasi lebih lengkap. Bebas digunakan untuk kebutuhan personal maupun komersial.
