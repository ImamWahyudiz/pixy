# 🪄 Pixy - Modern Image Compression & Enhancement Tool

> **Kenapa bikin tool ini?**  
> Jujur, ribet banget setiap kali mau kompres aset gambar atau animasi GIF di website-website gratisan online: sering ada limit jumlah file sekali upload, ukuran file dibatasi, banyak iklan, lemot kalau filenya bejibun, dan harus upload aset kita ke server orang lain.  
> 
> Makanya tool ini dibuat awalnya buat kebutuhan diri sendiri—biar serba lokal di laptop/PC, super cepat, tanpa batasan apa pun, dan praktis tinggal ketik `pixy` atau drag-and-drop. Tapi kalau ada yang ngerasa kebantu dan mau pakai juga, **silakan bebas dipakai!** 🎉

CLI dan Interactive Terminal Tool untuk kompresi dan peningkatan kualitas gambar (WebP, GIF animasi, JPG, PNG) dengan mode Non-AI (Lanczos3 + Smart Sharpen) dan AI Super-Resolution (Real-ESRGAN Vulkan).

---

## 🚀 Cara Instalasi

### 1. Instalasi Global via NPM (Langsung Siap Pakai di Mana Saja)
Buka terminal di folder proyek ini dan jalankan:
```bash
npm run install:global
# atau
npm link --force
```
Setelah perintah di atas selesai, Anda dapat langsung mengetik perintah `pixy` di terminal (PowerShell, Command Prompt, atau Terminal lain) dari folder mana saja di komputer Anda!

### 2. Menggunakan File Binary Executable (`pixy.exe`)
Di dalam folder proyek sudah tersedia **`pixy.exe`** (bisa dibuat ulang kapan saja dengan `npm run build:exe`):
- **Double-click `pixy.exe`** langsung untuk membuka menu interaktif wizard (menu panah keyboard).
- Atau jalankan dari command line: `.\pixy.exe <path-gambar> [opsi]`.

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

# Kompres animasi GIF (framerate & delay utuh, ukuran hemat hingga 60%+):
pixy animasi.gif -q 80

# Kompres seluruh isi folder:
pixy path/ke/folder -q 75
```
*Output tersimpan di: `output/compress/`*

### 3. Mode Peningkatan Kualitas Non-AI (Lanczos3 + Sharpening)
*Khusus gambar statis (JPG, PNG, WebP) untuk mempertahankan ketajaman garis dan teks tanpa efek lilin/meleleh:*
```bash
# Perbesar resolusi 2x dengan kernel Lanczos3 dan penajaman garis:
pixy foto.png -e -s 2

# Perbesar resolusi 4x maksimal:
pixy foto.png -e -s 4
```
*Output tersimpan di: `output/enhance/`*

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
*Output tersimpan di: `output/ai/`*

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

