# LevTolstoy

![Lisans](https://img.shields.io/badge/license-MIT-blue.svg)
![Node](https://img.shields.io/badge/node-%3E%3D18-green.svg)

**LevTolstoy**, **Google Gemini AI** gücünü kullanarak dökümanlarınızı Markdown formatına dönüştüren gelişmiş bir araçtır. PDF, PPTX, DOCX dosyalarını ve görselleri temiz, düzenlenebilir Markdown metinlerine çevirir ve yerleşik editörü ile düzenleme imkanı sunar.

<p align="center">
  <img src="docs/screenshots/1.jpg" alt="LevTolstoy Uygulama Ekran Görüntüsü 1" width="45%">
  <img src="docs/screenshots/2.jpg" alt="LevTolstoy Uygulama Ekran Görüntüsü 2" width="45%">
</p>

## ✨ Özellikler

-   **Yapay Zeka Destekli Dönüşüm:** Metinleri ve formatları yüksek doğrulukla anlamak için Google Gemini 1.5/2.0 modellerini kullanır.
-   **Çoklu Format Desteği:** PDF, PPTX (PowerPoint), DOCX (Word) ve Görselleri (PNG, JPG, WEBP) dönüştürün.
-   **Güçlü Markdown Editörü:** Canlı önizleme (Live Preview), bölünmüş görünüm (Split View) ve sözdizimi vurgulama özellikli editör.
-   **PDF Dışa Aktarma:** Düzenlediğiniz Markdown dosyalarını, matematik formülleri (LaTeX) desteğiyle PDF olarak indirin.
-   **Çoklu Dil Desteği:** Türkçe ve İngilizce dil seçenekleri.
-   **Modern Arayüz:** Şık, kullanıcı dostu ve Karanlık/Aydınlık mod destekli arayüz.

## 🚀 Kurulum

### Gereksinimler

-   Node.js 18 veya üzeri
-   Bir Google Gemini API Anahtarı
-   (İsteğe bağlı) Google Drive API projesi (PPTX/DOCX dönüşümleri için gereklidir)

### 🔑 Google Drive API Kurulumu (PPTX/DOCX için Önemli)

Vercel ve Railway gibi sunucusuz/bulut ortamlarında etkileşimli giriş (tarayıcıda Google onayı) yapılamaz. Bu yüzden token'ı yerelde oluşturup ortam değişkeni olarak eklemelisiniz.

1.  **Google Cloud Projesi Oluşturun:**
    -   [Google Cloud Console](https://console.cloud.google.com/) adresine gidin.
    -   Yeni bir proje oluşturun.
    -   **Google Drive API**'yı etkinleştirin.
    -   **Credentials** > **Create Credentials** > **OAuth 2.0 Client ID** yolunu izleyin.
    -   Uygulama türü olarak **Desktop App** seçin.
    -   Client ID ve Client Secret değerlerini alın.

2.  **Token'ı Yerelde Oluşturun:**
    -   Projeyi önce kendi bilgisayarınızda çalıştırın.
    -   Yerel `.env` dosyanıza `GOOGLE_CLIENT_ID` ve `GOOGLE_CLIENT_SECRET` ekleyin.
    -   `npm run auth` komutunu çalıştırın.
    -   Tarayıcıda açılan pencereden giriş yapın.
    -   Bu işlem `server/` klasöründe `.google-token.json` dosyası oluşturacaktır.

3.  **Dağıtım (Deployment) İçin Hazırlık:**
    -   Oluşan `.google-token.json` dosyasını açın ve içeriğin tamamını kopyalayın.
    -   İçeriği tek satır haline getirin (minified JSON string).
    -   Bu string değerini Vercel veya Railway'de `GOOGLE_TOKEN` adıyla environment variable olarak ekleyeceksiniz.

### Yerel Geliştirme

1.  Depoyu klonlayın:
    ```bash
    git clone https://github.com/GokhanOfficial/LevTolstoy.git
    cd LevTolstoy
    ```

2.  Bağımlılıkları yükleyin:
    ```bash
    npm install
    # veya
    yarn install
    ```

3.  Ortam değişkenlerini ayarlayın:
    `.env.example` dosyasını `.env` olarak kopyalayın ve gerekli anahtarları girin.
    ```bash
    cp .env.example .env
    ```
    
    `.env` dosyasını düzenleyin:
    ```env
    GEMINI_API_KEY=api_anahtariniz
    # İsteğe bağlı: Office dosyaları için Google Drive ayarları
    GOOGLE_CLIENT_ID=...
    GOOGLE_CLIENT_SECRET=...
    ```

4.  Uygulamayı başlatın:
    ```bash
    npm run dev
    ```

    Tarayıcınızda `http://localhost:3000` adresine gidin.

## ☁️ Dağıtım (Deployment)

### Railway'e Dağıtım

Railway, Node.js uygulamalarını dağıtmak için hızlı ve kolay bir seçenektir.

1.  [Railway.app](https://railway.app/) üzerinde hesap oluşturun.
2.  **"New Project"** -> **"Deploy from GitHub repo"** seçeneğini seçin.
3.  `GokhanOfficial/LevTolstoy` deposunu seçin.
4.  Railway panelinden "Variables" sekmesine gelerek `GEMINI_API_KEY` gibi anahtarlarınızı ekleyin.
5.  Railway otomatik olarak `package.json` dosyasını algılayacak ve deploy edecektir.

### Vercel'e Dağıtım

Proje, Vercel üzerinde çalışması için gerekli `vercel.json` yapılandırmasını içerir.

1.  Vercel CLI yükleyin: `npm i -g vercel`
2.  Proje dizininde `vercel` komutunu çalıştırın.
3.  Yönergeleri izleyerek projeyi bağlayın.
4.  Vercel Panelinden "Environment Variables" kısmına API anahtarlarınızı eklemeyi unutmayın.

## 🛠️ Teknolojiler

-   **Backend:** Express.js, Multer
-   **Yapay Zeka:** Google Generative AI SDK (Gemini)
-   **Frontend:** HTML5, TailwindCSS, Vanilla JS
-   **Araçlar:** Marked.js, Highlight.js, KaTeX, Puppeteer

## 📄 Lisans

Bu proje MIT Lisansı ile lisanslanmıştır - detaylar için `LICENSE` dosyasına bakınız.
